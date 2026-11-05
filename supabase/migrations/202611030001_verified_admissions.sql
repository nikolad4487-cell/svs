-- Only the system administrator configures and reviews cross-project admissions.
create table public.admission_import_mappings (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 program_id uuid not null, academic_year_id uuid not null,
 source_school_id text not null check(length(source_school_id) between 1 and 200),
 source_program_id uuid not null, source_year_id uuid not null, candidate_year_id uuid not null,
 domain text not null check(domain=lower(domain)), matura_required boolean not null default true,
 requirements_reference text not null check(length(requirements_reference) between 3 and 500),
 enabled boolean not null default true, revision integer not null default 1, unique(source_school_id,source_program_id,source_year_id,candidate_year_id),
 unique(id,institution_id),
 foreign key(institution_id,program_id) references public.study_programs(institution_id,id),
 foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id)
);
create table public.admission_import_reviews (
 id uuid primary key default gen_random_uuid(), mapping_id uuid not null, institution_id uuid not null,
 candidate_id uuid not null, source_student_id uuid not null, source_choice_id uuid not null, mapping_revision integer not null, graduation_verified boolean not null default false,
 matura_verified boolean not null default false, conditions_verified boolean not null default false,
 evidence_reference text not null check(length(evidence_reference) between 3 and 1000),
 reviewed_by uuid not null default auth.uid() references auth.users(id), reviewed_at timestamptz not null default now(),
 unique(mapping_id,candidate_id), foreign key(mapping_id,institution_id) references public.admission_import_mappings(id,institution_id)
);
create table public.admission_import_jobs (
 id uuid primary key default gen_random_uuid(), mapping_id uuid not null, institution_id uuid not null,
 candidate_id uuid not null, state text not null check(state in ('running','completed','failed')),
 user_id uuid references auth.users(id), study_id uuid references public.student_studies(id),
 requested_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 unique(mapping_id,candidate_id),foreign key(mapping_id,institution_id) references public.admission_import_mappings(id,institution_id)
);
create function public.stamp_admission_review() returns trigger language plpgsql set search_path='' as $$
begin new.reviewed_by=auth.uid();new.reviewed_at=now();select revision into new.mapping_revision from public.admission_import_mappings where id=new.mapping_id;return new;end; $$;
revoke execute on function public.stamp_admission_review() from public,anon,authenticated;
create trigger admission_review_actor before insert or update on public.admission_import_reviews for each row execute function public.stamp_admission_review();
create function public.check_admission_mapping() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if row(new.institution_id,new.program_id,new.academic_year_id,new.source_school_id,new.source_program_id,new.source_year_id,new.candidate_year_id) is distinct from row(old.institution_id,old.program_id,old.academic_year_id,old.source_school_id,old.source_program_id,old.source_year_id,old.candidate_year_id) and exists(select 1 from public.admission_import_jobs where mapping_id=old.id) then raise exception 'Mapping already has jobs';end if;
  if to_jsonb(new)-'revision' is distinct from to_jsonb(old)-'revision' then new.revision=old.revision+1;else new.revision=old.revision;end if;
 else new.revision=1;end if;
 if new.enabled and not public.institution_email_allowed(new.institution_id,'check@'||new.domain) then raise exception 'Domain not allowed' using errcode='23514';end if;
 return new;
end; $$;
revoke execute on function public.check_admission_mapping() from public,anon,authenticated;
create trigger admission_mapping_domain before insert or update on public.admission_import_mappings for each row execute function public.check_admission_mapping();
do $$ declare t text;begin foreach t in array array['admission_import_mappings','admission_import_reviews'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy system_admin on public.%I for all to authenticated using(public.is_superadmin()) with check(public.is_superadmin())',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create trigger admission_audit after insert or update or delete on public.%I for each row execute function public.audit_identity_change()',t);
 end loop;end; $$;
alter table public.admission_import_jobs enable row level security;
create policy import_jobs_read on public.admission_import_jobs for select to authenticated using(public.is_superadmin());
grant select on public.admission_import_jobs to authenticated;
-- Cross-project calls are not a DB transaction. A claim prevents parallel password issuance.
create function public.claim_admission_import(mapping uuid,candidate uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare job uuid;inst uuid;begin
 if not public.is_superadmin() and coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Forbidden' using errcode='42501';end if;
 select institution_id into inst from public.admission_import_mappings where id=mapping and enabled;
 if inst is null then raise exception 'Mapping unavailable';end if;
 insert into public.admission_import_jobs(mapping_id,institution_id,candidate_id,state,requested_by)
 values(mapping,inst,candidate,'running',auth.uid())
 on conflict(mapping_id,candidate_id) do update set state='running',updated_at=now(),requested_by=auth.uid()
 where public.admission_import_jobs.state='failed' returning id into job;
 return job;
end; $$;
revoke execute on function public.claim_admission_import(uuid,uuid) from public,anon;
grant execute on function public.claim_admission_import(uuid,uuid) to authenticated,service_role;
