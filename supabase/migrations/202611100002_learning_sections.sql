-- Native course sections and structured content. Apply after the quiz migration.
-- Student enrollment and official ISVU records remain owned by the registrar.
do $$ begin
 if to_regclass('public.learning_quizzes') is null then
  raise exception 'Najprije primijenite 202611100001_learning_quizzes.sql u ISVU projektu.';
 end if;
end $$;
create table public.learning_sections (
 id uuid primary key default gen_random_uuid(),
 institution_id uuid not null,
 course_id uuid not null,
 title text not null check(length(btrim(title)) between 2 and 200),
 summary text not null default '' check(length(summary)<=5000),
 published boolean not null default true,
 sort_order integer not null check(sort_order>0),
 revision integer not null default 1 check(revision>0),
 unique(institution_id,course_id,id),
 foreign key(institution_id,course_id) references public.courses(institution_id,id)
);
create index learning_section_course on public.learning_sections(course_id,sort_order,id);
alter table public.learning_sections enable row level security;
create policy learning_section_read on public.learning_sections for select to authenticated
 using(public.course_staff(institution_id,course_id) or (published and public.enrolled(course_id)));
revoke all on public.learning_sections from public,anon,authenticated;
grant select on public.learning_sections to authenticated;
grant all on public.learning_sections to service_role;

alter table public.learning_materials add column section_id uuid, add column sort_order integer not null default 1,
 add column resource_kind text not null default 'text' check(resource_kind in ('text','page','file','folder','url')),
 add column rich_body jsonb;
alter table public.learning_assignments add column section_id uuid, add column sort_order integer not null default 1,
 add column rich_body jsonb;
alter table public.learning_quizzes add column section_id uuid, add column sort_order integer not null default 1;
alter table public.learning_materials add foreign key(institution_id,course_id,section_id) references public.learning_sections(institution_id,course_id,id);
alter table public.learning_assignments add foreign key(institution_id,course_id,section_id) references public.learning_sections(institution_id,course_id,id);
alter table public.learning_quizzes add foreign key(institution_id,course_id,section_id) references public.learning_sections(institution_id,course_id,id);
-- Existing activities keep their content and appear in the General section.
with ordered as (
 select id, row_number() over(partition by course_id order by created_at,id)::integer n from public.learning_materials
) update public.learning_materials m set sort_order=o.n from ordered o where o.id=m.id;

create function public.learning_section_visible(target uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select target is null or exists(select 1 from public.learning_sections s where s.id=target
  and (public.course_staff(s.institution_id,s.course_id) or (s.published and public.enrolled(s.course_id))));
$$;
alter policy learning_material_read on public.learning_materials using(public.course_staff(institution_id,course_id)
 or (published and public.enrolled(course_id) and public.learning_section_visible(section_id)));
alter policy learning_assignment_read on public.learning_assignments using(public.course_staff(institution_id,course_id)
 or (published and public.enrolled(course_id) and public.learning_section_visible(section_id)));
alter policy learning_quiz_read on public.learning_quizzes using(public.course_staff(institution_id,course_id)
 or (published and public.enrolled(course_id) and public.learning_section_visible(section_id)));
-- Question policy already uses the quiz's RLS. Attempts and submissions remain visible
-- as the learner's own history even if the teaching section is subsequently hidden.
create or replace function public.learning_file_access(target_path text,editing boolean default false) returns boolean
 language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.learning_files f
  left join public.learning_materials m on m.id=f.material_id
  left join public.learning_assignments a on a.id=f.assignment_id
  where f.object_path=target_path and (public.course_staff(f.institution_id,f.course_id) or
   (not editing and f.status='ready' and coalesce(m.published,a.published,false) and public.enrolled(f.course_id)
    and public.learning_section_visible(coalesce(m.section_id,a.section_id)))));
