import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// List of valid city slugs to match against
const validCities = [
  'london', 'manchester', 'birmingham', 'leeds', 'glasgow', 'liverpool',
  'bristol', 'edinburgh', 'sheffield', 'newcastle', 'nottingham', 'leicester',
  'cardiff', 'belfast', 'brighton', 'oxford', 'cambridge', 'york', 'bath',
  'exeter', 'plymouth', 'southampton', 'portsmouth', 'reading', 'milton-keynes',
  'coventry', 'wolverhampton', 'bradford', 'hull', 'sunderland', 'middlesbrough',
  'derby', 'norwich', 'peterborough', 'ipswich', 'bournemouth', 'swansea',
  'newport', 'aberdeen', 'dundee'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle locksmith-[city] URLs - rewrite to /locksmith-city/[city]
  // Example: /locksmith-london -> /locksmith-city/london
  if (pathname.startsWith('/locksmith-') && !pathname.startsWith('/locksmith-city') && !pathname.startsWith('/locksmith-area') && !pathname.startsWith('/locksmith-signup')) {
    const citySlug = pathname.replace('/locksmith-', '');

    // Validate it's a known city
    if (validCities.includes(citySlug)) {
      const url = request.nextUrl.clone();
      url.pathname = `/locksmith-city/${citySlug}`;
      return NextResponse.rewrite(url);
    }
  }

  // Handle emergency-locksmith-* URLs - rewrite to /locksmith-area/*
  // Example: /emergency-locksmith-wd4-kings-langley -> /locksmith-area/wd4-kings-langley
  if (pathname.startsWith('/emergency-locksmith-')) {
    const slug = pathname.replace('/emergency-locksmith-', '');

    // Rewrite internally (URL in browser stays the same)
    const url = request.nextUrl.clone();
    url.pathname = `/locksmith-area/${slug}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and api routes
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons).*)',
  ],
};
