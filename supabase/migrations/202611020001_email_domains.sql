-- Empty domain lists deny new invitations and membership activation.
-- Existing memberships are deliberately preserved; configure each institution after upgrade.
create function public.valid_email_domains(domains text[]) returns boolean
language sql immutable set search_path='' as $$
 select cardinality(domains) <= 20 and array_position(domains, null) is null
 and not exists(select 1 from unnest(domains) d where length(d)>253 or
 d !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$');
$$;
alter table public.institutions add column email_domains text[] not null default '{}'
 check(public.valid_email_domains(email_domains));

create function public.institution_email_allowed(inst uuid, address text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.institutions i where i.id=inst and i.active
 and address ~ '^[^@]+@[^@]+$' and lower(split_part(address,'@',2))=any(i.email_domains));
$$;
revoke execute on function public.institution_email_allowed(uuid,text) from public,anon,authenticated;

-- Enforce invitations even through direct PostgREST/SQL writes.
create function public.check_invitation_domain() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not public.institution_email_allowed(new.institution_id,new.email) then
  raise exception 'E-adresa nije na dopuštenoj domeni aktivne ustanove.' using errcode='23514';
 end if;
 return new;
end; $$;
revoke execute on function public.check_invitation_domain() from public,anon,authenticated;
create trigger invitation_domain_check before insert or update of email,institution_id
 on public.registration_invites for each row execute function public.check_invitation_domain();

create or replace function public.before_user_created(event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.registration_invites v join public.institutions i on i.id=v.institution_id where v.email=lower(event->'user'->>'email') and v.accepted_at is null and v.expires_at>now() and i.active and public.institution_email_allowed(i.id, event->'user'->>'email')) then
 return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Registracija zahtijeva poziv i dopuštenu domenu e-pošte ustanove.'));
 end if;
 return '{}'::jsonb;
end; $$;

create or replace function public.sync_profile_memberships() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),200)) on conflict(id) do nothing;
 if new.email_confirmed_at is not null then
  insert into public.memberships(institution_id,user_id,role) select v.institution_id,new.id,v.role from public.registration_invites v join public.institutions i on i.id=v.institution_id where v.email=lower(new.email) and v.accepted_at is null and v.expires_at>now() and i.active and public.institution_email_allowed(i.id, new.email) on conflict do nothing;
  update public.registration_invites set accepted_at=now() where email=lower(new.email) and accepted_at is null and expires_at>now() and institution_id in(select id from public.institutions where active and public.institution_email_allowed(id, new.email));
 end if;
 return new;
end; $$;

create or replace function public.accept_invitations() returns void language plpgsql security definer set search_path='' as $$
declare verified_email text;
begin
 if not public.session_is_active() then raise exception 'Unauthorized' using errcode='42501'; end if;
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 insert into public.memberships(institution_id,user_id,role) select v.institution_id,auth.uid(),v.role from public.registration_invites v join public.institutions i on i.id=v.institution_id where v.email=verified_email and v.accepted_at is null and v.expires_at>now() and i.active and public.institution_email_allowed(i.id, verified_email) on conflict do nothing;
 update public.registration_invites set accepted_at=now() where email=verified_email and accepted_at is null and expires_at>now() and institution_id in(select id from public.institutions where active and public.institution_email_allowed(id, verified_email));
end; $$;
