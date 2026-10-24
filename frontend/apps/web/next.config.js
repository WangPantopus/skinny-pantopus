const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
const { mediaCspSources, mediaRemotePatterns } = require('./src/lib/media-hosts');

const defaultApiUrl =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:8000'
    : 'http://localhost:8000');

/** @type {import('next').NextConfig} */
const createNextConfig = (phase) => ({
  // Keep local dev output separate from production build output. Next build
  // and Next dev both write generated server chunks, so sharing .next can
  // corrupt localhost when background build checks run during manual testing.
  distDir:
    process.env.NEXT_DIST_DIR ||
    (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next'),
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    // Instant Screens (contract §3): a page visited in this tab reopens from the router's
    // memory instead of asking the server for its route again, so going back is instant and
    // works offline. Signed-in pages are thin client wrappers (their data loads in the
    // browser, kept by TanStack Query for the same 30 minutes), so a kept route carries no
    // account data. Defaults: dynamic 0 s, static 300 s.
    staleTimes: { dynamic: 1800, static: 1800 },
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['@pantopus/api', '@pantopus/types', '@pantopus/utils', '@pantopus/ui-utils', '@pantopus/theme'],
  images: {
    // Next.js 16+: every `quality` passed to <Image /> must appear here (dev warning today).
    // Repo uses 75 (avatars/thumbs) and 80 (larger media / posts / listings).
    qualities: [75, 80],
    // Uploaded files live in Pantopus's own Supabase Storage or S3/CloudFront
    // (src/lib/media-hosts.js); /_next/image refuses every other host, so it
    // can't be used as a free image proxy. In development an <Image> whose host
    // is missing here throws and takes the whole page down.
    remotePatterns: [
      ...mediaRemotePatterns(),
      { protocol: 'https', hostname: 'pantopus.com' },
      { protocol: 'https', hostname: 'www.pantopus.com' },
      // Local storage only in development: in production these would let the
      // image optimizer fetch from the server's own internal addresses.
      ...(phase === PHASE_DEVELOPMENT_SERVER
        ? [
            { protocol: 'http', hostname: 'localhost' },
            { protocol: 'http', hostname: '127.0.0.1' },
          ]
        : []),
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: defaultApiUrl,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://www.pantopus.com',
  },
  // Serve .well-known files with correct Content-Type for Universal Links / App Links.
  // Deploy this app on BOTH https://www.pantopus.com and https://pantopus.com (or ensure
  // apex serves these URLs with 200 + same JSON — redirects on /.well-known can break verification).
  async headers() {
    // Every page: no plugin content and no <base> pointing elsewhere. The only
    // <object>s are PDF viewers (a post's attachment in the lightbox, private
    // claim evidence as checked in-memory bytes), so object-src admits this
    // site, blob: and Pantopus's own storage rather than 'none', which would
    // blank them; the fallback link inside <object> is what Android Chrome shows.
    const objectSources = [
      "'self'",
      'blob:',
      ...mediaCspSources(),
      ...(phase === PHASE_DEVELOPMENT_SERVER ? ['http://localhost:*', 'http://127.0.0.1:*'] : []),
    ];
    const pageCsp = `object-src ${objectSources.join(' ')}; base-uri 'self'`;
    return [
      {
        source: '/chat-offline',
        headers: [
          { key: 'X-Pantopus-Chat-Shell', value: '1' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/chat-service-worker.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
      // Clickjacking protection for every page except booking embeds, which
      // other sites frame on purpose. Rules below override these per path.
      {
        source: '/((?!book/[^/]+/embed).*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: `frame-ancestors 'none'; ${pageCsp}` },
        ],
      },
      // Booking embeds keep every directive but frame-ancestors.
      {
        source: '/book/:slug/embed',
        headers: [{ key: 'Content-Security-Policy', value: pageCsp }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/status/:token',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // A letter's claim page: its link carries the claim token.
      {
        source: '/open/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
  // Proxy API calls through Next.js so backend cookies are same-origin.
  async redirects() {
    return [
      // Resolve the app entry before React renders its server redirect. Keep
      // the destination relative so local and deployed hosts retain cookies.
      { source: '/app', destination: '/app/place', permanent: false },
      // Old /app addresses also redirect here: their redirect() pages render inside the
      // app shell's Suspense, so Next redirects on the client, which crashed with
      // "Rendered more hooks than during the previous render" (Next's Router).
      { source: '/app/control-center', destination: '/app/hub', permanent: false },
      { source: '/app/neighborhood', destination: '/app/nearby', permanent: false },
      { source: '/app/businesses/new', destination: '/app/business/new', permanent: false },
      { source: '/app/chat/new', destination: '/app/chat', permanent: false },
      { source: '/invite/lease/:token', destination: '/app/homes/invite?type=lease&code=:token', permanent: false },
    ];
  },
  async rewrites() {
    const backendUrl = defaultApiUrl;
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      // Socket.IO must be same-origin as the page so httpOnly `pantopus_access` is sent
      // (see SocketContext + backend/socket/chatSocketio.js cookie fallback for `__session__`).
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },
});

module.exports = createNextConfig;
