import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  if (
    pathname.startsWith('/locksmith-') &&
    !pathname.startsWith('/locksmith-city') &&
    !pathname.startsWith('/locksmith-area') &&
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
