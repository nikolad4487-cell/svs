-- First enrollment is performed in ISVU; it does not require a prior university record in e-Matica.
alter table public.admission_import_mappings
 add column mode text not null default 'recorded' check(mode in ('recorded','first')),
 alter column source_school_id drop not null,
 alter column source_program_id drop not null,
 alter column source_year_id drop not null,
 alter column candidate_year_id drop not null,
 add constraint recorded_admission_source check(mode='first' or (source_school_id is not null and source_program_id is not null and source_year_id is not null and candidate_year_id is not null));
create unique index first_admission_program_year on public.admission_import_mappings(institution_id,program_id,academic_year_id) where mode='first';
alter table public.admission_import_reviews alter column source_choice_id drop not null,
 add column admission_approved boolean not null default false;
create or replace function public.stamp_admission_review() returns trigger language plpgsql set search_path='' as $$
declare workflow text;
begin
 new.reviewed_by=auth.uid();new.reviewed_at=now();
 select revision,mode into new.mapping_revision,workflow from public.admission_import_mappings where id=new.mapping_id;
 if workflow='recorded' and new.source_choice_id is null then raise exception 'Accepted choice required';end if;
 if workflow='first' and new.source_student_id<>new.candidate_id then raise exception 'Source student mismatch';end if;
 return new;
end; $$;
create or replace function public.check_admission_mapping() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if row(new.mode,new.institution_id,new.program_id,new.academic_year_id,new.source_school_id,new.source_program_id,new.source_year_id,new.candidate_year_id) is distinct from row(old.mode,old.institution_id,old.program_id,old.academic_year_id,old.source_school_id,old.source_program_id,old.source_year_id,old.candidate_year_id) and exists(select 1 from public.admission_import_jobs where mapping_id=old.id) then raise exception 'Mapping already has jobs';end if;
  if to_jsonb(new)-'revision' is distinct from to_jsonb(old)-'revision' then new.revision=old.revision+1;else new.revision=old.revision;end if;
 else new.revision=1;end if;
 if new.enabled and not public.institution_email_allowed(new.institution_id,'check@'||new.domain) then raise exception 'Domain not allowed' using errcode='23514';end if;
 return new;
end; $$;
