-- Native ISVU learning workspace. Independent of mailboxes and Moodle accounts.
-- All writes go through bounded RPCs; read access follows current course membership.
create table public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  course_id uuid not null,
  title text not null check(length(btrim(title)) between 2 and 200),
  body text not null default '' check(length(body)<=20000),
  resource_url text not null default '' check(length(resource_url)<=2048 and (resource_url='' or resource_url ~ '^https://[^[:space:]@]+$')),
  published boolean not null default false,
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(institution_id,course_id) references public.courses(institution_id,id),
  check(length(btrim(body))>0 or resource_url<>'')
);
create table public.learning_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  course_id uuid not null,
  title text not null check(length(btrim(title)) between 2 and 200),
  instructions text not null check(length(btrim(instructions)) between 2 and 20000),
  due_at timestamptz,
  max_points numeric(8,2) not null default 100 check(max_points>0 and max_points<=10000),
  allow_late boolean not null default false,
  published boolean not null default false,
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id,course_id,id),
  foreign key(institution_id,course_id) references public.courses(institution_id,id)
);
create table public.learning_submissions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  course_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null references public.profiles(id),
  body text not null default '' check(length(body)<=20000),
  resource_url text not null default '' check(length(resource_url)<=2048 and (resource_url='' or resource_url ~ '^https://[^[:space:]@]+$')),
  revision integer not null default 1 check(revision>0),
  submitted_at timestamptz not null default now(),
  score numeric(8,2) check(score>=0 and score<=10000),
  feedback text not null default '' check(length(feedback)<=5000),
  graded_by uuid references public.profiles(id),
  graded_at timestamptz,
  unique(assignment_id,student_id),
  foreign key(institution_id,course_id,assignment_id) references public.learning_assignments(institution_id,course_id,id),
  check(length(btrim(body))>0 or resource_url<>''),
  check((score is null and graded_by is null and graded_at is null) or (score is not null and graded_by is not null and graded_at is not null))
);
create index learning_material_course on public.learning_materials(course_id,created_at,id);
create index learning_assignment_course on public.learning_assignments(course_id,created_at,id);
create index learning_submission_course on public.learning_submissions(course_id,submitted_at,id);

alter table public.learning_materials enable row level security;
alter table public.learning_assignments enable row level security;
alter table public.learning_submissions enable row level security;
create policy learning_material_read on public.learning_materials for select to authenticated
  using(public.course_staff(institution_id,course_id) or (published and public.enrolled(course_id)));
create policy learning_assignment_read on public.learning_assignments for select to authenticated
  using(public.course_staff(institution_id,course_id) or (published and public.enrolled(course_id)));
create policy learning_submission_read on public.learning_submissions for select to authenticated
  using(public.course_staff(institution_id,course_id) or (student_id=auth.uid() and public.enrolled(course_id)));
revoke all on public.learning_materials,public.learning_assignments,public.learning_submissions from public,anon,authenticated;
grant select on public.learning_materials,public.learning_assignments,public.learning_submissions to authenticated;
grant all on public.learning_materials,public.learning_assignments,public.learning_submissions to service_role;

-- Stable local course identifiers remain available for a future Moodle adapter.
create function public.learning_courses() returns table (
  id uuid,institution_id uuid,institution_name text,name text,code text,semester_name text,academic_year_name text,can_manage boolean,can_submit boolean
) language sql stable security definer set search_path='' as $$
  select c.id,c.institution_id,i.name,c.name,c.code,s.name,y.name,
    public.course_staff(c.institution_id,c.id),public.enrolled(c.id)
  from public.courses c join public.institutions i on i.id=c.institution_id
    join public.semesters s on s.id=c.semester_id and s.institution_id=c.institution_id
    join public.academic_years y on y.id=s.academic_year_id and y.institution_id=c.institution_id
  where public.course_staff(c.institution_id,c.id) or public.enrolled(c.id)
  order by i.name,y.starts_on desc,c.name,c.id;
$$;

