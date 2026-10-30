-- Academic foundation. All cross-entity references include institution_id.
-- Support verified Auth accounts created before the application migration.
insert into public.profiles(id,full_name) select id,left(coalesce(raw_user_meta_data->>'full_name',''),200) from auth.users on conflict(id) do nothing;
create table public.study_programs (id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), name text not null check(length(name) between 2 and 200), code text not null, degree text not null default 'Prijediplomski', duration_years integer not null check(duration_years between 1 and 8), unique(institution_id,id), unique(institution_id,code));
create table public.academic_years (id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), name text not null check(length(name) between 4 and 30), starts_on date not null, ends_on date not null check(ends_on>starts_on), unique(institution_id,id), unique(institution_id,name));
create table public.semesters (id uuid primary key default gen_random_uuid(), institution_id uuid not null, academic_year_id uuid not null, name text not null check(length(name) between 2 and 80), starts_on date not null, ends_on date not null check(ends_on>starts_on), unique(institution_id,id), foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id), unique(institution_id,academic_year_id,name));
create table public.courses (id uuid primary key default gen_random_uuid(), institution_id uuid not null, program_id uuid not null, semester_id uuid not null, name text not null check(length(name) between 2 and 200), code text not null check(length(code) between 2 and 30), ects numeric(4,1) not null check(ects>0 and ects<=30), unique(institution_id,id), unique(institution_id,semester_id,code), foreign key(institution_id,program_id) references public.study_programs(institution_id,id), foreign key(institution_id,semester_id) references public.semesters(institution_id,id));
create table public.student_studies (id uuid primary key default gen_random_uuid(), institution_id uuid not null, student_id uuid not null references public.profiles(id), program_id uuid not null, academic_year_id uuid not null, study_year integer not null check(study_year between 1 and 8), student_number text not null check(length(student_number) between 2 and 40), status text not null default 'active' check(status in ('active','completed','paused')), unique(institution_id,id), unique(institution_id,id,student_id), unique(institution_id,student_id,program_id,academic_year_id), foreign key(institution_id,program_id) references public.study_programs(institution_id,id), foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id));
create table public.course_enrollments (id uuid primary key default gen_random_uuid(), institution_id uuid not null, study_id uuid not null, course_id uuid not null, student_id uuid not null, enrolled_at timestamptz not null default now(), unique(institution_id,course_id,student_id), foreign key(institution_id,study_id,student_id) references public.student_studies(institution_id,id,student_id), foreign key(institution_id,course_id) references public.courses(institution_id,id));
create table public.course_teachers (id uuid primary key default gen_random_uuid(), institution_id uuid not null, course_id uuid not null, teacher_id uuid not null references public.profiles(id), unique(institution_id,course_id,teacher_id), foreign key(institution_id,course_id) references public.courses(institution_id,id));
create table public.teaching_groups (id uuid primary key default gen_random_uuid(), institution_id uuid not null, course_id uuid not null, name text not null check(length(name) between 1 and 80), unique(institution_id,id), unique(institution_id,course_id,id), unique(institution_id,course_id,name), foreign key(institution_id,course_id) references public.courses(institution_id,id));
create table public.group_members (id uuid primary key default gen_random_uuid(), institution_id uuid not null, course_id uuid not null, group_id uuid not null, student_id uuid not null, unique(group_id,student_id), foreign key(institution_id,course_id,group_id) references public.teaching_groups(institution_id,course_id,id), foreign key(institution_id,course_id,student_id) references public.course_enrollments(institution_id,course_id,student_id));
create table public.rooms (id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), name text not null check(length(name) between 1 and 100), capacity integer not null check(capacity>0), unique(institution_id,id), unique(institution_id,name));
create table public.schedule_entries (id uuid primary key default gen_random_uuid(), institution_id uuid not null, course_id uuid not null, teacher_id uuid not null, room_id uuid not null, group_id uuid, title text not null check(length(title) between 2 and 200), starts_at timestamptz not null, ends_at timestamptz not null check(ends_at>starts_at), unique(institution_id,id), foreign key(institution_id,course_id,teacher_id) references public.course_teachers(institution_id,course_id,teacher_id), foreign key(institution_id,room_id) references public.rooms(institution_id,id), foreign key(institution_id,course_id,group_id) references public.teaching_groups(institution_id,course_id,id));
create table public.exams (id uuid primary key default gen_random_uuid(), institution_id uuid not null, course_id uuid not null, room_id uuid not null, starts_at timestamptz not null, registration_deadline timestamptz not null, withdrawal_deadline timestamptz not null, capacity integer not null check(capacity>0), unique(institution_id,id), check(registration_deadline<=starts_at and withdrawal_deadline<=starts_at), foreign key(institution_id,course_id) references public.courses(institution_id,id), foreign key(institution_id,room_id) references public.rooms(institution_id,id));
create table public.exam_registrations (id uuid primary key default gen_random_uuid(), institution_id uuid not null, exam_id uuid not null, student_id uuid not null references public.profiles(id), status text not null default 'registered' check(status in ('registered','cancelled')), registered_at timestamptz not null default now(), unique(institution_id,exam_id,student_id), foreign key(institution_id,exam_id) references public.exams(institution_id,id));
create table public.grades (id uuid primary key default gen_random_uuid(), institution_id uuid not null, exam_id uuid not null, student_id uuid not null, grade integer not null check(grade between 1 and 5), feedback text not null default '' check(length(feedback)<=2000), graded_by uuid not null references public.profiles(id), graded_at timestamptz not null default now(), unique(institution_id,exam_id,student_id), foreign key(institution_id,exam_id,student_id) references public.exam_registrations(institution_id,exam_id,student_id));
create table public.announcements (id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), course_id uuid, title text not null check(length(title) between 2 and 200), body text not null check(length(body) between 2 and 5000), author_id uuid not null default auth.uid() references public.profiles(id), published_at timestamptz not null default now(), foreign key(institution_id,course_id) references public.courses(institution_id,id));
create index enrollment_student_idx on public.course_enrollments(student_id,institution_id);
create index study_student_idx on public.student_studies(student_id,institution_id);
create index teacher_user_idx on public.course_teachers(teacher_id,institution_id);
create index schedule_time_idx on public.schedule_entries(institution_id,starts_at);
create index exam_time_idx on public.exams(institution_id,starts_at);
create index registration_student_idx on public.exam_registrations(student_id,exam_id);
create index grades_student_idx on public.grades(student_id,institution_id);
create index group_student_idx on public.group_members(student_id,course_id);
create index announcement_time_idx on public.announcements(institution_id,published_at desc);

