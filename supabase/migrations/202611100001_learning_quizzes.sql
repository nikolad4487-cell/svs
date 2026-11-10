-- Native single-choice quizzes. Answer keys are separate from student-readable questions.
create table public.learning_quizzes (
  id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid not null,
  title text not null check(length(btrim(title)) between 2 and 200),
  description text not null default '' check(length(description)<=5000),
  opens_at timestamptz,closes_at timestamptz,published boolean not null default false,
  max_points integer not null check(max_points between 1 and 2000),
  revision integer not null default 1 check(revision>0),
  created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),unique(institution_id,course_id,id),
  check(opens_at is null or isfinite(opens_at)),check(closes_at is null or isfinite(closes_at)),
  check(opens_at is null or closes_at is null or closes_at>opens_at),
  foreign key(institution_id,course_id) references public.courses(institution_id,id)
);
create table public.learning_quiz_questions (
  id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid not null,quiz_id uuid not null,
  position integer not null check(position between 1 and 20),
  prompt text not null check(length(btrim(prompt)) between 2 and 1000),choices jsonb not null,
  points integer not null check(points between 1 and 100),unique(quiz_id,position),
  foreign key(institution_id,course_id,quiz_id) references public.learning_quizzes(institution_id,course_id,id)
);
create table public.learning_quiz_keys (
  question_id uuid primary key references public.learning_quiz_questions(id) on delete cascade,
  correct_index integer not null check(correct_index between 0 and 5)
);
create table public.learning_quiz_attempts (
  id uuid primary key default gen_random_uuid(),institution_id uuid not null,course_id uuid not null,quiz_id uuid not null,
  student_id uuid not null references public.profiles(id),answers jsonb not null,
  score integer not null check(score>=0),max_points integer not null check(max_points>0 and score<=max_points),
  submitted_at timestamptz not null default now(),unique(quiz_id,student_id),
  foreign key(institution_id,course_id,quiz_id) references public.learning_quizzes(institution_id,course_id,id)
);
create index learning_quizzes_course on public.learning_quizzes(course_id,id);
create index learning_quiz_questions_course on public.learning_quiz_questions(course_id,quiz_id,position);
create index learning_quiz_attempts_course on public.learning_quiz_attempts(course_id,student_id,id);
alter table public.learning_quizzes enable row level security;
alter table public.learning_quiz_questions enable row level security;
alter table public.learning_quiz_keys enable row level security;
alter table public.learning_quiz_attempts enable row level security;
create policy learning_quiz_read on public.learning_quizzes for select to authenticated
 using(public.course_staff(institution_id,course_id) or (published and public.enrolled(course_id)));
create policy learning_quiz_question_read on public.learning_quiz_questions for select to authenticated
 using(public.course_staff(institution_id,course_id) or exists(select 1 from public.learning_quizzes q where q.id=quiz_id and q.published and public.enrolled(q.course_id)
   and (q.opens_at is null or q.opens_at<=now()) and (q.closes_at is null or q.closes_at>=now()
    or exists(select 1 from public.learning_quiz_attempts a where a.quiz_id=q.id and a.student_id=auth.uid()))));
create policy learning_quiz_key_read on public.learning_quiz_keys for select to authenticated
 using(exists(select 1 from public.learning_quiz_questions q where q.id=question_id and public.course_staff(q.institution_id,q.course_id)));
create policy learning_quiz_attempt_read on public.learning_quiz_attempts for select to authenticated
 using(public.course_staff(institution_id,course_id) or (student_id=auth.uid() and public.enrolled(course_id)));
revoke all on public.learning_quizzes,public.learning_quiz_questions,public.learning_quiz_keys,public.learning_quiz_attempts from public,anon,authenticated;
grant select on public.learning_quizzes,public.learning_quiz_questions,public.learning_quiz_keys,public.learning_quiz_attempts to authenticated;
grant all on public.learning_quizzes,public.learning_quiz_questions,public.learning_quiz_keys,public.learning_quiz_attempts to service_role;

create function public.learning_save_quiz(target_course uuid,item_title text,item_description text,item_opens timestamptz,item_closes timestamptz,
 item_published boolean,questions jsonb,target uuid default null,expected integer default 0)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.courses; q public.learning_quizzes; entry jsonb; choice jsonb; current_questions jsonb;
 result uuid; question_id uuid; position integer=0; total integer=0; correct integer; pts integer;
