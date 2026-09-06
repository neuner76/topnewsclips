import { FeedPage } from './FeedPage'

// Digest view — static/ISR. No searchParams or cookies() here, so `revalidate`
// takes effect and the CDN can cache it (see FeedPage for the shared render;
// the clips view lives at /feed/clips). The old /feed?view=clips URL is
// redirected to /feed/clips in next.config.ts.
export const revalidate = 300

export default function Page() {
  return <FeedPage preferredView="digest" />
}
