INSERT INTO public.stories
  (title, slug, description, embed_url, platform, view_count, share_count, msm_gap, published, display_order, created_at, updated_at)
VALUES
  ('TikTok Clip #2 — Edit this title', 'tiktok-7152158478038207790', null, 'https://www.tiktokv.com/share/video/7152158478038207790', 'tiktok', 0, 0, false, false, 99, '2022-10-12T22:42:42.000Z', '2022-10-12T22:42:42.000Z'),
  ('TikTok Clip #1 — Edit this title', 'tiktok-7073228549389323562', null, 'https://www.tiktokv.com/share/video/7073228549389323562', 'tiktok', 0, 0, false, false, 99, '2022-03-26T10:37:25.000Z', '2022-03-26T10:37:25.000Z')
ON CONFLICT (slug) DO NOTHING;