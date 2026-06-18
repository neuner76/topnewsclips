-- Spec 3.2: unified classification pass persists three enum fields per story.
-- content_type is the canonical content-type taxonomy (lib/ingest/classify.ts);
-- topic_role is the reader-role of the subject; section_fit is the topical
-- section the item editorially belongs in (validated against the rendered
-- section by the 6.1 section-fit validator). All nullable — rows predating the
-- classify pass, and items held as needs_review by the injection guard, carry
-- null. Check constraints keep the columns in lockstep with the code enums.
alter table stories add column if not exists content_type text null;
alter table stories add column if not exists topic_role text null;
alter table stories add column if not exists section_fit text null;

alter table stories drop constraint if exists stories_content_type_check;
alter table stories add constraint stories_content_type_check
  check (content_type is null or content_type in (
    'reported', 'investigative', 'official_primary', 'raw_footage', 'social_clip',
    'commentary_analysis', 'satire', 'cultural_lens', 'opinion', 'interview_panel'
  ));

alter table stories drop constraint if exists stories_topic_role_check;
alter table stories add constraint stories_topic_role_check
  check (topic_role is null or topic_role in (
    'public_safety', 'geopolitical', 'public_health', 'economic', 'infrastructure',
    'legal_institutional', 'culture_media', 'curiosity_disclosure', 'undercovered_intl',
    'mainstream_agenda_marker'
  ));

alter table stories drop constraint if exists stories_section_fit_check;
alter table stories add constraint stories_section_fit_check
  check (section_fit is null or section_fit in (
    'Politics & World Affairs', 'Science, Health & Environment', 'Business & Markets',
    'Culture, Media & Society', 'Also Worth Knowing', 'Global Blindspot', 'Global Lens'
  ));
