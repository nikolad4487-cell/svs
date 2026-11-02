-- Reserve one issuance per pending invitation before calling the Auth Admin API.
alter table public.registration_invites add column credentials_issued_at timestamptz;
create function public.claim_pending_credentials(invite_id uuid)
returns table(email text, institution_id uuid, existing_user_id uuid)
language plpgsql security definer set search_path='' as $$
declare invitation public.registration_invites; auth_user auth.users;
begin
 if not public.is_superadmin() then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into invitation from public.registration_invites v where v.id=invite_id for update;
 if invitation.id is null or invitation.accepted_at is not null or invitation.expires_at<=now()
 or invitation.credentials_issued_at is not null
 or not public.institution_email_allowed(invitation.institution_id,invitation.email) then
  raise exception 'Invitation unavailable' using errcode='23514';
 end if;
 select * into auth_user from auth.users u where lower(u.email)=invitation.email;
 if auth_user.email_confirmed_at is not null then raise exception 'Account already confirmed' using errcode='23514'; end if;
 update public.registration_invites v set credentials_issued_at=now() where v.id=invite_id;
 return query select invitation.email,invitation.institution_id,auth_user.id;
end; $$;
revoke execute on function public.claim_pending_credentials(uuid) from public,anon;
grant execute on function public.claim_pending_credentials(uuid) to authenticated;
