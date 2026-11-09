-- Raise application and bucket limits to 1 GiB per attachment.
-- Hosted projects also need Storage Settings > Global file size limit >= 1 GiB.
-- Supabase Free is capped at 50 MB; this migration cannot change the project plan.
alter table public.learning_files drop constraint learning_files_byte_size_check;
alter table public.learning_files add constraint learning_files_byte_size_check
  check(byte_size between 1 and 1073741824);
update storage.buckets set file_size_limit=1073741824,public=false where id='merlin-files';
notify pgrst,'reload schema';
