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
};

export default nextConfig;
