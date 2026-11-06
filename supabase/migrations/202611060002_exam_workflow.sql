-- Additive workflow. Existing terms retain their historical entry behaviour.
alter table public.exams add column workflow_status text not null default 'open'
 check(workflow_status in ('draft','open','registration_closed','in_progress','grading','locked'));
alter table public.exams add column legacy_workflow boolean not null default true;
alter table public.exams alter column workflow_status set default 'draft';
alter table public.exams alter column legacy_workflow set default false;
alter table public.grades alter column grade drop not null;
alter table public.grades add column outcome text not null default 'graded';
alter table public.grades add constraint grade_outcome_valid check(
 (outcome='graded' and grade is not null and grade between 1 and 5)
 or (outcome='absent' and grade is null));

create table public.exam_workflow_events (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null,
 exam_id uuid not null,
 actor_id uuid not null references public.profiles(id),
 previous_status text not null,
 next_status text not null,
 reason text not null check(length(btrim(reason)) between 10 and 1000),
 occurred_at timestamptz not null default now(),
 foreign key(institution_id,exam_id) references public.exams(institution_id,id)
);
create index exam_workflow_events_term on public.exam_workflow_events(exam_id,occurred_at);
alter table public.exam_workflow_events enable row level security;
revoke all on public.exam_workflow_events from public,anon,authenticated;
grant select on public.exam_workflow_events to authenticated;
create policy exam_events_read on public.exam_workflow_events for select to authenticated
 using(public.exam_staff(institution_id,exam_id));

-- Lifecycle fields are changed exclusively through the authorized transition RPC.
revoke insert,update on public.exams from authenticated;
grant insert(institution_id,course_id,room_id,starts_at,registration_deadline,withdrawal_deadline,capacity,id),
 update(course_id,room_id,starts_at,registration_deadline,withdrawal_deadline,capacity)
 on public.exams to authenticated;

create function public.exam_lock_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.workflow_status='locked' then
  if TG_OP='DELETE' then raise exception 'Zaključani rok nije dopušteno izbrisati.'; end if;
  if (to_jsonb(new)-'workflow_status'-'legacy_workflow') is distinct from (to_jsonb(old)-'workflow_status'-'legacy_workflow')
   then raise exception 'Najprije otključajte ispitni rok uz obrazloženje.'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger exam_lock_guard before update or delete on public.exams
 for each row execute function public.exam_lock_guard();

create function public.transition_exam(target uuid, expected_status text, next_status text, reason text)
 returns void language plpgsql security definer set search_path='' as $$
declare e public.exams;
begin
 select * into e from public.exams where id=target for update;
 if not found or not public.course_staff(e.institution_id,e.course_id)
  then raise exception 'Nemate pravo upravljanja rokom.' using errcode='42501'; end if;
 if e.workflow_status<>expected_status then raise exception 'Stanje roka je promijenjeno. Osvježite prikaz.'; end if;
 if reason is null or length(btrim(reason)) not between 10 and 1000 then raise exception 'Navedite obrazloženje od 10 do 1000 znakova.'; end if;
 if e.workflow_status='locked' then
  if next_status<>'grading' or not public.academic_manager(e.institution_id)
   then raise exception 'Otključavanje je dopušteno samo administratoru ili referadi.' using errcode='42501'; end if;
 elsif not (
  (e.workflow_status='draft' and next_status='open') or
  (e.workflow_status='open' and next_status='registration_closed') or
  (e.workflow_status='registration_closed' and next_status='in_progress') or
  (e.workflow_status='in_progress' and next_status='grading') or
  (e.workflow_status='grading' and next_status='locked'))
  then raise exception 'Nedopušten prijelaz stanja roka.'; end if;
 if next_status='open' and e.registration_deadline<now() then raise exception 'Rok prijave je istekao. Uredite termin prije otvaranja.'; end if;
 if next_status in ('in_progress','grading','locked') and e.starts_at>now() then raise exception 'Ispit još nije održan.'; end if;
 if next_status='locked' and exists(
  select 1 from public.exam_registrations r where r.exam_id=e.id and r.status='registered'
  and not exists(select 1 from public.grades g where g.exam_id=e.id and g.student_id=r.student_id))
  then raise exception 'Za sve važeće prijave treba evidentirati ocjenu ili nedolazak.'; end if;
 update public.exams set workflow_status=next_status,legacy_workflow=false where id=e.id;
 insert into public.exam_workflow_events(institution_id,exam_id,actor_id,previous_status,next_status,reason)
 values(e.institution_id,e.id,auth.uid(),e.workflow_status,next_status,btrim(reason));
