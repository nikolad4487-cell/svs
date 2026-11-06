-- Registrar-managed admissions, official dossiers and annual records.
-- Self-reported student_reports remain separate from verified institutional data.
create table public.student_records (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 student_id uuid not null references public.profiles(id),
 local_number text not null default ('LOC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16))),
 legal_name text not null check(length(btrim(legal_name)) between 2 and 200), birth_date date,
 citizenship text not null default '' check(length(citizenship)<=100),
 jmbag text not null default '' check(jmbag='' or jmbag ~ '^[0-9]{10}$'),
 oib text not null default '' check(oib='' or oib ~ '^[0-9]{11}$'),
 identity_reference text not null default '' check(length(identity_reference)<=300),
 revision integer not null default 1, updated_by uuid references public.profiles(id),updated_at timestamptz not null default now(),
 unique(institution_id,student_id),unique(institution_id,local_number),
 check((jmbag='' and oib='') or length(btrim(identity_reference))>=3)
);
create unique index institutional_jmbag on public.student_records(institution_id,jmbag) where jmbag<>'';
create unique index institutional_oib on public.student_records(institution_id,oib) where oib<>'';
create table public.student_year_records (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),
 student_id uuid not null references public.profiles(id),academic_year_id uuid not null,
 details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=12000),
 revision integer not null default 1,updated_by uuid references public.profiles(id),updated_at timestamptz not null default now(),
 unique(institution_id,student_id,academic_year_id),
 foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id)
);
create table public.registrar_enrollment_cases (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),
 student_id uuid not null references public.profiles(id),program_id uuid not null,academic_year_id uuid not null,
 kind text not null check(kind in ('first_matura','first_selection','next_year','repeat','transfer','parallel','postgraduate','continuation')),
 study_year integer not null check(study_year between 1 and 8),mode text not null check(mode in ('full_time','part_time')),
 financing text not null check(length(btrim(financing)) between 2 and 300),
 admission_number text not null default '' check(length(admission_number)<=100),
 decision_reference text not null check(length(btrim(decision_reference)) between 3 and 300),
 source_institution text not null default '' check(length(source_institution)<=300),
 previous_study_id uuid,winter_semester integer check(winter_semester between 1 and 16),summer_semester integer check(summer_semester between 1 and 16),
 documents_verified boolean not null default false,conditions_verified boolean not null default false,
 matura_verified boolean not null default false,qualification_verified boolean not null default false,
 state text not null default 'draft' check(state in ('draft','approved','enrolled','cancelled')),
 revision integer not null default 1,study_id uuid,
 created_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),
 unique(institution_id,student_id,program_id,academic_year_id),unique(institution_id,id),
 foreign key(institution_id,program_id) references public.study_programs(institution_id,id),
 foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id),
 foreign key(institution_id,previous_study_id,student_id) references public.student_studies(institution_id,id,student_id),
 foreign key(institution_id,study_id,student_id) references public.student_studies(institution_id,id,student_id)
);
create table public.registrar_case_events (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null,case_id uuid not null,
 actor_id uuid not null references public.profiles(id),action text not null,reason text not null check(length(btrim(reason)) between 10 and 1000),
 occurred_at timestamptz not null default now(),foreign key(institution_id,case_id) references public.registrar_enrollment_cases(institution_id,id)
);
create index registrar_cases_lookup on public.registrar_enrollment_cases(institution_id,state,academic_year_id);
create index registrar_case_history on public.registrar_case_events(case_id,occurred_at);
do $$ declare t text;begin
 foreach t in array array['student_records','student_year_records','registrar_enrollment_cases','registrar_case_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy registrar_read on public.%I for select to authenticated using(public.academic_manager(institution_id))',t);
  execute format('create trigger registrar_audit after insert or update or delete on public.%I for each row execute function public.audit_identity_change()',t);
 end loop;
end $$;
create policy student_own_record on public.student_records for select to authenticated using(student_id=auth.uid() and public.has_role(institution_id));
create policy student_own_year on public.student_year_records for select to authenticated using(student_id=auth.uid() and public.has_role(institution_id));
-- Case decisions and internal references are staff-only. Students see their resulting studies and verified annual records.

-- Registrars need a roster before the first study exists; this does not allow role changes.
create policy registrar_student_roster on public.memberships for select to authenticated using(role='student' and public.academic_manager(institution_id));
create policy registrar_student_names on public.profiles for select to authenticated using(
 exists(select 1 from public.memberships m where m.user_id=profiles.id and m.role='student' and public.academic_manager(m.institution_id)));