create function public.learning_save_material(
  target_course uuid,item_title text,item_body text,item_url text,item_published boolean,
  target uuid default null,expected integer default 0
) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.courses; m public.learning_materials; result uuid;
begin
  select * into c from public.courses where id=target_course;
  if c.id is null or not public.course_staff(c.institution_id,c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
  if target is null then
    if expected is distinct from 0 then raise exception 'LEARNING_CONFLICT'; end if;
    insert into public.learning_materials(institution_id,course_id,title,body,resource_url,published,created_by)
      values(c.institution_id,c.id,btrim(item_title),btrim(item_body),btrim(item_url),item_published,auth.uid()) returning id into result;
  else
    select * into m from public.learning_materials where id=target and course_id=c.id for update;
    if m.id is null then raise exception 'LEARNING_FORBIDDEN'; end if;
    if m.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
    update public.learning_materials set title=btrim(item_title),body=btrim(item_body),resource_url=btrim(item_url),
      published=item_published,updated_at=clock_timestamp(),revision=revision+1 where id=m.id returning id into result;
  end if;
  return result;
end; $$;

create function public.learning_save_assignment(
  target_course uuid,item_title text,item_instructions text,item_due timestamptz,item_max numeric,
  item_published boolean,item_late boolean,target uuid default null,expected integer default 0
) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.courses; a public.learning_assignments; result uuid;
begin
  select * into c from public.courses where id=target_course;
  if c.id is null or not public.course_staff(c.institution_id,c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
  if item_max is null or item_max<=0 or item_max>10000 or item_max<>round(item_max,2) then raise exception 'LEARNING_INVALID'; end if;
  if item_due is not null and not isfinite(item_due) then raise exception 'LEARNING_INVALID'; end if;
  if target is null then
    if expected is distinct from 0 then raise exception 'LEARNING_CONFLICT'; end if;
    insert into public.learning_assignments(institution_id,course_id,title,instructions,due_at,max_points,published,allow_late,created_by)
      values(c.institution_id,c.id,btrim(item_title),btrim(item_instructions),item_due,item_max,item_published,item_late,auth.uid()) returning id into result;
  else
    select * into a from public.learning_assignments where id=target and course_id=c.id for update;
    if a.id is null then raise exception 'LEARNING_FORBIDDEN'; end if;
    if a.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
    if a.max_points<>item_max and exists(select 1 from public.learning_submissions where assignment_id=a.id) then raise exception 'LEARNING_POINTS_LOCKED'; end if;
    update public.learning_assignments set title=btrim(item_title),instructions=btrim(item_instructions),due_at=item_due,
      max_points=item_max,published=item_published,allow_late=item_late,updated_at=clock_timestamp(),revision=revision+1
      where id=a.id returning id into result;
  end if;
  return result;
end; $$;

create function public.learning_submit(target uuid,answer text,answer_url text,expected integer default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.learning_assignments; s public.learning_submissions; result uuid;
begin
  -- Same lock order for assignment editing, submission and grading.
  select * into a from public.learning_assignments where id=target for update;
  if a.id is null or not a.published or not public.enrolled(a.course_id) then raise exception 'LEARNING_FORBIDDEN'; end if;
  if a.due_at is not null and clock_timestamp()>a.due_at and not a.allow_late then raise exception 'LEARNING_DEADLINE'; end if;
  select * into s from public.learning_submissions where assignment_id=a.id and student_id=auth.uid() for update;
  if s.id is null then
    if expected is distinct from 0 then raise exception 'LEARNING_CONFLICT'; end if;
    insert into public.learning_submissions(institution_id,course_id,assignment_id,student_id,body,resource_url)
      values(a.institution_id,a.course_id,a.id,auth.uid(),btrim(answer),btrim(answer_url)) returning id into result;
  else
    if s.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
    if s.graded_at is not null then raise exception 'LEARNING_GRADED'; end if;
    update public.learning_submissions set body=btrim(answer),resource_url=btrim(answer_url),
      submitted_at=clock_timestamp(),revision=revision+1 where id=s.id returning id into result;
  end if;
  return result;
end; $$;

create function public.learning_grade(target uuid,points numeric,note text,expected integer)
returns void language plpgsql security definer set search_path='' as $$
declare a public.learning_assignments; s public.learning_submissions; aid uuid;
begin
  select assignment_id into aid from public.learning_submissions where id=target;
  select * into a from public.learning_assignments where id=aid for update;
  if a.id is null or not public.course_staff(a.institution_id,a.course_id) then raise exception 'LEARNING_FORBIDDEN'; end if;
  select * into s from public.learning_submissions where id=target for update;
  if s.id is null then raise exception 'LEARNING_FORBIDDEN'; end if;
  if s.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
  if points is null or points<0 or points>a.max_points or points<>round(points,2) then raise exception 'LEARNING_INVALID'; end if;
  update public.learning_submissions set score=points,feedback=note,graded_by=auth.uid(),
    graded_at=clock_timestamp(),revision=revision+1 where id=s.id;
end; $$;

revoke execute on function public.learning_courses(),public.learning_save_material(uuid,text,text,text,boolean,uuid,integer),
  public.learning_save_assignment(uuid,text,text,timestamptz,numeric,boolean,boolean,uuid,integer),
  public.learning_submit(uuid,text,text,integer),public.learning_grade(uuid,numeric,text,integer) from public,anon;
grant execute on function public.learning_courses(),public.learning_save_material(uuid,text,text,text,boolean,uuid,integer),
  public.learning_save_assignment(uuid,text,text,timestamptz,numeric,boolean,boolean,uuid,integer),
  public.learning_submit(uuid,text,text,integer),public.learning_grade(uuid,numeric,text,integer) to authenticated;
notify pgrst,'reload schema';
