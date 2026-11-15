import type { NextConfig } from "next";

// Security-hardening response headers (applied to every route). These are the
// safe complement to a Content-Security-Policy: they don't restrict which
// resources load (so the YouTube / TikTok / X embeds keep working), they just
// close off clickjacking, MIME-sniffing, referrer leakage, and powerful features
// the site never uses. HSTS uses a 6-month max-age without `preload` so it stays
// reversible. Permissions-Policy denies camera/mic/geolocation/payment/usb and
// opts out of the Topics API — none are used, and critically it does NOT touch
// autoplay/encrypted-media/picture-in-picture/accelerometer/gyroscope, which the
// video embeds delegate into their iframes.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  async rewrites() {
    return [
      { source: '/rss.xml', destination: '/rss' },
      { source: '/feed.xml', destination: '/rss' },
    ]
  },
  async redirects() {
    return [
      // My Local: canonical route is /local.
      { source: '/my-local', destination: '/local', permanent: true },
      // /feed split into /feed (digest) + /feed/clips (clips) so both are static.
      // Preserve the old query URL. Done at config level so /feed itself never
      // reads searchParams (which would force dynamic rendering again).
      {
        source: '/feed',
        has: [{ type: 'query', key: 'view', value: 'clips' }],
        destination: '/feed/clips',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
