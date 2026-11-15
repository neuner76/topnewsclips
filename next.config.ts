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

// Content-Security-Policy in REPORT-ONLY mode (the modern-web-guidance
// `restrict-outbound-connections` guide). It blocks NOTHING — it only reports what
// an enforced policy would block, to /api/csp-report, so we can find any origin the
// allowlist missed before switching to an enforcing `Content-Security-Policy`.
// Allowlist reflects the real third parties: YouTube/TikTok/X embeds, Supabase,
// PostHog, and Caltrans camera images. `img-src https:` is pragmatic for a news
// aggregator whose thumbnails come from many CDNs. `script-src` keeps 'unsafe-inline'
// /'unsafe-eval' for now (Next hydration without nonces) — tightening that to nonces
// is the step after this policy is observed clean and flipped to enforcing.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.tiktok.com https://platform.twitter.com https://us-assets.i.posthog.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://platform.twitter.com https://twitter.com https://x.com https://syndication.twitter.com",
  "connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://www.youtube.com",
  "media-src 'self' blob: https:",
  "report-uri /api/csp-report",
].join('; ')

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        ...securityHeaders,
        { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
      ],
    }]
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
