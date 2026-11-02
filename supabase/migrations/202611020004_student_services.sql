-- Student self-reported annual data is separate from registrar-controlled entitlements.
create table public.student_reports (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 student_id uuid not null references public.profiles(id) on delete cascade, academic_year_id uuid not null,
 personal jsonb not null default '{}' check(jsonb_typeof(personal)='object' and octet_length(personal::text)<=16000),
 preferences jsonb not null default '{}' check(jsonb_typeof(preferences)='object' and octet_length(preferences::text)<=2000),
 unique(institution_id,student_id,academic_year_id),
 foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id)
);
create table public.student_services (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 student_id uuid not null references public.profiles(id) on delete cascade, academic_year_id uuid not null,
 kind text not null check(kind in ('dining','extra_ects','tuition','participation','mobility','category','attendance','certificate')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16000),
 foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id)
);
create function public.is_institution_student(inst uuid,student uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (public.academic_manager(inst) or (auth.uid()=student and public.has_role(inst))) and exists(select 1 from public.memberships m where m.institution_id=inst and m.user_id=student and m.role='student');
$$;
revoke execute on function public.is_institution_student(uuid,uuid) from public,anon;
grant execute on function public.is_institution_student(uuid,uuid) to authenticated;
alter table public.student_reports enable row level security;
alter table public.student_services enable row level security;
create policy reports_read on public.student_reports for select to authenticated using(public.academic_manager(institution_id) or (student_id=auth.uid() and public.has_role(institution_id)));
create policy reports_write on public.student_reports for insert to authenticated with check(student_id=auth.uid() and public.has_role(institution_id,array['student']::public.institution_role[]));
create policy reports_edit on public.student_reports for update to authenticated using(student_id=auth.uid() and public.has_role(institution_id,array['student']::public.institution_role[])) with check(student_id=auth.uid() and public.has_role(institution_id,array['student']::public.institution_role[]));
create policy services_read on public.student_services for select to authenticated using(public.academic_manager(institution_id) or (student_id=auth.uid() and public.has_role(institution_id)));
create policy services_manage on public.student_services for all to authenticated using(public.academic_manager(institution_id)) with check(public.academic_manager(institution_id) and public.is_institution_student(institution_id,student_id));
grant select,insert,update on public.student_reports to authenticated;
grant select,insert,update,delete on public.student_services to authenticated;
create trigger student_services_audit after insert or update or delete on public.student_services for each row execute function public.audit_identity_change();
create index student_services_lookup on public.student_services(institution_id,student_id,academic_year_id,kind);
create index student_reports_lookup on public.student_reports(institution_id,student_id);
alter table public.courses add column lecture_hours integer not null default 0 check(lecture_hours between 0 and 1000),
 add column exercise_hours integer not null default 0 check(exercise_hours between 0 and 1000),
 add column elective_group text not null default '' check(length(elective_group)<=200),
 add column teaching_plan text not null default '' check(length(teaching_plan)<=5000);
alter table public.institutions add column registrar_contact text not null default '' check(length(registrar_contact)<=2000),
 add column student_instructions text not null default '' check(length(student_instructions)<=5000),
 add column identity_portal_url text not null default '' check(identity_portal_url='' or identity_portal_url ~ '^https://');
create unique index extra_ects_reference on public.student_services(institution_id,student_id,(payload->>'reference')) where kind='extra_ects';
-- Aggregates are available to enrolled students and managers, never peer-level rows.
create function public.student_cohort_summary(inst uuid,program uuid,year_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.academic_manager(inst) and not (public.has_role(inst,array['student']::public.institution_role[]) and exists(select 1 from public.student_studies s where s.institution_id=inst and s.student_id=auth.uid() and s.program_id=program and s.academic_year_id=year_id)) then
  raise exception 'Forbidden' using errcode='42501';
 end if;
 with cohort as (select distinct s.student_id,s.id from public.student_studies s where s.institution_id=inst and s.program_id=program and s.academic_year_id=year_id),
 enrolled as (select distinct co.student_id,c.code,c.id,c.ects from cohort co join public.course_enrollments e on e.study_id=co.id join public.courses c on c.id=e.course_id),
 passed as (select distinct on (e.student_id,e.code) e.student_id,e.code,e.ects,g.grade from enrolled e join public.exams x on x.course_id=e.id join public.grades g on g.exam_id=x.id and g.student_id=e.student_id where g.grade>1 order by e.student_id,e.code,g.graded_at desc),
 totals as (select co.student_id,
 (select coalesce(sum(e.ects),0) from enrolled e where e.student_id=co.student_id) enrolled_ects,
 (select coalesce(sum(p.ects),0) from passed p where p.student_id=co.student_id) earned_ects,
 (select avg(p.grade) from passed p where p.student_id=co.student_id) grade,
 (select count(*) from enrolled e where e.student_id=co.student_id) enrolled_courses,
 (select count(*) from passed p where p.student_id=co.student_id) passed_courses
 from (select distinct student_id from cohort) co)
 select case when count(*)<5 then jsonb_build_object('available',false) else jsonb_build_object('available',true,'average_enrolled_ects',avg(enrolled_ects),'average_earned_ects',avg(earned_ects),'average_grade',avg(grade),'average_enrolled_courses',avg(enrolled_courses),'average_passed_courses',avg(passed_courses)) end into result from totals;
 return result;
end; $$;
revoke execute on function public.student_cohort_summary(uuid,uuid,uuid) from public,anon;
grant execute on function public.student_cohort_summary(uuid,uuid,uuid) to authenticated;

-- Non-credit courses (e.g. physical education) are valid catalogue entries.
alter table public.courses drop constraint courses_ects_check;
alter table public.courses add constraint courses_ects_check check(ects between 0 and 30 and mod(ects,0.5)=0);
