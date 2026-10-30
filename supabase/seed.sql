-- Local demonstration institutions only. No production users or passwords.
insert into public.institutions(id,name,code,headquarters,contact_email) values
('10000000-0000-4000-8000-000000000001','Testno sveučilište','TS','Zagreb','podrska@example.test'),
('10000000-0000-4000-8000-000000000002','Testno veleučilište','TV','Split','referada@example.test') on conflict(id) do nothing;
