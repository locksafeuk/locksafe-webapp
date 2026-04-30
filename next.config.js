/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: process.env.NEXT_OUTPUT_MODE,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enable Next.js image optimization (deploy target is dynamic — Vercel/Netlify).
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  // Reduce client bundle size by tree-shaking large icon/utility libs
  // and inline critical CSS to remove render-blocking stylesheet.
  experimental: {
    optimizeCss: true,
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
  // GTM, GA, Google Ads, Bing UET, Meta Pixel, OneSignal, Sentry, Mapbox
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://www.google.com https://www.google.co.uk https://www.gstatic.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://td.doubleclick.net https://pagead2.googlesyndication.com https://connect.facebook.net https://bat.bing.com https://*.onesignal.com https://cdn.onesignal.com https://api.mapbox.com https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://*.onesignal.com https://onesignal.com",
      "img-src 'self' data: blob: https: https://www.facebook.com https://*.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://google.com https://www.google.com https://www.google.co.uk https://stats.g.doubleclick.net",
      "font-src 'self' data:",
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.google.com https://*.googletagmanager.com https://www.googleadservices.com https://pagead2.googlesyndication.com https://google.com https://www.google.co.uk https://stats.g.doubleclick.net https://googleads.g.doubleclick.net https://graph.facebook.com https://www.facebook.com https://bat.bing.com https://*.onesignal.com https://onesignal.com wss://*.onesignal.com https://*.sentry.io https://api.mapbox.com https://events.mapbox.com https://api.stripe.com",
      "frame-src 'self' https://www.googletagmanager.com https://www.googleadservices.com https://td.doubleclick.net https://bid.g.doubleclick.net https://www.google.com https://js.stripe.com https://hooks.stripe.com",
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
