-- Continuous-assessment registrations are independent of final exam records and grades.
create table public.colloquia (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, course_id uuid not null,
 title text not null check(length(btrim(title)) between 2 and 200), starts_at timestamptz not null,
 registration_deadline timestamptz not null, withdrawal_deadline timestamptz not null,
 capacity integer not null check(capacity between 1 and 10000), cancelled boolean not null default false,
 revision integer not null default 1, created_by uuid not null references public.profiles(id),
 unique(institution_id,id), foreign key(institution_id,course_id) references public.courses(institution_id,id),
 check(registration_deadline<=starts_at and withdrawal_deadline<=starts_at)
);
create index colloquia_course_date on public.colloquia(institution_id,course_id,starts_at);
create table public.colloquium_registrations (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null, colloquium_id uuid not null,
 student_id uuid not null references public.profiles(id), registered boolean not null default true,
 updated_at timestamptz not null default now(), unique(colloquium_id,student_id),
 foreign key(institution_id,colloquium_id) references public.colloquia(institution_id,id)
);
alter table public.colloquia enable row level security;
alter table public.colloquium_registrations enable row level security;
create policy colloquia_read on public.colloquia for select to authenticated using(public.course_staff(institution_id,course_id) or public.enrolled(course_id));
create policy colloquium_registrations_read on public.colloquium_registrations for select to authenticated using(exists(select 1 from public.colloquia c where c.id=colloquium_id and (public.course_staff(c.institution_id,c.course_id) or (student_id=auth.uid() and public.enrolled(c.course_id)))));
revoke insert,update,delete on public.colloquia,public.colloquium_registrations from authenticated;
grant select on public.colloquia,public.colloquium_registrations to authenticated;
-- All writes go through scoped functions, including service clients; no client can forge a registration.
create function public.save_colloquium(target uuid,inst uuid,course uuid,label text,starts timestamptz,registration_end timestamptz,withdrawal_end timestamptz,seats integer,expected_revision integer default 0,is_cancelled boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare old public.colloquia; result uuid;
begin
 if not exists(select 1 from public.courses c where c.id=course and c.institution_id=inst) or not public.course_staff(inst,course) then raise exception 'Forbidden' using errcode='42501';end if;
 if starts<=now() or registration_end>starts or withdrawal_end>starts or length(btrim(label)) not between 2 and 200 or seats not between 1 and 10000 then raise exception 'COLLOQUIUM_INVALID';end if;
 if target is null then
  insert into public.colloquia(institution_id,course_id,title,starts_at,registration_deadline,withdrawal_deadline,capacity,created_by) values(inst,course,btrim(label),starts,registration_end,withdrawal_end,seats,auth.uid()) returning id into result;
 else
  select * into old from public.colloquia where id=target for update;
  if old.id is null or old.institution_id<>inst or old.course_id<>course then raise exception 'Forbidden' using errcode='42501';end if;
  if old.revision is distinct from expected_revision then raise exception 'COLLOQUIUM_STALE';end if;
  if old.starts_at<=now() then raise exception 'COLLOQUIUM_CLOSED';end if;
  if seats<(select count(*) from public.colloquium_registrations where colloquium_id=target and registered) then raise exception 'COLLOQUIUM_CAPACITY';end if;
  update public.colloquia set title=btrim(label),starts_at=starts,registration_deadline=registration_end,withdrawal_deadline=withdrawal_end,capacity=seats,cancelled=is_cancelled,revision=revision+1 where id=target;
  result=target;
 end if;
 return result;
end $$;
create function public.register_colloquium(target uuid,withdraw boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare c public.colloquia; already boolean;
begin
 select * into c from public.colloquia where id=target for update;
 if c.id is null or not public.enrolled(c.course_id) then raise exception 'Forbidden' using errcode='42501';end if;
 if c.cancelled or c.starts_at<=now() then raise exception 'COLLOQUIUM_CLOSED';end if;
 select registered into already from public.colloquium_registrations where colloquium_id=target and student_id=auth.uid();
 if withdraw then
  if c.withdrawal_deadline<now() then raise exception 'COLLOQUIUM_CLOSED';end if;
  update public.colloquium_registrations set registered=false,updated_at=now() where colloquium_id=target and student_id=auth.uid() and registered;
 else
  if already then return;end if;
  if c.registration_deadline<now() then raise exception 'COLLOQUIUM_CLOSED';end if;
  if (select count(*) from public.colloquium_registrations where colloquium_id=target and registered)>=c.capacity then raise exception 'COLLOQUIUM_FULL';end if;
  insert into public.colloquium_registrations(institution_id,colloquium_id,student_id) values(c.institution_id,target,auth.uid())
   on conflict(colloquium_id,student_id) do update set registered=true,updated_at=now();
 end if;
end $$;
revoke all on public.colloquia,public.colloquium_registrations from anon;
revoke execute on function public.save_colloquium(uuid,uuid,uuid,text,timestamptz,timestamptz,timestamptz,integer,integer,boolean),public.register_colloquium(uuid,boolean) from public,anon;
grant execute on function public.save_colloquium(uuid,uuid,uuid,text,timestamptz,timestamptz,timestamptz,integer,integer,boolean),public.register_colloquium(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
