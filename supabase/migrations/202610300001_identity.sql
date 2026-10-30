-- Identity foundation. Auth passwords/tokens remain exclusively in Supabase Auth.
create type public.institution_role as enum ('institution_admin','registrar','teacher','student');
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '' check(length(full_name)<=200), created_at timestamptz not null default now());
create table public.institutions (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 200), code text not null unique check(code ~ '^[A-Z0-9-]{2,20}$'),
 headquarters text not null default '', contact_email text, logo_url text check(logo_url is null or logo_url ~ '^https://'), active boolean not null default true, created_at timestamptz not null default now()
);
create table public.superadmins (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.memberships (institution_id uuid not null references public.institutions(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, role public.institution_role not null, primary key(institution_id,user_id,role), created_at timestamptz not null default now());
create index memberships_user_idx on public.memberships(user_id,institution_id);
create table public.registration_invites (id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade, email text not null check(email=lower(email) and position('@' in email)>1), role public.institution_role not null, expires_at timestamptz not null default (now()+interval '7 days'), accepted_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create unique index invite_pending_idx on public.registration_invites(institution_id,email,role) where accepted_at is null;
create index invite_email_idx on public.registration_invites(email);
create table public.audit_logs (id bigint generated always as identity primary key, institution_id uuid references public.institutions(id), actor_id uuid, action text not null, record_id text, created_at timestamptz not null default now());
create index audit_institution_idx on public.audit_logs(institution_id,created_at desc);

-- A valid JWT alone is insufficient after a session has been revoked.
create function public.session_is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid());
$$;
create function public.is_superadmin() returns boolean language sql stable security definer set search_path='' as $$
 select public.session_is_active() and exists(select 1 from public.superadmins where user_id=auth.uid());
$$;
create function public.has_role(inst uuid, roles public.institution_role[] default array['institution_admin','registrar','teacher','student']::public.institution_role[]) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or (public.session_is_active() and exists(select 1 from public.memberships m join public.institutions i on i.id=m.institution_id where m.user_id=auth.uid() and m.institution_id=inst and m.role=any(roles) and i.active));
$$;
create function public.shares_institution(other_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_superadmin() or (public.session_is_active() and exists(select 1 from public.memberships a join public.memberships b on a.institution_id=b.institution_id join public.institutions i on i.id=a.institution_id where a.user_id=auth.uid() and b.user_id=other_user and a.role='institution_admin' and i.active));
$$;

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.superadmins enable row level security;
alter table public.memberships enable row level security;
alter table public.registration_invites enable row level security;
alter table public.audit_logs enable row level security;
create policy profiles_read on public.profiles for select to authenticated using ((id=auth.uid() and public.session_is_active()) or public.shares_institution(id));
create policy profiles_edit on public.profiles for update to authenticated using (id=auth.uid() and public.session_is_active()) with check(id=auth.uid() and public.session_is_active());
create policy institutions_read on public.institutions for select to authenticated using (public.has_role(id));
create policy institutions_create on public.institutions for insert to authenticated with check(public.is_superadmin());
create policy institutions_edit on public.institutions for update to authenticated using(public.has_role(id,array['institution_admin']::public.institution_role[])) with check(public.has_role(id,array['institution_admin']::public.institution_role[]));
create policy superadmins_read on public.superadmins for select to authenticated using(user_id=auth.uid() and public.session_is_active());
create policy memberships_read on public.memberships for select to authenticated using ((user_id=auth.uid() and public.has_role(institution_id)) or public.has_role(institution_id,array['institution_admin']::public.institution_role[]));
create policy memberships_write on public.memberships for all to authenticated using(public.is_superadmin()) with check(public.is_superadmin());
create policy invitations_read on public.registration_invites for select to authenticated using(public.has_role(institution_id,array['institution_admin']::public.institution_role[]));
create policy invitations_insert on public.registration_invites for insert to authenticated with check(public.is_superadmin() or (role<>'institution_admin' and created_by=auth.uid() and public.has_role(institution_id,array['institution_admin']::public.institution_role[])));
create policy invitations_delete on public.registration_invites for delete to authenticated using(public.has_role(institution_id,array['institution_admin']::public.institution_role[]));
create policy audit_read on public.audit_logs for select to authenticated using(public.is_superadmin() or public.has_role(institution_id,array['institution_admin']::public.institution_role[]));
grant usage on schema public to anon,authenticated;
grant select,update(full_name) on public.profiles to authenticated;
grant select,insert,update on public.institutions to authenticated;
grant select on public.superadmins,public.audit_logs to authenticated;
grant select,insert,delete on public.registration_invites to authenticated;
grant select,insert,update,delete on public.memberships to authenticated;

-- Authoritative signup gate: enable this function as the Before User Created hook.
create function public.before_user_created(event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.registration_invites v join public.institutions i on i.id=v.institution_id where v.email=lower(event->'user'->>'email') and v.accepted_at is null and v.expires_at>now() and i.active) then
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registracija je dostupna samo pozvanim korisnicima.'));
 end if;
 return '{}'::jsonb;
end; $$;
revoke execute on function public.before_user_created(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
create function public.sync_profile_memberships() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),200)) on conflict(id) do nothing;
 if new.email_confirmed_at is not null then
  insert into public.memberships(institution_id,user_id,role) select v.institution_id,new.id,v.role from public.registration_invites v join public.institutions i on i.id=v.institution_id where v.email=lower(new.email) and v.accepted_at is null and v.expires_at>now() and i.active on conflict do nothing;
  update public.registration_invites set accepted_at=now() where email=lower(new.email) and accepted_at is null and expires_at>now() and institution_id in(select id from public.institutions where active);
 end if;
 return new;
end; $$;
create trigger on_auth_user_sync after insert or update of email_confirmed_at on auth.users for each row execute function public.sync_profile_memberships();
revoke execute on function public.sync_profile_memberships() from public,anon,authenticated;

-- Accept later invitations for an already verified account without a service-role client.
create function public.accept_invitations() returns void language plpgsql security definer set search_path='' as $$
declare verified_email text;
begin
 if not public.session_is_active() then raise exception 'Unauthorized' using errcode='42501'; end if;
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 insert into public.memberships(institution_id,user_id,role) select v.institution_id,auth.uid(),v.role from public.registration_invites v join public.institutions i on i.id=v.institution_id where v.email=verified_email and v.accepted_at is null and v.expires_at>now() and i.active on conflict do nothing;
 update public.registration_invites set accepted_at=now() where email=verified_email and accepted_at is null and expires_at>now() and institution_id in(select id from public.institutions where active);
end; $$;
create function public.list_my_sessions() returns table(id uuid,created_at timestamptz,updated_at timestamptz,user_agent text,current_session boolean) language sql stable security definer set search_path='' as $$
 select s.id,s.created_at,s.updated_at,s.user_agent,s.id::text=auth.jwt()->>'session_id' from auth.sessions s where s.user_id=auth.uid() and public.session_is_active() order by s.created_at desc;
$$;
create function public.revoke_my_session(target uuid default null, all_sessions boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.session_is_active() then raise exception 'Unauthorized' using errcode='42501'; end if;
 delete from auth.sessions where user_id=auth.uid() and (all_sessions or id=coalesce(target,(auth.jwt()->>'session_id')::uuid));
end; $$;
create function public.audit_identity_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 r=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.audit_logs(institution_id,actor_id,action,record_id) values(case when TG_TABLE_NAME='institutions' then (r->>'id')::uuid else (r->>'institution_id')::uuid end,auth.uid(),TG_TABLE_NAME||':'||TG_OP,coalesce(r->>'id',r->>'user_id'));
 return case when TG_OP='DELETE' then old else new end;
end; $$;
create trigger superadmins_audit after insert or delete on public.superadmins for each row execute function public.audit_identity_change();
create trigger institutions_audit after insert or update on public.institutions for each row execute function public.audit_identity_change();
create trigger memberships_audit after insert or update or delete on public.memberships for each row execute function public.audit_identity_change();
create trigger invitations_audit after insert or delete on public.registration_invites for each row execute function public.audit_identity_change();
revoke execute on function public.audit_identity_change() from public,anon,authenticated;
-- Functions default to public execute: remove it explicitly.
revoke execute on function public.session_is_active(),public.is_superadmin(),public.has_role(uuid,public.institution_role[]),public.shares_institution(uuid),public.accept_invitations(),public.list_my_sessions(),public.revoke_my_session(uuid,boolean) from public,anon;
grant execute on function public.session_is_active(),public.is_superadmin(),public.has_role(uuid,public.institution_role[]),public.shares_institution(uuid),public.accept_invitations(),public.list_my_sessions(),public.revoke_my_session(uuid,boolean) to authenticated;
