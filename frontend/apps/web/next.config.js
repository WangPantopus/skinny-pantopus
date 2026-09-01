const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

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
  typescript: {
    // Pre-existing type errors unrelated to Docker setup.
    // Run `pnpm type-check` to see the full list and fix them over time.
    ignoreBuildErrors: true,
  },
  transpilePackages: ['@pantopus/api', '@pantopus/types', '@pantopus/utils', '@pantopus/ui-utils', '@pantopus/theme'],
  images: {
    // Next.js 16+: every `quality` passed to <Image /> must appear here (dev warning today).
    // Repo uses 75 (avatars/thumbs) and 80 (larger media / posts / listings).
    qualities: [75, 80],
    remotePatterns: [
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: 'pantopus.com' },
      { protocol: 'https', hostname: 'www.pantopus.com' },
      { protocol: 'http', hostname: 'localhost' },
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
    return [
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