create function public.registrar_save_record(inst uuid, target uuid, expected_revision integer, data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r public.student_records;
begin
 if not public.academic_manager(inst) or not public.is_institution_student(inst,target) then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.profiles where id=target for update;
 select * into r from public.student_records where institution_id=inst and student_id=target for update;
 if coalesce(r.revision,0)<>expected_revision then raise exception 'REGISTRAR_STALE';end if;
 insert into public.student_records(institution_id,student_id,legal_name,birth_date,citizenship,jmbag,oib,identity_reference,updated_by)
 values(inst,target,btrim(data->>'legal_name'),nullif(data->>'birth_date','')::date,coalesce(data->>'citizenship',''),coalesce(data->>'jmbag',''),coalesce(data->>'oib',''),coalesce(data->>'identity_reference',''),auth.uid())
 on conflict(institution_id,student_id) do update set legal_name=excluded.legal_name,birth_date=excluded.birth_date,citizenship=excluded.citizenship,
 jmbag=excluded.jmbag,oib=excluded.oib,identity_reference=excluded.identity_reference,revision=public.student_records.revision+1,updated_by=auth.uid(),updated_at=now();
end; $$;
create function public.registrar_save_year(inst uuid,target uuid,year_id uuid,expected_revision integer,data jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare r public.student_year_records;
begin
 if not public.academic_manager(inst) or not public.is_institution_student(inst,target) then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.profiles where id=target for update;
 if jsonb_typeof(data)<>'object' or exists(select 1 from jsonb_each(data) e where jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>300
  or e.key not in ('residence_country','residence_city','residence_postcode','residence_address','residence_confirmation_date','housing_city','housing_address','housing_status','health_insurance','marital_status','scholarship','mother_education','mother_occupation','mother_employment','father_education','father_occupation','father_employment','supporter','supporter_occupation','supporter_employment')) then raise exception 'REGISTRAR_CHECKS';end if;
 if coalesce(data->>'residence_confirmation_date','')<>'' then perform (data->>'residence_confirmation_date')::date;end if;
 if not exists(select 1 from public.student_studies where institution_id=inst and student_id=target and academic_year_id=year_id) then raise exception 'Godišnji upis ne postoji.';end if;
 select * into r from public.student_year_records where institution_id=inst and student_id=target and academic_year_id=year_id for update;
 if coalesce(r.revision,0)<>expected_revision then raise exception 'REGISTRAR_STALE';end if;
 insert into public.student_year_records(institution_id,student_id,academic_year_id,details,updated_by) values(inst,target,year_id,data,auth.uid())
 on conflict(institution_id,student_id,academic_year_id) do update set details=excluded.details,revision=public.student_year_records.revision+1,updated_by=auth.uid(),updated_at=now();
end; $$;

create function public.registrar_case_integrity() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.study_programs;previous public.student_studies;prev_start date;next_start date;
begin
 select * into p from public.study_programs where id=new.program_id and institution_id=new.institution_id;
 if not found or not public.is_institution_student(new.institution_id,new.student_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if new.study_year>p.duration_years then raise exception 'REGISTRAR_PREVIOUS';end if;
 if new.kind in ('first_matura','first_selection') and new.study_year<>1 then raise exception 'REGISTRAR_PREVIOUS';end if;
 if new.kind='postgraduate' and (greatest(coalesce(new.winter_semester,0),coalesce(new.summer_semester,0))>p.duration_years*2 or (new.winter_semester is not null and new.winter_semester=new.summer_semester) or p.degree<>'Poslijediplomski' or (new.winter_semester is null and new.summer_semester is null)
  or new.study_year<>ceil(least(coalesce(new.winter_semester,99),coalesce(new.summer_semester,99))/2.0)) then raise exception 'REGISTRAR_POSTGRADUATE';end if;
 if p.degree='Poslijediplomski' and new.kind<>'postgraduate' then raise exception 'REGISTRAR_POSTGRADUATE';end if;
 if new.kind='transfer' and length(btrim(new.source_institution))<2 then raise exception 'REGISTRAR_CHECKS';end if;
 if new.kind in ('next_year','repeat','continuation') then
  select * into previous from public.student_studies where id=new.previous_study_id and institution_id=new.institution_id and student_id=new.student_id and program_id=new.program_id;
  if not found or previous.completion_status<>'completed' then raise exception 'REGISTRAR_PREVIOUS';end if;
  select starts_on into prev_start from public.academic_years where id=previous.academic_year_id;
  select starts_on into next_start from public.academic_years where id=new.academic_year_id;
  if next_start<=prev_start or (new.kind='next_year' and new.study_year<>previous.study_year+1)
   or (new.kind='repeat' and new.study_year<>previous.study_year) then raise exception 'REGISTRAR_PREVIOUS';end if;
 end if;
 if new.state in ('approved','enrolled') and (not new.documents_verified or not new.conditions_verified
  or (new.kind='first_matura' and not new.matura_verified) or (new.kind in ('postgraduate','first_selection') and not new.qualification_verified)) then raise exception 'REGISTRAR_CHECKS';end if;
 return new;
end; $$;
create trigger registrar_case_integrity before insert or update on public.registrar_enrollment_cases for each row execute function public.registrar_case_integrity();

create function public.registrar_save_case(inst uuid,target uuid,expected_revision integer,data jsonb,reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.registrar_enrollment_cases;result uuid;student uuid;
begin
 if not public.academic_manager(inst) then raise exception 'Forbidden' using errcode='42501';end if;
 student=(data->>'student_id')::uuid;
 if reason is null or length(btrim(reason)) not between 10 and 1000 then raise exception 'REGISTRAR_CHECKS';end if;
 perform 1 from public.profiles where id=student for update;
 if target is not null then
  select * into r from public.registrar_enrollment_cases where id=target and institution_id=inst for update;
  if not found then raise exception 'Forbidden' using errcode='42501';end if;
  if r.state<>'draft' or r.revision<>expected_revision then raise exception 'REGISTRAR_STALE';end if;
  if row(r.student_id,r.program_id,r.academic_year_id) is distinct from row(student,(data->>'program_id')::uuid,(data->>'academic_year_id')::uuid)
   then raise exception 'REGISTRAR_EXISTING';end if;
 elsif expected_revision<>0 then raise exception 'REGISTRAR_STALE';end if;
 insert into public.registrar_enrollment_cases(id,institution_id,student_id,program_id,academic_year_id,kind,study_year,mode,financing,admission_number,decision_reference,source_institution,previous_study_id,winter_semester,summer_semester,created_by)
 values(coalesce(target,gen_random_uuid()),inst,student,(data->>'program_id')::uuid,(data->>'academic_year_id')::uuid,data->>'kind',(data->>'study_year')::integer,data->>'mode',data->>'financing',coalesce(data->>'admission_number',''),data->>'decision_reference',coalesce(data->>'source_institution',''),nullif(data->>'previous_study_id','')::uuid,nullif(data->>'winter_semester','')::integer,nullif(data->>'summer_semester','')::integer,auth.uid())
 on conflict(id) do update set kind=excluded.kind,study_year=excluded.study_year,mode=excluded.mode,financing=excluded.financing,
 admission_number=excluded.admission_number,decision_reference=excluded.decision_reference,source_institution=excluded.source_institution,previous_study_id=excluded.previous_study_id,winter_semester=excluded.winter_semester,summer_semester=excluded.summer_semester,
 revision=public.registrar_enrollment_cases.revision+1,updated_at=now() returning id into result;
 insert into public.registrar_case_events(institution_id,case_id,actor_id,action,reason) values(inst,result,auth.uid(),case when target is null then 'created' else 'edited' end,btrim(reason));
 return result;
end; $$;

create function public.registrar_decide_case(target uuid,expected_revision integer,next_state text,checks jsonb,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.registrar_enrollment_cases;
begin
 select * into r from public.registrar_enrollment_cases where id=target;
 if not found or not public.academic_manager(r.institution_id) then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.profiles where id=r.student_id for update;
 select * into r from public.registrar_enrollment_cases where id=target for update;
 if r.revision<>expected_revision then raise exception 'REGISTRAR_STALE';end if;
 if reason is null or length(btrim(reason)) not between 10 and 1000 then raise exception 'REGISTRAR_CHECKS';end if;
 if not((r.state='draft' and next_state in ('approved','cancelled')) or (r.state='approved' and next_state in ('draft','cancelled')) or (r.state='cancelled' and next_state='draft')) then raise exception 'REGISTRAR_STALE';end if;
 update public.registrar_enrollment_cases set state=next_state,
 documents_verified=coalesce((checks->>'documents_verified')::boolean,false),conditions_verified=coalesce((checks->>'conditions_verified')::boolean,false),
 matura_verified=coalesce((checks->>'matura_verified')::boolean,false),qualification_verified=coalesce((checks->>'qualification_verified')::boolean,false),revision=r.revision+1,updated_at=now() where id=r.id;
 insert into public.registrar_case_events(institution_id,case_id,actor_id,action,reason) values(r.institution_id,r.id,auth.uid(),next_state,btrim(reason));
end; $$;

create function public.registrar_enroll_case(target uuid,expected_revision integer,selected_courses uuid[],reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.registrar_enrollment_cases;s public.student_studies;rec public.student_records;cid uuid;result uuid;
begin
 select * into r from public.registrar_enrollment_cases where id=target;
 if not found or not public.academic_manager(r.institution_id) then raise exception 'Forbidden' using errcode='42501';end if;
 perform 1 from public.profiles where id=r.student_id for update;
 select * into r from public.registrar_enrollment_cases where id=target for update;
 if r.state<>'approved' or r.revision<>expected_revision then raise exception 'REGISTRAR_STALE';end if;
 if reason is null or length(btrim(reason)) not between 10 and 1000 then raise exception 'REGISTRAR_CHECKS';end if;
 if coalesce(cardinality(selected_courses),0) not between 1 and 100 or cardinality(selected_courses)<>(select count(distinct x) from unnest(selected_courses) x) then raise exception 'REGISTRAR_COURSES';end if;
 -- Validate the entire batch before inserting any course or study.
 if exists(select 1 from unnest(selected_courses) x left join public.courses c on c.id=x
  left join public.semesters sem on sem.id=c.semester_id
  where c.id is null or c.institution_id<>r.institution_id or c.program_id<>r.program_id or sem.academic_year_id<>r.academic_year_id)
  then raise exception 'REGISTRAR_COURSES';end if;
 if not exists(select 1 from public.student_records where institution_id=r.institution_id and student_id=r.student_id) and not exists(select 1 from public.profiles where id=r.student_id and length(btrim(full_name))>=2) then raise exception 'REGISTRAR_IDENTITY';end if;
 insert into public.student_records(institution_id,student_id,legal_name,updated_by)
 select r.institution_id,r.student_id,coalesce(nullif(btrim(full_name),''),'Student'),auth.uid() from public.profiles where id=r.student_id on conflict(institution_id,student_id) do nothing;
 select * into rec from public.student_records where institution_id=r.institution_id and student_id=r.student_id;
 select * into s from public.student_studies where institution_id=r.institution_id and student_id=r.student_id and program_id=r.program_id and academic_year_id=r.academic_year_id for update;
 if found then
  if s.completion_status not in ('draft','pending_verification') or s.study_year<>r.study_year or s.status<>'active' then raise exception 'REGISTRAR_EXISTING';end if;
  result=s.id;
 else
  insert into public.student_studies(institution_id,student_id,program_id,academic_year_id,study_year,student_number,status)
  values(r.institution_id,r.student_id,r.program_id,r.academic_year_id,r.study_year,rec.local_number,'active') returning id into result;
 end if;
 foreach cid in array selected_courses loop
  insert into public.course_enrollments(institution_id,study_id,course_id,student_id) values(r.institution_id,result,cid,r.student_id) on conflict(institution_id,course_id,student_id) do nothing;
 end loop;
 insert into public.student_year_records(institution_id,student_id,academic_year_id,updated_by) values(r.institution_id,r.student_id,r.academic_year_id,auth.uid()) on conflict(institution_id,student_id,academic_year_id) do nothing;
 update public.registrar_enrollment_cases set state='enrolled',study_id=result,revision=r.revision+1,updated_at=now() where id=r.id;
 insert into public.registrar_case_events(institution_id,case_id,actor_id,action,reason) values(r.institution_id,r.id,auth.uid(),'enrolled',btrim(reason));
 return result;
end; $$;

revoke execute on function public.registrar_case_integrity() from public,anon,authenticated;
revoke execute on function public.registrar_save_record(uuid,uuid,integer,jsonb),public.registrar_save_year(uuid,uuid,uuid,integer,jsonb),public.registrar_save_case(uuid,uuid,integer,jsonb,text),public.registrar_decide_case(uuid,integer,text,jsonb,text),public.registrar_enroll_case(uuid,integer,uuid[],text) from public,anon;
grant execute on function public.registrar_save_record(uuid,uuid,integer,jsonb),public.registrar_save_year(uuid,uuid,uuid,integer,jsonb),public.registrar_save_case(uuid,uuid,integer,jsonb,text),public.registrar_decide_case(uuid,integer,text,jsonb,text),public.registrar_enroll_case(uuid,integer,uuid[],text) to authenticated;

-- Source credentials remain server-side; actual enrollment is available to scoped registrar staff.
do $$ declare t text;begin foreach t in array array['admission_import_mappings','admission_import_reviews'] loop
 execute format('drop policy system_admin on public.%I',t);
 execute format('create policy admission_staff on public.%I for all to authenticated using(public.academic_manager(institution_id)) with check(public.academic_manager(institution_id))',t);
end loop;end $$;
drop policy import_jobs_read on public.admission_import_jobs;
create policy import_jobs_read on public.admission_import_jobs for select to authenticated using(public.academic_manager(institution_id));
create or replace function public.claim_admission_import(mapping uuid,candidate uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare job uuid;inst uuid;begin
 select institution_id into inst from public.admission_import_mappings where id=mapping and enabled;
 if inst is null or (not public.academic_manager(inst) and coalesce(auth.jwt()->>'role','')<>'service_role') then raise exception 'Forbidden' using errcode='42501';end if;
 insert into public.admission_import_jobs(mapping_id,institution_id,candidate_id,state,requested_by)
 values(mapping,inst,candidate,'running',auth.uid())
 on conflict(mapping_id,candidate_id) do update set state='running',updated_at=now(),requested_by=auth.uid()
 where public.admission_import_jobs.state='failed' returning id into job;
 return job;
end; $$;

-- Registrar can onboard students on approved institution domains, never staff roles.
create policy registrar_student_invites_read on public.registration_invites for select to authenticated
 using(role='student' and public.academic_manager(institution_id));
create policy registrar_student_invites_create on public.registration_invites for insert to authenticated
 with check(role='student' and created_by=auth.uid() and public.academic_manager(institution_id));
create or replace function public.claim_pending_credentials(invite_id uuid)
returns table(email text, institution_id uuid, existing_user_id uuid)
language plpgsql security definer set search_path='' as $$
declare invitation public.registration_invites; auth_user auth.users;
begin
 select * into invitation from public.registration_invites v where v.id=invite_id for update;
 if invitation.id is null or not (public.is_superadmin() or (invitation.role='student' and public.academic_manager(invitation.institution_id))) then raise exception 'Forbidden' using errcode='42501';end if;
 if not public.is_superadmin() and exists(select 1 from public.registration_invites v where v.email=invitation.email and v.role<>'student' and v.accepted_at is null and v.expires_at>now()) then raise exception 'Forbidden' using errcode='42501';end if;
 if invitation.accepted_at is not null or invitation.expires_at<=now() or invitation.credentials_issued_at is not null
 or not public.institution_email_allowed(invitation.institution_id,invitation.email) then raise exception 'Invitation unavailable' using errcode='23514';end if;
 select * into auth_user from auth.users u where lower(u.email)=invitation.email;
 if not public.is_superadmin() and exists(select 1 from public.memberships m where m.user_id=auth_user.id and m.role<>'student') then raise exception 'Forbidden' using errcode='42501';end if;
 if auth_user.email_confirmed_at is not null then raise exception 'Account already confirmed' using errcode='23514';end if;
 update public.registration_invites v set credentials_issued_at=now() where v.id=invite_id;
 return query select invitation.email,invitation.institution_id,auth_user.id;
end; $$;

-- Minimal Auth data needed to distinguish students with an initial, unnamed account.
create function public.registrar_student_roster(inst uuid)
returns table(id uuid,full_name text,email text) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.academic_manager(inst) then raise exception 'Forbidden' using errcode='42501';end if;
 return query select p.id,p.full_name,coalesce(u.email,'')::text from public.memberships m
 join public.profiles p on p.id=m.user_id join auth.users u on u.id=p.id
 where m.institution_id=inst and m.role='student' order by p.full_name,p.id;
end; $$;
revoke execute on function public.registrar_student_roster(uuid) from public,anon;
grant execute on function public.registrar_student_roster(uuid) to authenticated;

notify pgrst, 'reload schema';