end; $$;

-- Serialize against transition_exam, including writes through service clients.
create function public.exam_result_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.exams; exam uuid;
begin
 if TG_OP='DELETE' then exam=old.exam_id; else exam=new.exam_id; end if;
 if TG_OP='UPDATE' and (new.exam_id<>old.exam_id or new.student_id<>old.student_id or new.institution_id<>old.institution_id)
  then raise exception 'Identitet rezultata ne može se mijenjati.'; end if;
 select * into e from public.exams where id=exam for update;
 if e.workflow_status='locked' then raise exception 'Ispitni rok je zaključan.'; end if;
 if not (e.workflow_status='grading' or (e.legacy_workflow and e.workflow_status='open'))
  then raise exception 'Rok mora biti u obradi rezultata.'; end if;
 if e.starts_at>now() then raise exception 'Ispit još nije održan.'; end if;
 if TG_OP='DELETE' then return old; end if;
 if not exists(select 1 from public.exam_registrations r where r.exam_id=e.id and r.student_id=new.student_id and r.status='registered')
  then raise exception 'Student nije prijavljen na ispit.'; end if;
 return new;
end; $$;
create trigger exam_result_guard before insert or update or delete on public.grades
 for each row execute function public.exam_result_guard();

create or replace function public.register_exam(target uuid,cancel boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare e public.exams; existing_status text;
begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into e from public.exams where id=target for update;
 if not found or not public.enrolled(e.course_id) then raise exception 'Nemate pravo pristupa ispitu.' using errcode='42501'; end if;
 if (not cancel and e.workflow_status<>'open') or (cancel and e.workflow_status not in ('open','registration_closed'))
  then raise exception 'Stanje roka ne dopušta prijavu ili odjavu.'; end if;
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

create or replace function public.record_grade(target uuid,student uuid,result integer,note text default '') returns void language plpgsql security definer set search_path='' as $$
declare e public.exams;
begin
 perform 1 from public.profiles where id=student for update;
 select * into e from public.exams where id=target for update;
 if not found or not public.course_staff(e.institution_id,e.course_id) then raise exception 'Nemate pravo ocjenjivanja.' using errcode='42501'; end if;
 if result is null or result not between 1 and 5 then raise exception 'Ocjena mora biti od 1 do 5.'; end if;
 if e.starts_at>now() then raise exception 'Ispit još nije održan.'; end if;
 if not exists(select 1 from public.exam_registrations r where r.exam_id=e.id and r.student_id=student and r.status='registered') then raise exception 'Student nije prijavljen na ispit.'; end if;
 insert into public.grades(institution_id,exam_id,student_id,grade,outcome,feedback,graded_by) values(e.institution_id,e.id,student,result,'graded',note,auth.uid()) on conflict(institution_id,exam_id,student_id) do update set grade=result,outcome='graded',feedback=note,graded_by=auth.uid(),graded_at=now();
 if result>1 then
  update public.exam_registrations r set status='cancelled' from public.exams other_exam,public.courses other_course,public.courses own_course where r.exam_id=other_exam.id and other_exam.course_id=other_course.id and own_course.id=e.course_id and other_course.institution_id=e.institution_id and other_course.code=own_course.code and r.student_id=student and r.status='registered' and other_exam.starts_at>now() and other_exam.id<>e.id and other_exam.workflow_status<>'locked';
 end if;
end; $$;

create function public.record_exam_absence(target uuid,student uuid,note text default '') returns void language plpgsql security definer set search_path='' as $$
declare e public.exams;
begin
 perform 1 from public.profiles where id=student for update;
 select * into e from public.exams where id=target for update;
 if not found or not public.course_staff(e.institution_id,e.course_id) then raise exception 'Nemate pravo obrade rezultata.' using errcode='42501'; end if;
 insert into public.grades(institution_id,exam_id,student_id,grade,outcome,feedback,graded_by)
 values(e.institution_id,e.id,student,null,'absent',note,auth.uid())
 on conflict(institution_id,exam_id,student_id) do update set grade=null,outcome='absent',feedback=note,graded_by=auth.uid(),graded_at=now();
end; $$;

revoke execute on function public.exam_lock_guard(),public.exam_result_guard() from public,anon,authenticated;
revoke execute on function public.transition_exam(uuid,text,text,text),public.record_exam_absence(uuid,uuid,text) from public,anon;
grant execute on function public.transition_exam(uuid,text,text,text),public.record_exam_absence(uuid,uuid,text) to authenticated;
