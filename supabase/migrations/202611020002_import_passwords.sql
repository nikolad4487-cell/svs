-- Imported accounts can authenticate only to replace their temporary password.
-- Check authoritative Auth metadata rather than stale JWT claims.
create function public.password_change_session_is_active() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id' and s.user_id=auth.uid());
$$;
revoke execute on function public.password_change_session_is_active() from public,anon;
grant execute on function public.password_change_session_is_active() to authenticated,service_role;

create or replace function public.session_is_active() returns boolean
language sql stable security definer set search_path='' as $$
 select public.password_change_session_is_active() and exists(select 1 from auth.users u
 where u.id=auth.uid() and coalesce(u.raw_app_meta_data->>'svs_password_change_required','false') <> 'true');
$$;

create function public.clear_import_password_requirement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.encrypted_password is distinct from old.encrypted_password then
  new.raw_app_meta_data = coalesce(new.raw_app_meta_data,'{}'::jsonb) - 'svs_password_change_required';
 end if;
 return new;
end; $$;
revoke execute on function public.clear_import_password_requirement() from public,anon,authenticated;
create trigger import_password_changed before update of encrypted_password on auth.users
 for each row execute function public.clear_import_password_requirement();
