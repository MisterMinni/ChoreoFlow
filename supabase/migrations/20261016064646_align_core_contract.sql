-- Match Core's 200-character project/cast names; preserve all data.
alter table public.projects drop constraint projects_title_check;
alter table public.projects add constraint projects_title_check check (char_length(btrim(title)) between 1 and 200);
alter table public.casts drop constraint casts_title_check;
alter table public.casts add constraint casts_title_check check (char_length(btrim(title)) between 1 and 200);

-- Keep the bucket's accepted type names aligned with the Core audio model.
update storage.buckets
set allowed_mime_types=array['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/x-wav','audio/ogg','audio/flac','audio/webm']
where id='project-media';
