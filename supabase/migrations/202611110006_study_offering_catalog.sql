-- The institution address column must not shadow the existing email argument.
create or replace function public.institution_email_allowed(inst uuid, address text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.institutions i where i.id=$1 and i.active
 and $2 ~ '^[^@]+@[^@]+$' and lower(split_part($2,'@',2))=any(i.email_domains));
$$;

-- Preserve unknown source metadata instead of inventing durations or study levels.
alter table public.study_programs alter column duration_years drop not null;
alter table public.study_programs drop constraint study_programs_name_check;
alter table public.study_programs add constraint study_programs_name_check check(length(name) between 2 and 1000);
alter table public.study_programs
 add column catalog_source_key text unique,
 add column catalog_source jsonb not null default '{}' check(jsonb_typeof(catalog_source)='object' and octet_length(catalog_source::text)<=256000),
 add column catalog_requires_review boolean not null default false;

create function public.require_program_metadata() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.study_programs p where p.id=new.program_id and p.institution_id=new.institution_id and (p.duration_years is null or p.degree='Nije navedeno')) then raise exception 'REGISTRAR_PROGRAM';end if;
 return new;
end $$;
create trigger program_metadata_required before insert or update of program_id,institution_id on public.student_studies for each row execute function public.require_program_metadata();
create trigger program_metadata_required before insert or update of program_id,institution_id on public.registrar_enrollment_cases for each row execute function public.require_program_metadata();

create function public.import_study_offerings_2024(institution_rows jsonb,program_rows jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;inst public.institutions;existing public.study_programs;parent_id uuid;inst_id uuid;key text;candidate text;counter integer;matched integer;
 added_institutions integer=0;added_programs integer=0;linked_programs integer=0;
begin
 if not (public.is_superadmin() or auth.role()='service_role' or (auth.role() is null and session_user in ('postgres','supabase_admin'))) then raise exception 'Forbidden' using errcode='42501';end if;
 if jsonb_typeof(institution_rows) is distinct from 'array' or jsonb_array_length(institution_rows)>500 or jsonb_typeof(program_rows) is distinct from 'array' or jsonb_array_length(program_rows) not between 1 and 3000 then raise exception 'Invalid source catalogue';end if;
 if (select count(distinct r->>'registry_key') from jsonb_array_elements(institution_rows) r)<>jsonb_array_length(institution_rows) or (select count(distinct r->>'catalog_source_key') from jsonb_array_elements(program_rows) r)<>jsonb_array_length(program_rows) then raise exception 'Duplicate source keys';end if;
 perform pg_advisory_xact_lock(20261111,2024);
 for item in select value from jsonb_array_elements(institution_rows) loop
  key=item->>'registry_key';
  if key is null or key !~ '^pdf-admissions-2024:institution:[a-f0-9]{16}$' or length(item->>'name') not between 2 and 200 then raise exception 'Invalid source institution';end if;
  select * into inst from public.institutions where registry_key=key for update;
  if inst.id is not null then continue;end if;
  -- Match existing records only with the reviewed stable source key; never merge namesakes.
  candidate=item->>'subdomain';counter=0;
  if not public.valid_institution_subdomain(candidate) then raise exception 'Invalid source subdomain';end if;
  while exists(select 1 from public.institutions where subdomain=candidate) loop
   counter=counter+1;candidate=left(item->>'subdomain',48)||'-'||right(key,6)||case when counter>1 then '-'||counter::text else '' end;
   if counter>1000 then raise exception 'No free source subdomain';end if;
  end loop;
  parent_id=null;
  if nullif(item->>'parent_registry_key','') is not null then
   select id into parent_id from public.institutions where registry_key=item->>'parent_registry_key';
   if parent_id is null then raise exception 'Source parent institution is missing';end if;
  end if;
  if exists(select 1 from public.institutions where lower(btrim(name))=lower(btrim(item->>'name')) and parent_institution_id is not distinct from parent_id) then raise exception 'Institution already exists without the reviewed source key; review the mapping: %',item->>'name';end if;
  insert into public.institutions(id,name,code,headquarters,url_slug,registry_key,registry_name,short_name,parent_institution_id,parent_name,subdomain,domain_origin,domain_notes,source_snapshot)
   values((item->>'id')::uuid,item->>'name',item->>'code',item->>'headquarters',candidate,key,item->>'name',upper(candidate),parent_id,item->>'parent_name',candidate,'provisional_abbreviation','Ustanova ili odjel iz dostavljenog popisa ponude 2024.; kratica i sjedište čekaju provjeru.',item);
  added_institutions=added_institutions+1;
 end loop;
 for item in select value from jsonb_array_elements(program_rows) loop
  key=item->>'catalog_source_key';
  if key is null or key !~ '^pdf-admissions-2024:program:[a-f0-9]{24}$' or length(item->>'name') not between 2 and 1000 or length(item->>'code') not between 2 and 30
   or jsonb_typeof(item->'catalog_source') is distinct from 'object' or item->'catalog_source'->>'source_year'<>'2024' then raise exception 'Invalid source programme';end if;
  select id into inst_id from public.institutions where registry_key=item->>'institution_key';
  if inst_id is null then raise exception 'Source programme institution is missing';end if;
  select * into existing from public.study_programs where catalog_source_key=key for update;
  if existing.id is not null and existing.institution_id<>inst_id then raise exception 'Source programme belongs to another institution';end if;
  if existing.id is null then
   select count(*) into matched from public.study_programs where institution_id=inst_id and lower(btrim(regexp_replace(name,'\s+',' ','g')))=lower(btrim(regexp_replace(item->>'name','\s+',' ','g')));
   if matched>1 then raise exception 'Ambiguous existing programme: %',item->>'name';end if;
   select * into existing from public.study_programs where institution_id=inst_id and lower(btrim(regexp_replace(name,'\s+',' ','g')))=lower(btrim(regexp_replace(item->>'name','\s+',' ','g'))) for update;
   if existing.id is not null and existing.catalog_source_key is not null then raise exception 'Programme already linked to another source identity';end if;
  end if;
  if existing.id is null then
   insert into public.study_programs(id,institution_id,name,code,degree,duration_years,catalog_source_key,catalog_source,catalog_requires_review)
    values((item->>'id')::uuid,inst_id,item->>'name',item->>'code','Nije navedeno',null,key,item->'catalog_source',coalesce((item->>'catalog_requires_review')::boolean,false));
   added_programs=added_programs+1;
  else
   -- Do not overwrite names, duration, degree, IDs or staff edits, including established student links.
   update public.study_programs set catalog_source_key=key,catalog_source=item->'catalog_source',catalog_requires_review=coalesce((item->>'catalog_requires_review')::boolean,false)
    where id=existing.id and (catalog_source_key is distinct from key or catalog_source is distinct from item->'catalog_source' or catalog_requires_review is distinct from coalesce((item->>'catalog_requires_review')::boolean,false));
   linked_programs=linked_programs+1;
  end if;
 end loop;
 return jsonb_build_object('added_institutions',added_institutions,'added_programs',added_programs,'linked_existing_programs',linked_programs,'processed_programs',jsonb_array_length(program_rows));
end $$;
revoke execute on function public.require_program_metadata(),public.import_study_offerings_2024(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_study_offerings_2024(jsonb,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
