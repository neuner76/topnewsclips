import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
