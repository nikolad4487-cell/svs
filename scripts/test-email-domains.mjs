import { execFileSync } from "node:child_process";
import { localConfig } from "./local-config.mjs";
const config = localConfig();
if (!config.DB_CONTAINER || !["localhost", "127.0.0.1"].includes(new URL(config.API_URL).hostname)) throw new Error("Local test profile required");
execFileSync("docker", ["--host=unix:///var/run/docker.sock", "exec", "-i", config.DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], {input: `
begin;
create function pg_temp.verify(ok boolean) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Domain assertion failed'; end if; end $$;
insert into public.institutions(id,name,code,email_domains) values
 ('d0000000-0000-4000-8000-000000000001','Domain test','DOMAIN-TEST',array['college.example']);
select pg_temp.verify(public.institution_email_allowed('d0000000-0000-4000-8000-000000000001','Name@COLLEGE.EXAMPLE'));
select pg_temp.verify(not public.institution_email_allowed('d0000000-0000-4000-8000-000000000001','name@sub.college.example'));
select pg_temp.verify(not public.institution_email_allowed('d0000000-0000-4000-8000-000000000001','name@college.example.evil.test'));
select pg_temp.verify(not public.institution_email_allowed('d0000000-0000-4000-8000-000000000001','name@@college.example'));
select pg_temp.verify(not public.valid_email_domains(array['*.college.example']));
select pg_temp.verify(not public.valid_email_domains(array['College.Example']));
select pg_temp.verify(not public.valid_email_domains(array[null]::text[]));
do $$ begin
 begin
 insert into public.registration_invites(institution_id,email,role) values ('d0000000-0000-4000-8000-000000000001','wrong@other.example','student');
 raise exception 'Invalid invitation accepted';
 exception when check_violation then null; end;
end $$;
insert into public.registration_invites(institution_id,email,role) values
 ('d0000000-0000-4000-8000-000000000001','invited@college.example','student');
set local role supabase_auth_admin;
select pg_temp.verify(not (public.before_user_created('{"user":{"email":"invited@college.example"}}') ? 'error'));
select pg_temp.verify(public.before_user_created('{"user":{"email":"uninvited@college.example"}}') ? 'error');
reset role;
insert into auth.users(id,email,raw_user_meta_data) values
 ('d0000000-0000-4000-8000-000000000002','invited@college.example','{}');
select pg_temp.verify(not exists(select 1 from public.memberships where user_id='d0000000-0000-4000-8000-000000000002'));
update public.institutions set email_domains='{}' where code='DOMAIN-TEST';
select pg_temp.verify(public.before_user_created('{"user":{"email":"invited@college.example"}}') ? 'error');
update auth.users set email_confirmed_at=now() where id='d0000000-0000-4000-8000-000000000002';
select pg_temp.verify(not exists(select 1 from public.memberships where user_id='d0000000-0000-4000-8000-000000000002'));
insert into auth.sessions(id,user_id,created_at,updated_at) values
 ('d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000002',now(),now());
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000002","session_id":"d0000000-0000-4000-8000-000000000003"}',true);
set local role authenticated;
select public.accept_invitations();
reset role;
select pg_temp.verify(not exists(select 1 from public.memberships where user_id='d0000000-0000-4000-8000-000000000002'));
update public.institutions set email_domains=array['college.example'] where code='DOMAIN-TEST';
set local role authenticated;
select public.accept_invitations();
reset role;
select pg_temp.verify(exists(select 1 from public.memberships where user_id='d0000000-0000-4000-8000-000000000002' and role='student'));
set local role authenticated;
with changed as (update public.institutions set email_domains=array['evil.example'] where code='DOMAIN-TEST' returning id)
 select pg_temp.verify(not exists(select 1 from changed));
reset role;
update public.institutions set email_domains='{}' where code='DOMAIN-TEST';
select pg_temp.verify(exists(select 1 from public.memberships where user_id='d0000000-0000-4000-8000-000000000002'));
rollback;
`, stdio:["pipe","pipe","inherit"]});
console.log("Domain DB checks passed: exact match, invite gate, Auth hook, confirmation, later acceptance, RLS and retained memberships (rolled back).");
