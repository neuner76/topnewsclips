-- US institutional source additions — rebalance supply toward US Tier 1-6.
-- Context: international 24/7 broadcasters were supplying ~68% of published
-- stories while the US institutional bench was thin. These five channels are
-- productive (daily uploads), embeddable (oEmbed 200 on recent videos), and
-- verified against the YouTube API on 2026-06-12.
insert into featured_journalists (username, platform, active, source_tier, source_type, channel_id) values
  ('pbsnewshour', 'youtube', true, 3, 'Public Broadcaster', 'UC6ZFN9Tx6xh-skXCuRHCDpQ'),
  ('cspan',       'youtube', true, 3, 'Public Broadcaster', 'UCb--64Gl51jIEVE-GLDAVTg'),
  ('nbcnews',     'youtube', true, 6, 'Newsroom',           'UCeY0bbntWzzVIaj2z3QigXg'),
  ('scrippsnews', 'youtube', true, 6, 'Newsroom',           'UCTln5ss6h6L_xNfMeujfPbg'),
  ('newsnation',  'youtube', true, 6, 'Newsroom',           'UCCjG8NtOig0USdrT5D1FpxQ')
on conflict (username, platform) do update
  set active = true, source_tier = excluded.source_tier, source_type = excluded.source_type, channel_id = excluded.channel_id;