begin
 select * into c from public.courses where id=target_course;
 if c.id is null or not public.course_staff(c.institution_id,c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
 if questions is null or jsonb_typeof(questions)<>'array' then raise exception 'LEARNING_INVALID'; end if;
 if jsonb_array_length(questions) not between 1 and 20 then raise exception 'LEARNING_INVALID'; end if;
 for entry in select value from jsonb_array_elements(questions) loop
  if jsonb_typeof(entry)<>'object' or jsonb_typeof(entry->'prompt') is distinct from 'string'
   or length(btrim(entry->>'prompt')) not between 2 and 1000 or jsonb_typeof(entry->'choices') is distinct from 'array'
   or jsonb_typeof(entry->'correct_index') is distinct from 'number' or (entry->>'correct_index') !~ '^[0-9]+$'
   or jsonb_typeof(entry->'points') is distinct from 'number' or (entry->>'points') !~ '^[0-9]+$' then raise exception 'LEARNING_INVALID'; end if;
  if jsonb_array_length(entry->'choices') not between 2 and 6 then raise exception 'LEARNING_INVALID'; end if;
  correct=(entry->>'correct_index')::integer; pts=(entry->>'points')::integer;
  if correct<0 or correct>=jsonb_array_length(entry->'choices') or pts not between 1 and 100 then raise exception 'LEARNING_INVALID'; end if;
  for choice in select value from jsonb_array_elements(entry->'choices') loop
   if jsonb_typeof(choice)<>'string' or length(btrim(choice #>> '{}')) not between 1 and 200 then raise exception 'LEARNING_INVALID'; end if;
  end loop;
  total=total+pts;
 end loop;
 if target is null then
  if expected is distinct from 0 then raise exception 'LEARNING_CONFLICT'; end if;
  insert into public.learning_quizzes(institution_id,course_id,title,description,opens_at,closes_at,published,max_points,created_by)
   values(c.institution_id,c.id,btrim(item_title),btrim(item_description),item_opens,item_closes,item_published,total,auth.uid()) returning id into result;
 else
  select * into q from public.learning_quizzes where id=target and course_id=c.id for update;
  if q.id is null then raise exception 'LEARNING_FORBIDDEN'; end if;
  if q.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
  select jsonb_agg(jsonb_build_object('prompt',r.prompt,'choices',r.choices,'correct_index',k.correct_index,'points',r.points) order by r.position)
   into current_questions from public.learning_quiz_questions r join public.learning_quiz_keys k on k.question_id=r.id where r.quiz_id=q.id;
  if current_questions is distinct from questions and exists(select 1 from public.learning_quiz_attempts where quiz_id=q.id) then raise exception 'LEARNING_QUIZ_LOCKED'; end if;
  update public.learning_quizzes set title=btrim(item_title),description=btrim(item_description),opens_at=item_opens,closes_at=item_closes,
   published=item_published,max_points=total,revision=revision+1,updated_at=clock_timestamp() where id=q.id;
  result=q.id;
  if current_questions=questions then return result; end if;
  delete from public.learning_quiz_questions where quiz_id=q.id;
 end if;
 for entry in select value from jsonb_array_elements(questions) loop
  position=position+1;
  insert into public.learning_quiz_questions(institution_id,course_id,quiz_id,position,prompt,choices,points)
   values(c.institution_id,c.id,result,position,btrim(entry->>'prompt'),entry->'choices',(entry->>'points')::integer) returning id into question_id;
  insert into public.learning_quiz_keys(question_id,correct_index) values(question_id,(entry->>'correct_index')::integer);
 end loop;
 return result;
end; $$;

create function public.learning_submit_quiz(target uuid,expected integer,responses jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare q public.learning_quizzes; entry record; question public.learning_quiz_questions; total integer=0; result uuid;
begin
 select * into q from public.learning_quizzes where id=target for update;
 if q.id is null or not q.published or not public.enrolled(q.course_id) then raise exception 'LEARNING_FORBIDDEN'; end if;
 if q.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
 if (q.opens_at is not null and clock_timestamp()<q.opens_at) or (q.closes_at is not null and clock_timestamp()>q.closes_at) then raise exception 'LEARNING_QUIZ_CLOSED'; end if;
 if exists(select 1 from public.learning_quiz_attempts where quiz_id=q.id and student_id=auth.uid()) then raise exception 'LEARNING_QUIZ_DONE'; end if;
 if responses is null or jsonb_typeof(responses)<>'object' then raise exception 'LEARNING_INVALID'; end if;
 for entry in select * from jsonb_each(responses) loop
  select * into question from public.learning_quiz_questions where id::text=entry.key and quiz_id=q.id;
  if question.id is null or jsonb_typeof(entry.value)<>'number' or (entry.value #>> '{}') !~ '^[0-9]+$'
   then raise exception 'LEARNING_INVALID'; end if;
  if (entry.value #>> '{}')::integer<0 or (entry.value #>> '{}')::integer>=jsonb_array_length(question.choices) then raise exception 'LEARNING_INVALID'; end if;
 end loop;
 select coalesce(sum(r.points),0)::integer into total from public.learning_quiz_questions r
  join public.learning_quiz_keys k on k.question_id=r.id where r.quiz_id=q.id
   and responses->>r.id::text=k.correct_index::text;
 insert into public.learning_quiz_attempts(institution_id,course_id,quiz_id,student_id,answers,score,max_points)
  values(q.institution_id,q.course_id,q.id,auth.uid(),responses,total,q.max_points) returning id into result;
 return result;
end; $$;
revoke execute on function public.learning_save_quiz(uuid,text,text,timestamptz,timestamptz,boolean,jsonb,uuid,integer),public.learning_submit_quiz(uuid,integer,jsonb) from public,anon;
grant execute on function public.learning_save_quiz(uuid,text,text,timestamptz,timestamptz,boolean,jsonb,uuid,integer),public.learning_submit_quiz(uuid,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
