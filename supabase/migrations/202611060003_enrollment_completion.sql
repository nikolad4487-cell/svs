-- Administrative completion is distinct from active/completed/paused study status.
alter table public.student_studies
 add column completion_status text not null default 'legacy_unverified'
 check(completion_status in ('legacy_unverified','draft','pending_verification','completed','cancelled')),
 add column identity_verified boolean not null default false,
 add column documents_verified boolean not null default false,
 add column curriculum_verified boolean not null default false,
 add column financing_verified boolean not null default false,
 add column completion_revision integer not null default 0,
 add column completed_by uuid references public.profiles(id),
 add column completed_at timestamptz;
alter table public.student_studies alter column completion_status set default 'draft';
alter table public.student_studies add constraint completion_evidence check(
 completion_status<>'completed' or (identity_verified and documents_verified and curriculum_verified and financing_verified and completed_by is not null and completed_at is not null));

create table public.enrollment_completion_events (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null,
 study_id uuid not null,
 student_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 previous_status text not null,
 next_status text not null,
 identity_verified boolean not null,
 documents_verified boolean not null,
 curriculum_verified boolean not null,
 financing_verified boolean not null,
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 occurred_at timestamptz not null default now(),
 foreign key(institution_id,study_id,student_id) references public.student_studies(institution_id,id,student_id)
);
create index enrollment_completion_events_study on public.enrollment_completion_events(study_id,occurred_at);
alter table public.enrollment_completion_events enable row level security;
revoke all on public.enrollment_completion_events from public,anon,authenticated;
grant select on public.enrollment_completion_events to authenticated;
create policy enrollment_events_read on public.enrollment_completion_events for select to authenticated
 using(public.academic_manager(institution_id));
revoke insert,update on public.student_studies from authenticated;
grant insert(id,institution_id,student_id,program_id,academic_year_id,study_year,student_number,status),
 update(student_id,program_id,academic_year_id,study_year,student_number,status) on public.student_studies to authenticated;

create function public.enrollment_completion_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.student_studies;
begin
 if TG_TABLE_NAME='student_studies' then
  if TG_OP='DELETE' then
   if old.completion_status='completed' then raise exception 'Dovršeni upis nije dopušteno izbrisati.'; end if;
   return old;
  end if;
  perform 1 from public.profiles where id=new.student_id for update;
  if TG_OP='UPDATE' and old.completion_status='completed' and
   row(new.student_id,new.program_id,new.academic_year_id,new.study_year,new.student_number)
   is distinct from row(old.student_id,old.program_id,old.academic_year_id,old.study_year,old.student_number)
   then raise exception 'Najprije ponovno otvorite provjeru upisa.'; end if;
  if TG_OP='INSERT' or (TG_OP='UPDATE' and row(new.student_id,new.program_id,new.academic_year_id) is distinct from row(old.student_id,old.program_id,old.academic_year_id)) then
   if exists(select 1 from public.student_studies previous
    join public.academic_years previous_year on previous_year.id=previous.academic_year_id
    join public.academic_years next_year on next_year.id=new.academic_year_id
    where previous.student_id=new.student_id and previous.institution_id=new.institution_id and previous.program_id=new.program_id
    and previous_year.starts_on<next_year.starts_on and previous.completion_status not in ('completed','cancelled'))
    then raise exception 'Prethodni upis nije administrativno dovršen.'; end if;
  end if;
  return new;
 end if;
 -- Lock all affected study rows in a stable order when moving a course enrollment.
 if TG_OP<>'INSERT' then
  perform 1 from public.profiles where id=old.student_id for update;
 end if;
 if TG_OP<>'DELETE' then
  perform 1 from public.profiles where id=new.student_id for update;
 end if;
 for s in select * from public.student_studies where
  id=case when TG_OP='DELETE' then old.study_id else new.study_id end
  or (TG_OP='UPDATE' and id=old.study_id) order by id for update
 loop
  if s.completion_status in ('completed','cancelled') then raise exception 'Najprije ponovno otvorite provjeru upisa.'; end if;
 end loop;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger enrollment_completion_guard before insert or update or delete on public.student_studies
 for each row execute function public.enrollment_completion_guard();
create trigger enrollment_completion_guard before insert or update or delete on public.course_enrollments
 for each row execute function public.enrollment_completion_guard();

create function public.complete_enrollment(target uuid,expected_revision integer,next_status text,
 identity_checked boolean,documents_checked boolean,curriculum_checked boolean,financing_checked boolean,reason text)
 returns void language plpgsql security definer set search_path='' as $$
