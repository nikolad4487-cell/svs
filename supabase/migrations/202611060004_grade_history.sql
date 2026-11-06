-- Restricted domain history; never place grades or feedback in the general audit log.
create table public.exam_grade_events (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null,
 exam_id uuid not null,
 student_id uuid not null references public.profiles(id),
 actor_id uuid not null references public.profiles(id),
 action text not null check(action in ('BASELINE','INSERT','UPDATE','DELETE')),
 previous_grade integer check(previous_grade between 1 and 5),
 next_grade integer check(next_grade between 1 and 5),
 previous_outcome text check(previous_outcome in ('graded','absent')),
 next_outcome text check(next_outcome in ('graded','absent')),
 workflow_event_id uuid references public.exam_workflow_events(id),
 occurred_at timestamptz not null default now(),
 foreign key(institution_id,exam_id) references public.exams(institution_id,id)
);
create index exam_grade_events_student on public.exam_grade_events(institution_id,student_id,occurred_at);
alter table public.exam_grade_events enable row level security;
revoke all on public.exam_grade_events from public,anon,authenticated;
grant select on public.exam_grade_events to authenticated;
create policy grade_events_read on public.exam_grade_events for select to authenticated
 using((student_id=auth.uid() and public.has_role(institution_id)) or public.exam_staff(institution_id,exam_id));
-- This records only the known current state, without inventing earlier revisions.
insert into public.exam_grade_events(institution_id,exam_id,student_id,actor_id,action,next_grade,next_outcome,occurred_at)
 select institution_id,exam_id,student_id,graded_by,'BASELINE',grade,outcome,graded_at from public.grades;
create function public.record_exam_grade_event() returns trigger language plpgsql security definer set search_path='' as $$
declare g public.grades; linked_event uuid;
begin
 if TG_OP='DELETE' then g=old; else g=new; end if;
 select id into linked_event from public.exam_workflow_events where exam_id=g.exam_id order by occurred_at desc,id desc limit 1;
 insert into public.exam_grade_events(institution_id,exam_id,student_id,actor_id,action,
 previous_grade,next_grade,previous_outcome,next_outcome,workflow_event_id)
 values(g.institution_id,g.exam_id,g.student_id,coalesce(auth.uid(),g.graded_by),TG_OP,
 case when TG_OP<>'INSERT' then old.grade end,case when TG_OP<>'DELETE' then new.grade end,
 case when TG_OP<>'INSERT' then old.outcome end,case when TG_OP<>'DELETE' then new.outcome end,linked_event);
 if TG_OP='DELETE' then return old; end if;
 return new;
end; $$;
create trigger exam_grade_history after insert or update or delete on public.grades
 for each row execute function public.record_exam_grade_event();
revoke execute on function public.record_exam_grade_event() from public,anon,authenticated;

-- Unpublished drafts are visible to authorized staff only, including direct API reads.
drop policy exams_read on public.exams;
create policy exams_read on public.exams for select to authenticated using(
 public.course_staff(institution_id,course_id)
 or (workflow_status<>'draft' and public.enrolled(course_id))
 or (public.has_role(institution_id) and exists(select 1 from public.exam_registrations r where r.exam_id=exams.id and r.student_id=auth.uid())));
