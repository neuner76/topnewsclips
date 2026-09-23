-- Bloomberg Quicktake was rebranded ("Bloomberg Originals"); the
-- @bloombergquicktake handle no longer resolves, so resolveYouTubeChannelId
-- returned null and the channel silently fetched 0 clips for months — a hidden
-- reason the Business & Markets section runs thin.
--
-- Repoint to Bloomberg Television (@markets, UCIALMKvObZNtJ6AmdCLP7Lg): the
-- daily markets/finance news channel (verified 2026-09-23 — 5 uploads that day,
-- all oEmbed 200), which is the right supply for Business & Markets.
update featured_journalists
set username      = 'markets',
    display_name  = 'Bloomberg Television',
    channel_id    = 'UCIALMKvObZNtJ6AmdCLP7Lg',
    active        = true,
    source_tier   = 6,
    source_type   = 'Commercial Newsroom'
where platform = 'youtube' and username = 'bloombergquicktake';
