import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthorizedAdminRequest } from '@/lib/admin-gate';

// Rate limiting (in-memory, edge-compatible)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 100; // requests per window
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function getRateLimitResult(ip: string) {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || now > entry.resetTime) {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Periodic cleanup of expired entries (edge-safe)
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of ipRequestCounts) {
      if (now > entry.resetTime) {
        ipRequestCounts.delete(key);
      }
    }
  };
  // Clean every 5 minutes
  setInterval(cleanup, 5 * 60 * 1000);
}

// City slug routing
const LITERAL_LOCKSMITH_ROUTES = new Set([
  '/locksmith-signup',
  '/locksmith-rickmansworth',
  '/locksmith-east-london',
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // TikTok site-ownership verification.
  // TikTok requests https://<domain>/tiktok<TOKEN>.txt and expects the body
  // to equal `tiktok-developers-site-verification=<TOKEN>`. It rotates <TOKEN>
  // frequently, so a single static /public file goes stale before a deploy
  // finishes (this caused repeated "Invalid Website URL" rejections). Deriving
  // the body from the requested filename makes ANY token verify instantly with
  // no redeploy. The strict pattern ensures we only answer genuine probes.
  const tiktokVerify = pathname.match(/^\/tiktok([A-Za-z0-9]{16,64})\.txt$/);
  if (tiktokVerify) {
    return new NextResponse(
      `tiktok-developers-site-verification=${tiktokVerify[1]}`,
      {
        status: 200,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
        },
      }
    );
  }

  // Admin API gate. Must run BEFORE the rate-limit block's read-only early
  // return below — otherwise sensitive admin GETs (payments, stats, jobs)
  // would pass unauthenticated. The gate accepts the union of auth mechanisms
  // already in use (admin cookie / admin Bearer JWT / CRON_SECRET / vercel-cron)
  // and self-allowlists the public tracking-pixel paths; it fails closed.
  if (pathname.startsWith('/api/admin/')) {
    const authorized = await isAuthorizedAdminRequest({
      pathname,
      cookieToken: request.cookies.get('auth_token')?.value,
      authHeader: request.headers.get('authorization'),
      cronSecretHeader: request.headers.get('x-cron-secret'),
      isVercelCron: request.headers.get('x-vercel-cron') === '1',
    });
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const method = request.method.toUpperCase();
    const isReadOnlyMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

    // Do not rate limit read-only API traffic.
    // This avoids blocking critical session checks and SSE/polling reads,
    // which can otherwise cause client-side loading loops and forced logouts.
    if (isReadOnlyMethod) {
      return NextResponse.next();
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const result = getRateLimitResult(ip);

    if (!result.allowed) {
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // Attach rate-limit headers to successful API responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    return response;
  }

  // Handle locksmith-[city] URLs -> /locksmith-city/[city]
  //
  // History: this rewrite was added when the city shorthand was the only
  // /locksmith-* pattern. After commit caecd5a renamed
  // /locksmith/[district] to /locksmith-in/[district], URLs like
  // /locksmith-in/rg1 began falling through this rewrite (the original
  // `-in-` includes() check matched `-in-`, with dashes on both sides,
  // but the new URL pattern is `-in/`). The fall-through rewrote
  // /locksmith-in/rg1 to /locksmith-city/in/rg1, where it matched
  // /locksmith-city/[city]/[area] with city="in" and rendered a 404.
  // The explicit /locksmith-in prefix exclusion below prevents that.
  if (
    pathname.startsWith('/locksmith-') &&
    !pathname.startsWith('/locksmith-city') &&
    !pathname.startsWith('/locksmith-area') &&
    !pathname.startsWith('/locksmith-in') &&
    !pathname.includes('-in-') &&
    !LITERAL_LOCKSMITH_ROUTES.has(pathname)
  ) {
    const rest = pathname.replace('/locksmith-', '');
    if (rest) {
      // Supports both `/locksmith-london` and `/locksmith-london/canary-wharf`
      const url = request.nextUrl.clone();
      url.pathname = `/locksmith-city/${rest}`;
      return NextResponse.rewrite(url);
    }
  }

  // Handle emergency-locksmith-* URLs -> /locksmith-area/*
  // Skip keyword-template landings (contain `-in-`), e.g.
  // /emergency-locksmith-near-me-in-london.
  if (
    pathname.startsWith('/emergency-locksmith-') &&
    !pathname.includes('-in-')
  ) {
    const slug = pathname.replace('/emergency-locksmith-', '');
    const url = request.nextUrl.clone();
    url.pathname = `/locksmith-area/${slug}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons).*)',
  ],
};