$$;
-- Defense in depth: old RPCs and direct authenticated calls cannot submit into hidden sections.
create function public.learning_check_visible_submission() returns trigger language plpgsql security definer set search_path='' as $$
declare visible boolean;
begin
 if auth.uid() is null or public.course_staff(new.institution_id,new.course_id) then return new; end if;
 if tg_table_name='learning_submissions' then
  select published and public.learning_section_visible(section_id) into visible from public.learning_assignments where id=new.assignment_id;
 else
  select published and public.learning_section_visible(section_id) into visible from public.learning_quizzes where id=new.quiz_id;
 end if;
 if visible is distinct from true then raise exception 'LEARNING_FORBIDDEN'; end if;
 return new;
end $$;
create trigger learning_visible_submission before insert or update on public.learning_submissions
 for each row execute function public.learning_check_visible_submission();
create trigger learning_visible_attempt before insert or update on public.learning_quiz_attempts
 for each row execute function public.learning_check_visible_submission();

-- Bounded document tree; renderers never execute HTML from this JSON.
create function public.learning_valid_document(node jsonb,depth integer default 0) returns boolean
 language plpgsql immutable set search_path='' as $$
declare child jsonb; mark jsonb; kind text;
begin
 if node is null then return true; end if;
 if depth>12 or octet_length(node::text)>120000 or jsonb_typeof(node)<>'object' then return false; end if;
 kind=node->>'type';
 if kind is null or kind not in ('doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','codeBlock','horizontalRule','hardBreak') then return false; end if;
 if depth=0 and kind<>'doc' then return false; end if;
 if kind='text' and (jsonb_typeof(node->'text') is distinct from 'string' or length(node->>'text')>20000) then return false; end if;
 if node ? 'content' then
  if jsonb_typeof(node->'content')<>'array' or jsonb_array_length(node->'content')>300 then return false; end if;
  for child in select value from jsonb_array_elements(node->'content') loop
   if not public.learning_valid_document(child,depth+1) then return false; end if;
  end loop;
 end if;
 if node ? 'marks' then
  if jsonb_typeof(node->'marks')<>'array' or jsonb_array_length(node->'marks')>8 then return false; end if;
  for mark in select value from jsonb_array_elements(node->'marks') loop
   if coalesce(mark->>'type','') not in ('bold','italic','underline','strike','code','link') then return false; end if;
   if mark->>'type'='link' and (coalesce(mark->'attrs'->>'href','') !~ '^https://[^[:space:]@]+$' or length(mark->'attrs'->>'href')>2048) then return false; end if;
  end loop;
 end if;
 return true;
end $$;
alter table public.learning_materials add check(public.learning_valid_document(rich_body));
alter table public.learning_assignments add check(public.learning_valid_document(rich_body));