declare s public.student_studies;
begin
 select * into s from public.student_studies where id=target;
 if not found or not public.academic_manager(s.institution_id) then raise exception 'Nemate pravo provjere upisa.' using errcode='42501'; end if;
 perform 1 from public.profiles where id=s.student_id for update;
 select * into s from public.student_studies where id=target for update;
 if s.completion_revision<>expected_revision then raise exception 'Upis je promijenjen. Osvježite prikaz.'; end if;
 if reason is null or length(btrim(reason)) not between 10 and 1000 then raise exception 'Navedite obrazloženje od 10 do 1000 znakova.'; end if;
 if not ((s.completion_status in ('legacy_unverified','draft','completed','cancelled') and next_status='pending_verification')
  or (s.completion_status='pending_verification' and next_status in ('pending_verification','completed','cancelled'))
  or (s.completion_status='draft' and next_status='cancelled')) then raise exception 'Nedopušten prijelaz stanja upisa.'; end if;
 if next_status='completed' then
  if s.status<>'active' then raise exception 'Za dovršenje je potreban aktivan studij.'; end if;
  if not(coalesce(identity_checked,false) and coalesce(documents_checked,false) and coalesce(curriculum_checked,false) and coalesce(financing_checked,false))
   then raise exception 'Provjerite identitet, dokumente, predmetnik i financiranje.'; end if;
  if not exists(select 1 from public.course_enrollments where study_id=s.id)
   then raise exception 'Upis nema nijedan kolegij. Najprije sastavite upisni list.'; end if;
 end if;
 update public.student_studies set completion_status=next_status,
  identity_verified=coalesce(identity_checked,false),documents_verified=coalesce(documents_checked,false),
  curriculum_verified=coalesce(curriculum_checked,false),financing_verified=coalesce(financing_checked,false),
  completed_by=case when next_status='completed' then auth.uid() else null end,
  completed_at=case when next_status='completed' then now() else null end,
  completion_revision=s.completion_revision+1 where id=s.id;
 insert into public.enrollment_completion_events(institution_id,study_id,student_id,actor_id,previous_status,next_status,
 identity_verified,documents_verified,curriculum_verified,financing_verified,reason)
 values(s.institution_id,s.id,s.student_id,auth.uid(),s.completion_status,next_status,
 coalesce(identity_checked,false),coalesce(documents_checked,false),coalesce(curriculum_checked,false),coalesce(financing_checked,false),btrim(reason));
end; $$;

-- Historical enrollments keep their previous exam access until explicitly reviewed.
-- They are NOT displayed or recorded as completed and cannot be used to open a later year.
create function public.exam_enrollment_complete(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.course_enrollments e join public.student_studies s on s.id=e.study_id
 where e.course_id=target and e.student_id=auth.uid() and s.status='active' and s.completion_status in ('completed','legacy_unverified'));
$$;
revoke execute on function public.enrollment_completion_guard() from public,anon,authenticated;
revoke execute on function public.complete_enrollment(uuid,integer,text,boolean,boolean,boolean,boolean,text),public.exam_enrollment_complete(uuid) from public,anon;
grant execute on function public.complete_enrollment(uuid,integer,text,boolean,boolean,boolean,boolean,text),public.exam_enrollment_complete(uuid) to authenticated;

create or replace function public.register_exam(target uuid,cancel boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare e public.exams; existing_status text;
begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into e from public.exams where id=target for update;
 if not found or not public.enrolled(e.course_id) then raise exception 'Nemate pravo pristupa ispitu.' using errcode='42501'; end if;
 if (not cancel and e.workflow_status<>'open') or (cancel and e.workflow_status not in ('open','registration_closed'))
  then raise exception 'Stanje roka ne dopušta prijavu ili odjavu.'; end if;
 if not cancel and not public.exam_enrollment_complete(e.course_id) then raise exception 'Upis nije administrativno dovršen. Obratite se referadi.'; end if;
 if exists(select 1 from public.grades where exam_id=e.id and student_id=auth.uid()) then raise exception 'Ispit je već obrađen.'; end if;
 if cancel then
  if now()>e.withdrawal_deadline then raise exception 'Rok za odjavu je istekao.'; end if;
  update public.exam_registrations set status='cancelled' where exam_id=e.id and student_id=auth.uid() and status='registered';
 else
  if now()>e.registration_deadline then raise exception 'Rok za prijavu je istekao.'; end if;
  if exists(select 1 from public.grades g join public.exams x on x.id=g.exam_id join public.courses c on c.id=x.course_id join public.courses own on own.id=e.course_id where g.student_id=auth.uid() and g.grade>1 and c.institution_id=e.institution_id and c.code=own.code) then raise exception 'Kolegij je već položen.'; end if;
  select status into existing_status from public.exam_registrations where exam_id=e.id and student_id=auth.uid();
  if existing_status='registered' then return; end if;
  if (select count(*) from public.exam_registrations where exam_id=e.id and status='registered')>=e.capacity then raise exception 'Ispitni rok je popunjen.'; end if;
  insert into public.exam_registrations(institution_id,exam_id,student_id) values(e.institution_id,e.id,auth.uid()) on conflict(institution_id,exam_id,student_id) do update set status='registered',registered_at=now();
 end if;
end; $$;
