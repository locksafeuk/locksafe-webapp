const nextDistDirEnv = process.env.NEXT_DIST_DIR;
const nextOutputModeEnv = process.env.NEXT_OUTPUT_MODE;

const normalizedDistDir =
  typeof nextDistDirEnv === 'string' &&
  nextDistDirEnv.trim().length > 0 &&
  nextDistDirEnv !== 'undefined'
    ? nextDistDirEnv.trim()
    : '.next';

const normalizedOutputMode =
  nextOutputModeEnv === 'standalone' || nextOutputModeEnv === 'export'
    ? nextOutputModeEnv
    : undefined;

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: normalizedDistDir,
  ...(normalizedOutputMode ? { output: normalizedOutputMode } : {}),
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable Next.js image optimization (deploy target is dynamic — Vercel/Netlify).
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  // Include agent SKILL.md files in serverless bundle so the orchestrator
  // can read them at runtime via fs.readFile.
  outputFileTracingIncludes: {
    '/api/**': ['./src/agents/**/*.md'],
  },
  // Reduce client bundle size by tree-shaking large icon/utility libs
  // and inline critical CSS to remove render-blocking stylesheet.
  experimental: {
    optimizeCss: false,
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-accordion',
      '@radix-ui/react-tabs',
      '@radix-ui/react-select',
      '@radix-ui/react-avatar',
      '@radix-ui/react-progress',
    ],
  },
  // Long-term cache static chunks and immutable assets, plus a security
  // header baseline including a Content-Security-Policy that allow-lists
  // GTM, GA, Google Ads, Bing UET, Meta Pixel, Sentry, Mapbox
  // and Stripe — everything we currently load from third parties.
  async headers() {
    // NOTE: 'unsafe-inline' is required by GTM (injects inline scripts) and
    // Next.js inline runtime hydration; 'unsafe-eval' is needed in dev and by
    // some Mapbox bundles. Tighten with nonces if/when sGTM is adopted.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com",
      // Google Ads / GTM / GA4 conversion tracking requires broad wildcards
      // across google.* country TLDs and *.doubleclick.net — Google's tester
      // fails if these are pinned to specific subdomains/TLDs only.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://*.google-analytics.com https://*.google.com https://*.googleadservices.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://connect.facebook.net https://bat.bing.com https://api.mapbox.com https://js.stripe.com",
      "script-src-elem 'self' 'unsafe-inline' https://*.googletagmanager.com https://*.google-analytics.com https://*.google.com https://*.googleadservices.com https://*.googlesyndication.com https://*.doubleclick.net https://*.gstatic.com https://connect.facebook.net https://bat.bing.com https://api.mapbox.com https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.google.com https://*.google.co.uk https://*.google.de https://*.google.fr https://*.google.ie https://*.googletagmanager.com https://*.googleadservices.com https://*.googlesyndication.com https://*.doubleclick.net https://*.g.doubleclick.net https://graph.facebook.com https://www.facebook.com https://bat.bing.com https://*.sentry.io https://api.mapbox.com https://events.mapbox.com https://api.stripe.com",
      "frame-src 'self' https://*.googletagmanager.com https://*.googleadservices.com https://*.doubleclick.net https://*.google.com https://js.stripe.com https://hooks.stripe.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "media-src 'self' data: blob:",
      "upgrade-insecure-requests",
    ].join('; ');

    const securityHeaders = [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
    ];

    return [
      // Apple Universal Links + Android App Links verification files
      // Must be served with Content-Type: application/json (not pkcs7-mime)
      {
        source: '/.well-known/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|woff2)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Legacy Shopify product URLs — redirect to home
      {
        source: '/products/:slug*',
        destination: '/',
        permanent: true,
      },
      // Legacy Shopify policy URLs
      {
        source: '/:shopId(\\d+)/policies/:rest*',
        destination: '/privacy',
        permanent: true,
      },
    ];
  },
  // Next.js 16 enables Turbopack by default. An empty turbopack config
  // signals that the project is aware of Turbopack and prevents the build
  // error caused by having a webpack config without a turbopack config.
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.output.filename = 'static/chunks/[name]-[contenthash:8].js';
      config.output.chunkFilename = 'static/chunks/[contenthash:16].js';
    }
    return config;
  },
};

module.exports = nextConfig;