create function public.learning_save_section(target_course uuid,item_title text,item_summary text,item_published boolean,
 target uuid default null,expected integer default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.courses; s public.learning_sections; result uuid;
begin
 select * into c from public.courses where id=target_course for update;
 if c.id is null or not public.course_staff(c.institution_id,c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
 if target is null then
  if expected is distinct from 0 then raise exception 'LEARNING_CONFLICT'; end if;
  insert into public.learning_sections(institution_id,course_id,title,summary,published,sort_order)
   values(c.institution_id,c.id,btrim(item_title),btrim(item_summary),item_published,
    coalesce((select max(sort_order) from public.learning_sections where course_id=c.id),0)+1) returning id into result;
 else
  select * into s from public.learning_sections where id=target and course_id=c.id for update;
  if s.id is null then raise exception 'LEARNING_FORBIDDEN'; end if;
  if s.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
  update public.learning_sections set title=btrim(item_title),summary=btrim(item_summary),published=item_published,revision=revision+1 where id=s.id;
  result=s.id;
 end if;
 return result;
end $$;

-- One transaction saves the existing, fully validated activity AND its placement/content.
create function public.learning_save_content(target_course uuid,kind text,item jsonb,target_section uuid default null,
 item_resource text default 'text',document jsonb default null) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.courses; result uuid; old_section uuid; old_sort integer; target uuid; expected integer;
begin
 select * into c from public.courses where id=target_course for update;
 if c.id is null or not public.course_staff(c.institution_id,c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
 if target_section is not null and not exists(select 1 from public.learning_sections where id=target_section and course_id=c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
 if not public.learning_valid_document(document) then raise exception 'LEARNING_INVALID'; end if;
 target=nullif(item->>'target','')::uuid; expected=(item->>'expected')::integer;
 if kind='material' then
  if item_resource not in ('text','page','file','folder','url') then raise exception 'LEARNING_INVALID'; end if;
  if item_resource='url' and coalesce(item->>'item_url','')='' then raise exception 'LEARNING_INVALID'; end if;
  select section_id,sort_order into old_section,old_sort from public.learning_materials where id=target and course_id=c.id;
  result=public.learning_save_material(c.id,item->>'item_title',item->>'item_body',item->>'item_url',(item->>'item_published')::boolean,target,expected);
 elsif kind='assignment' then
  select section_id,sort_order into old_section,old_sort from public.learning_assignments where id=target and course_id=c.id;
  result=public.learning_save_assignment(c.id,item->>'item_title',item->>'item_instructions',(item->>'item_due')::timestamptz,
   (item->>'item_max')::numeric,(item->>'item_published')::boolean,(item->>'item_late')::boolean,target,expected);
 elsif kind='quiz' then
  select section_id,sort_order into old_section,old_sort from public.learning_quizzes where id=target and course_id=c.id;
  result=public.learning_save_quiz(c.id,item->>'item_title',item->>'item_description',(item->>'item_opens')::timestamptz,
   (item->>'item_closes')::timestamptz,(item->>'item_published')::boolean,item->'questions',target,expected);
 else raise exception 'LEARNING_INVALID'; end if;
 if target is null or old_section is distinct from target_section then
  select coalesce(max(position),0)+1 into old_sort from (
   select sort_order position from public.learning_materials where course_id=c.id and section_id is not distinct from target_section
   union all select sort_order from public.learning_assignments where course_id=c.id and section_id is not distinct from target_section
   union all select sort_order from public.learning_quizzes where course_id=c.id and section_id is not distinct from target_section
  ) positions;
 end if;
 if kind='material' then
  if item_resource='file' and (item->>'item_published')::boolean and not exists(
   select 1 from public.learning_files where material_id=result and status='ready'
  ) then raise exception 'LEARNING_FILE_REQUIRED'; end if;
  update public.learning_materials set section_id=target_section,sort_order=old_sort,resource_kind=item_resource,rich_body=document where id=result;
 elsif kind='assignment' then
  update public.learning_assignments set section_id=target_section,sort_order=old_sort,rich_body=document where id=result;
 else update public.learning_quizzes set section_id=target_section,sort_order=old_sort where id=result;
 end if;
 return result;
end $$;

create function public.learning_order_section(target_course uuid,target uuid,expected integer,direction text) returns void
 language plpgsql security definer set search_path='' as $$
declare c public.courses; s public.learning_sections; neighbor public.learning_sections;
begin
 select * into c from public.courses where id=target_course for update;
 if c.id is null or not public.course_staff(c.institution_id,c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
 select * into s from public.learning_sections where id=target and course_id=c.id for update;
 if s.id is null then raise exception 'LEARNING_FORBIDDEN'; end if;
 if s.revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
 if direction='delete' then
  if exists(select 1 from public.learning_materials where section_id=s.id)
   or exists(select 1 from public.learning_assignments where section_id=s.id)
   or exists(select 1 from public.learning_quizzes where section_id=s.id) then raise exception 'LEARNING_SECTION_NOT_EMPTY'; end if;
  delete from public.learning_sections where id=s.id;
  return;
 elsif direction='up' then
  select * into neighbor from public.learning_sections where course_id=c.id and sort_order<s.sort_order order by sort_order desc,id limit 1 for update;
 elsif direction='down' then
  select * into neighbor from public.learning_sections where course_id=c.id and sort_order>s.sort_order order by sort_order,id limit 1 for update;
 else raise exception 'LEARNING_INVALID'; end if;
 if neighbor.id is not null then
  update public.learning_sections set sort_order=case when id=s.id then neighbor.sort_order else s.sort_order end,revision=revision+1
   where id in (s.id,neighbor.id);
 end if;
end $$;
revoke execute on function public.learning_section_visible(uuid),public.learning_check_visible_submission(),
 public.learning_valid_document(jsonb,integer),public.learning_save_section(uuid,text,text,boolean,uuid,integer),
 public.learning_save_content(uuid,text,jsonb,uuid,text,jsonb),public.learning_order_section(uuid,uuid,integer,text) from public,anon;
grant execute on function public.learning_section_visible(uuid),public.learning_valid_document(jsonb,integer),
 public.learning_save_section(uuid,text,text,boolean,uuid,integer),public.learning_save_content(uuid,text,jsonb,uuid,text,jsonb),
 public.learning_order_section(uuid,uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
create function public.learning_order_activity(target_course uuid,kind text,target uuid,expected integer,direction text) returns void
 language plpgsql security definer set search_path='' as $$
declare c public.courses; section uuid; current_revision integer; ids uuid[]; kinds text[]; n integer; neighbor integer; temp uuid; temp_kind text; table_name text;
begin
 select * into c from public.courses where id=target_course for update;
 if c.id is null or not public.course_staff(c.institution_id,c.id) then raise exception 'LEARNING_FORBIDDEN'; end if;
 if kind='material' then table_name='learning_materials'; elsif kind='assignment' then table_name='learning_assignments';
 elsif kind='quiz' then table_name='learning_quizzes'; else raise exception 'LEARNING_INVALID'; end if;
 execute format('select section_id,revision from public.%I where id=$1 and course_id=$2 for update',table_name) into section,current_revision using target,c.id;
 if current_revision is null then raise exception 'LEARNING_FORBIDDEN'; end if;
 if current_revision is distinct from expected then raise exception 'LEARNING_CONFLICT'; end if;
 select array_agg(id order by sort_order,id,activity_kind),array_agg(activity_kind order by sort_order,id,activity_kind) into ids,kinds from (
  select id,sort_order,'material'::text activity_kind from public.learning_materials where course_id=c.id and section_id is not distinct from section
  union all select id,sort_order,'assignment' from public.learning_assignments where course_id=c.id and section_id is not distinct from section
  union all select id,sort_order,'quiz' from public.learning_quizzes where course_id=c.id and section_id is not distinct from section
 ) activities;
 for i in 1..coalesce(array_length(ids,1),0) loop if ids[i]=target and kinds[i]=kind then n=i; end if; end loop;
 if direction='up' then neighbor=n-1; elsif direction='down' then neighbor=n+1; else raise exception 'LEARNING_INVALID'; end if;
 if neighbor between 1 and array_length(ids,1) then
  temp=ids[n]; temp_kind=kinds[n]; ids[n]=ids[neighbor]; kinds[n]=kinds[neighbor]; ids[neighbor]=temp; kinds[neighbor]=temp_kind;
  for i in 1..array_length(ids,1) loop
   table_name=case kinds[i] when 'material' then 'learning_materials' when 'assignment' then 'learning_assignments' else 'learning_quizzes' end;
   execute format('update public.%I set sort_order=$1,revision=revision+1 where id=$2 and sort_order<>$1',table_name) using i,ids[i];
  end loop;
 end if;
end $$;
revoke execute on function public.learning_order_activity(uuid,text,uuid,integer,text) from public,anon;
grant execute on function public.learning_order_activity(uuid,text,uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
-- Legacy clients that edit plain text must not leave an obsolete rich version displayed.
create function public.learning_clear_stale_document() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='learning_materials' then
  if new.body is distinct from old.body and new.rich_body is not distinct from old.rich_body then new.rich_body=null; end if;
 else
  if new.instructions is distinct from old.instructions and new.rich_body is not distinct from old.rich_body then new.rich_body=null; end if;
 end if;
 return new;
end $$;
create trigger learning_material_document before update on public.learning_materials for each row execute function public.learning_clear_stale_document();
create trigger learning_assignment_document before update on public.learning_assignments for each row execute function public.learning_clear_stale_document();
revoke execute on function public.learning_clear_stale_document() from public,anon,authenticated;
