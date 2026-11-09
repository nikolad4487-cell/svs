-- Private attachments for native learning materials and assignment instructions.
-- Supabase Storage must be enabled. Keep this bucket private.
alter table public.learning_materials add constraint learning_material_course_id unique(institution_id,course_id,id);
create table public.learning_files (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  course_id uuid not null,
  material_id uuid,
  assignment_id uuid,
  object_path text not null unique,
  file_name text not null check(length(file_name) between 1 and 200 and file_name !~ '[[:cntrl:]/\\]'),
  mime_type text not null check(mime_type in ('image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','application/pdf','text/plain','application/zip','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  byte_size bigint not null check(byte_size between 1 and 52428800),
  status text not null default 'pending' check(status in ('pending','ready')),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check((material_id is not null)::integer + (assignment_id is not null)::integer=1),
  foreign key(institution_id,course_id,material_id) references public.learning_materials(institution_id,course_id,id),
  foreign key(institution_id,course_id,assignment_id) references public.learning_assignments(institution_id,course_id,id)
);
create index learning_files_material on public.learning_files(material_id,id);
create index learning_files_assignment on public.learning_files(assignment_id,id);
create index learning_files_course on public.learning_files(course_id,id);
alter table public.learning_files enable row level security;

create function public.learning_file_access(target_path text,editing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.learning_files f
    left join public.learning_materials m on m.id=f.material_id
    left join public.learning_assignments a on a.id=f.assignment_id
    where f.object_path=target_path and
    (public.course_staff(f.institution_id,f.course_id) or
      (not editing and f.status='ready' and coalesce(m.published,a.published,false) and public.enrolled(f.course_id))));
$$;
create policy learning_files_read on public.learning_files for select to authenticated
  using(public.learning_file_access(object_path));
revoke all on public.learning_files from public,anon,authenticated;
grant select on public.learning_files to authenticated;
grant all on public.learning_files to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('merlin-files','merlin-files',false,52428800,array[
  'image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm','application/pdf','text/plain','application/zip',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'
]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy merlin_object_read on storage.objects for select to authenticated
  using(bucket_id='merlin-files' and public.learning_file_access(name));
create policy merlin_object_insert on storage.objects for insert to authenticated with check(
  bucket_id='merlin-files' and public.learning_file_access(name,true) and exists(
    select 1 from public.learning_files f where f.object_path=name and f.status='pending'
      and f.uploaded_by=auth.uid() and f.created_at>now()-interval '15 minutes'));
create policy merlin_object_delete on storage.objects for delete to authenticated
  using(bucket_id='merlin-files' and public.learning_file_access(name,true));

create function public.learning_reserve_file(kind text,target uuid,filename text,mimetype text,bytes bigint)
returns public.learning_files language plpgsql security definer set search_path='' as $$
declare inst uuid; cid uuid; result public.learning_files; fid uuid=gen_random_uuid();
begin
  if kind='material' then
    select institution_id,course_id into inst,cid from public.learning_materials where id=target for update;
  elsif kind='assignment' then
    select institution_id,course_id into inst,cid from public.learning_assignments where id=target for update;
  else raise exception 'LEARNING_INVALID'; end if;
  if cid is null or not public.course_staff(inst,cid) then raise exception 'LEARNING_FORBIDDEN'; end if;
  if (select count(*) from public.learning_files where material_id=target or assignment_id=target)>=20 then raise exception 'LEARNING_FILE_LIMIT'; end if;
  insert into public.learning_files(id,institution_id,course_id,material_id,assignment_id,object_path,file_name,mime_type,byte_size,uploaded_by)
  values(fid,inst,cid,case when kind='material' then target end,case when kind='assignment' then target end,
    cid::text||'/'||fid::text||'/attachment',filename,mimetype,bytes,auth.uid()) returning * into result;
  return result;
end; $$;

create function public.learning_complete_file(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public.learning_files; obj storage.objects;
begin
  select * into f from public.learning_files where id=target for update;
  if f.id is null or f.uploaded_by<>auth.uid() or not public.learning_file_access(f.object_path,true) then raise exception 'LEARNING_FORBIDDEN'; end if;
  if f.status='ready' then return; end if;
  select * into obj from storage.objects where bucket_id='merlin-files' and name=f.object_path;
  if obj.id is null or (obj.metadata->>'size')::bigint is distinct from f.byte_size
    or obj.metadata->>'mimetype' is distinct from f.mime_type then raise exception 'LEARNING_FILE_MISMATCH'; end if;
  update public.learning_files set status='ready' where id=f.id;
end; $$;

create function public.learning_remove_file(target uuid) returns void language plpgsql security definer set search_path='' as $$
declare f public.learning_files;
begin
  select * into f from public.learning_files where id=target for update;
  if f.id is null or not public.learning_file_access(f.object_path,true) then raise exception 'LEARNING_FORBIDDEN'; end if;
  if exists(select 1 from storage.objects where bucket_id='merlin-files' and name=f.object_path) then raise exception 'LEARNING_FILE_PRESENT'; end if;
  delete from public.learning_files where id=f.id;
end; $$;

revoke execute on function public.learning_file_access(text,boolean),public.learning_reserve_file(text,uuid,text,text,bigint),public.learning_complete_file(uuid),public.learning_remove_file(uuid) from public,anon;
grant execute on function public.learning_file_access(text,boolean),public.learning_reserve_file(text,uuid,text,text,bigint),public.learning_complete_file(uuid),public.learning_remove_file(uuid) to authenticated;
notify pgrst,'reload schema';