create function public.academic_manager(inst uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.has_role(inst,array['institution_admin','registrar']::public.institution_role[]); $$;
create function public.teaches(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.course_teachers t where t.course_id=target and t.teacher_id=auth.uid() and public.has_role(t.institution_id,array['teacher']::public.institution_role[])); $$;
create function public.enrolled(target uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.course_enrollments e join public.student_studies s on s.id=e.study_id where e.course_id=target and e.student_id=auth.uid() and s.status='active' and public.has_role(e.institution_id,array['student']::public.institution_role[])); $$;
create function public.course_staff(inst uuid,target uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.academic_manager(inst) or public.teaches(target); $$;
create function public.exam_staff(inst uuid,target uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.exams e where e.id=target and e.institution_id=inst and public.course_staff(inst,e.course_id)); $$;
create function public.sees_student(inst uuid,target uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.academic_manager(inst) or (auth.uid()=target and public.has_role(inst)) or exists(select 1 from public.course_enrollments e where e.institution_id=inst and e.student_id=target and public.teaches(e.course_id)); $$;
create or replace function public.shares_institution(other_user uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.is_superadmin() or exists(select 1 from public.memberships b where b.user_id=other_user and public.sees_student(b.institution_id,other_user)); $$;
create policy enrolled_teacher_profiles on public.profiles for select to authenticated using(exists(select 1 from public.course_teachers t where t.teacher_id=profiles.id and public.enrolled(t.course_id)));
create policy memberships_registrar_read on public.memberships for select to authenticated using(public.academic_manager(institution_id));

-- Catalogue tables are visible to members; modification belongs to institution staff.
do $$ declare t text; begin
 foreach t in array array['study_programs','academic_years','semesters','courses','rooms','teaching_groups','course_teachers'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy catalog_read on public.%I for select to authenticated using(public.has_role(institution_id))',t);
 execute format('create policy catalog_manage on public.%I for all to authenticated using(public.academic_manager(institution_id)) with check(public.academic_manager(institution_id))',t);
 end loop;
 foreach t in array array['student_studies','course_enrollments','group_members','schedule_entries','exams','exam_registrations','grades','announcements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['student_studies','course_enrollments','group_members'] loop
 execute format('grant insert,update,delete on public.%I to authenticated',t);
 execute format('create policy students_read on public.%I for select to authenticated using(public.sees_student(institution_id,student_id))',t);
 execute format('create policy students_manage on public.%I for all to authenticated using(public.academic_manager(institution_id)) with check(public.academic_manager(institution_id))',t);
 end loop;
end $$;
-- Enrolment rosters are course-scoped: a teacher cannot read unrelated courses of a student.
drop policy students_read on public.course_enrollments;
create policy enrollment_read on public.course_enrollments for select to authenticated using((student_id=auth.uid() and public.has_role(institution_id)) or public.course_staff(institution_id,course_id));
drop policy students_read on public.group_members;
create policy group_read on public.group_members for select to authenticated using((student_id=auth.uid() and public.has_role(institution_id)) or public.course_staff(institution_id,course_id));
grant insert,update,delete on public.exams,public.schedule_entries,public.announcements to authenticated;
create policy exams_read on public.exams for select to authenticated using(public.enrolled(course_id) or public.course_staff(institution_id,course_id) or (public.has_role(institution_id) and exists(select 1 from public.exam_registrations r where r.exam_id=exams.id and r.student_id=auth.uid())));
create policy exams_manage on public.exams for all to authenticated using(public.course_staff(institution_id,course_id)) with check(public.course_staff(institution_id,course_id));
create policy schedule_read on public.schedule_entries for select to authenticated using(public.course_staff(institution_id,course_id) or (public.enrolled(course_id) and (group_id is null or exists(select 1 from public.group_members g where g.group_id=schedule_entries.group_id and g.student_id=auth.uid()))));
create policy schedule_manage on public.schedule_entries for all to authenticated using(public.course_staff(institution_id,course_id)) with check(public.course_staff(institution_id,course_id) and (public.academic_manager(institution_id) or teacher_id=auth.uid()));
create policy registrations_read on public.exam_registrations for select to authenticated using((student_id=auth.uid() and public.has_role(institution_id)) or public.exam_staff(institution_id,exam_id));
create policy grades_read on public.grades for select to authenticated using((student_id=auth.uid() and public.has_role(institution_id)) or public.exam_staff(institution_id,exam_id));
create policy announcement_read on public.announcements for select to authenticated using(public.has_role(institution_id) and (course_id is null or public.enrolled(course_id) or public.course_staff(institution_id,course_id)));
create policy announcement_manage on public.announcements for all to authenticated using(public.academic_manager(institution_id) or (author_id=auth.uid() and public.teaches(course_id))) with check(author_id=auth.uid() and (public.academic_manager(institution_id) or public.teaches(course_id)));

-- Integrity guards also apply to direct PostgREST calls, not just web forms.
create function public.academic_integrity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='semesters' then
  if not exists(select 1 from public.academic_years y where y.id=new.academic_year_id and new.starts_on>=y.starts_on and new.ends_on<=y.ends_on) then raise exception 'Semestar mora biti unutar akademske godine.'; end if;
 elsif TG_TABLE_NAME='student_studies' then
  if not exists(select 1 from public.memberships m where m.institution_id=new.institution_id and m.user_id=new.student_id and m.role='student') then raise exception 'Korisnik nije student ustanove.'; end if;
 elsif TG_TABLE_NAME='course_teachers' then
  if not exists(select 1 from public.memberships m where m.institution_id=new.institution_id and m.user_id=new.teacher_id and m.role='teacher') then raise exception 'Korisnik nije nastavnik ustanove.'; end if;
 elsif TG_TABLE_NAME='course_enrollments' then
  if not exists(select 1 from public.student_studies s join public.courses c on c.id=new.course_id join public.semesters sem on sem.id=c.semester_id where s.id=new.study_id and s.program_id=c.program_id and s.academic_year_id=sem.academic_year_id and s.status='active') then raise exception 'Kolegij ne pripada aktivnom studiju i akademskoj godini.'; end if;
 end if;
 return new;
end; $$;
create trigger semester_integrity before insert or update on public.semesters for each row execute function public.academic_integrity();
create trigger study_integrity before insert or update on public.student_studies for each row execute function public.academic_integrity();
create trigger teacher_integrity before insert or update on public.course_teachers for each row execute function public.academic_integrity();
create trigger enrollment_integrity before insert or update on public.course_enrollments for each row execute function public.academic_integrity();
create function public.schedule_integrity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Serialize overlapping writes by teacher and room, including concurrent requests.
 perform 1 from public.profiles where id=new.teacher_id for update;
 perform 1 from public.rooms where id=new.room_id for update;
 if new.group_id is not null then perform 1 from public.teaching_groups where id=new.group_id for update; end if;
 if exists(select 1 from public.schedule_entries s where s.id<>new.id and (s.room_id=new.room_id or s.teacher_id=new.teacher_id or (new.group_id is not null and s.group_id=new.group_id)) and s.starts_at<new.ends_at and s.ends_at>new.starts_at) then raise exception 'Termin se preklapa s dvoranom, nastavnikom ili grupom.'; end if;
 return new;
end; $$;
create trigger schedule_integrity before insert or update on public.schedule_entries for each row execute function public.schedule_integrity();

create function public.register_exam(target uuid,cancel boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare e public.exams; existing_status text;
begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into e from public.exams where id=target for update;
 if not found or not public.enrolled(e.course_id) then raise exception 'Nemate pravo pristupa ispitu.' using errcode='42501'; end if;
 if exists(select 1 from public.grades where exam_id=e.id and student_id=auth.uid()) then raise exception 'Ispit je već ocijenjen.'; end if;
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
create function public.record_grade(target uuid,student uuid,result integer,note text default '') returns void language plpgsql security definer set search_path='' as $$
declare e public.exams;
begin
 perform 1 from public.profiles where id=student for update;
 select * into e from public.exams where id=target for update;
 if not found or not public.course_staff(e.institution_id,e.course_id) then raise exception 'Nemate pravo ocjenjivanja.' using errcode='42501'; end if;
 if e.starts_at>now() then raise exception 'Ispit još nije održan.'; end if;
 if not exists(select 1 from public.exam_registrations r where r.exam_id=e.id and r.student_id=student and r.status='registered') then raise exception 'Student nije prijavljen na ispit.'; end if;
 insert into public.grades(institution_id,exam_id,student_id,grade,feedback,graded_by) values(e.institution_id,e.id,student,result,note,auth.uid()) on conflict(institution_id,exam_id,student_id) do update set grade=result,feedback=note,graded_by=auth.uid(),graded_at=now();
 if result>1 then
  update public.exam_registrations r set status='cancelled' from public.exams other_exam,public.courses other_course,public.courses own_course where r.exam_id=other_exam.id and other_exam.course_id=other_course.id and own_course.id=e.course_id and other_course.institution_id=e.institution_id and other_course.code=own_course.code and r.student_id=student and r.status='registered' and other_exam.starts_at>now() and other_exam.id<>e.id;
 end if;
end; $$;
-- Audit records never contain grades, feedback, tokens or passwords.
do $$ declare t text; begin
 foreach t in array array['study_programs','academic_years','semesters','courses','student_studies','course_enrollments','course_teachers','teaching_groups','group_members','rooms','schedule_entries','exams','exam_registrations','grades','announcements'] loop
 execute format('create trigger academic_audit after insert or update or delete on public.%I for each row execute function public.audit_identity_change()',t);
 end loop;
end $$;
revoke execute on function public.academic_integrity(),public.schedule_integrity() from public,anon,authenticated;
revoke execute on function public.academic_manager(uuid),public.teaches(uuid),public.enrolled(uuid),public.course_staff(uuid,uuid),public.exam_staff(uuid,uuid),public.sees_student(uuid,uuid),public.register_exam(uuid,boolean),public.record_grade(uuid,uuid,integer,text) from public,anon;
grant execute on function public.academic_manager(uuid),public.teaches(uuid),public.enrolled(uuid),public.course_staff(uuid,uuid),public.exam_staff(uuid,uuid),public.sees_student(uuid,uuid),public.register_exam(uuid,boolean),public.record_grade(uuid,uuid,integer,text) to authenticated;

-- Preserve referential and ECTS history under updates as well as inserts.
create function public.academic_update_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare keys text[]; k text;
begin
 if new.institution_id<>old.institution_id then raise exception 'Ustanova zapisa ne može se mijenjati.'; end if;
 if TG_TABLE_NAME='courses' then
  if exists(select 1 from public.course_enrollments where course_id=old.id) and (new.program_id<>old.program_id or new.semester_id<>old.semester_id or new.code<>old.code or new.ects<>old.ects) then raise exception 'Upisani kolegij zadržava program, semestar, šifru i ECTS.'; end if;
 elsif TG_TABLE_NAME='student_studies' then
  if exists(select 1 from public.course_enrollments where study_id=old.id) and (new.student_id<>old.student_id or new.program_id<>old.program_id or new.academic_year_id<>old.academic_year_id) then raise exception 'Studij s upisanim kolegijima zadržava studenta, program i godinu.'; end if;
 elsif TG_TABLE_NAME='semesters' then
  if new.academic_year_id<>old.academic_year_id and exists(select 1 from public.courses where semester_id=old.id) then raise exception 'Semestar s kolegijima zadržava akademsku godinu.'; end if;
 elsif TG_TABLE_NAME='academic_years' then
  if exists(select 1 from public.semesters where academic_year_id=old.id and (starts_on<new.starts_on or ends_on>new.ends_on)) then raise exception 'Akademska godina mora obuhvaćati semestre.'; end if;
 elsif TG_TABLE_NAME='exams' then
  if new.course_id<>old.course_id and exists(select 1 from public.exam_registrations where exam_id=old.id) then raise exception 'Ispit s prijavama zadržava kolegij.'; end if;
 end if;
 return new;
end; $$;
do $$ declare t text; begin foreach t in array array['study_programs','academic_years','semesters','courses','student_studies','course_enrollments','course_teachers','teaching_groups','group_members','rooms','schedule_entries','exams','announcements'] loop execute format('create trigger academic_update_guard before update on public.%I for each row execute function public.academic_update_guard()',t); end loop; end $$;
create function public.exam_integrity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.rooms where id=new.room_id for update;
 if new.capacity>(select capacity from public.rooms where id=new.room_id) then raise exception 'Kapacitet ispita prelazi kapacitet dvorane.'; end if;
 if TG_OP='UPDATE' then
  if new.capacity<(select count(*) from public.exam_registrations where exam_id=new.id and status='registered') then raise exception 'Kapacitet je manji od broja prijavljenih.'; end if;
 end if;
 return new;
end; $$;
create trigger exam_integrity before insert or update on public.exams for each row execute function public.exam_integrity();
revoke execute on function public.academic_update_guard(),public.exam_integrity() from public,anon,authenticated;
