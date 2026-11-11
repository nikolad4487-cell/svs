-- Private institutional student-standard records. No connection to state ISSP/HZMO.
do $$ begin
 if to_regclass('public.student_studies') is null or to_regclass('public.student_records') is null then
  raise exception 'ISSP zahtijeva osnovne akademske migracije i 202611060005_registrar_workbench.sql u ISVU projektu.';
 end if;
end $$;
create function public.issp_student_access(inst uuid,student uuid,editing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select (public.academic_manager(inst) or (not editing and student=auth.uid() and public.has_role(inst,array['student']::public.institution_role[])))
 and exists(select 1 from public.memberships m where m.institution_id=inst and m.user_id=student and m.role='student')
 and exists(select 1 from public.student_studies s where s.institution_id=inst and s.student_id=student);
$$;
create table public.issp_accounts (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id), student_id uuid not null references public.profiles(id),
 academic_year_id uuid not null, dining_enabled boolean not null default false, rights_level text not null default '' check(length(rights_level)<=50),
 valid_from date not null, valid_until date not null check(valid_until>=valid_from and isfinite(valid_from) and isfinite(valid_until)),
 daily_support_cents integer check(daily_support_cents between 0 and 100000000),
 reference text not null check(length(btrim(reference)) between 3 and 200), note text not null default '' check(length(note)<=2000),
 revision integer not null default 1 check(revision>0),updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),
 unique(institution_id,student_id,academic_year_id), unique(institution_id,student_id,id),
 foreign key(institution_id,academic_year_id) references public.academic_years(institution_id,id)
);
create table public.issp_profiles (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),student_id uuid not null references public.profiles(id),
 phone text not null default '' check(length(phone)<=80),photo_path text not null default '' check(length(photo_path)<=200),
 revision integer not null default 1,updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),unique(institution_id,student_id)
);
create table public.issp_records (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null,student_id uuid not null,account_id uuid not null,
 kind text not null check(kind in ('work_criterion','dining_criterion','employment','termination','special_right','disability','dorm','pause','card','temporary_card','mobility','ownership','esi')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=8000),
 reference text not null check(length(btrim(reference)) between 3 and 200),active boolean not null default true,
 revision integer not null default 1,updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default now(),
 foreign key(institution_id,student_id,account_id) references public.issp_accounts(institution_id,student_id,id)
);
create table public.issp_transactions (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null,student_id uuid not null,account_id uuid not null,
 kind text not null check(kind in ('allocation','purchase','reversal')),delta_cents integer not null check(abs(delta_cents::bigint)<=100000000),
 total_cents integer not null check(total_cents between 0 and 100000000),provider text not null check(length(provider) between 2 and 200),
 reference text not null check(length(btrim(reference)) between 3 and 200),description text not null default '' check(length(description)<=2000),
 occurred_at timestamptz not null check(isfinite(occurred_at)),created_at timestamptz not null default now(),created_by uuid not null references public.profiles(id),
 reverses_id uuid unique references public.issp_transactions(id),unique(account_id,reference),
 foreign key(institution_id,student_id,account_id) references public.issp_accounts(institution_id,student_id,id),
 check((kind='allocation' and delta_cents>0 and reverses_id is null) or (kind='purchase' and delta_cents<=0 and total_cents>=-delta_cents and reverses_id is null) or (kind='reversal' and reverses_id is not null))
);
create table public.issp_preferences (
 id uuid primary key default gen_random_uuid(),institution_id uuid not null references public.institutions(id),student_id uuid not null references public.profiles(id),
 contact_email text not null default '' check(length(contact_email)<=254),notifications boolean not null default false,
 revision integer not null default 1,updated_at timestamptz not null default now(),unique(institution_id,student_id),
 check(not notifications or contact_email<>'')
);
create index issp_records_subject on public.issp_records(account_id,kind,updated_at,id);
create index issp_transactions_account on public.issp_transactions(account_id,occurred_at,id);
create index issp_transactions_subject on public.issp_transactions(institution_id,student_id,occurred_at,id);
do $$ declare t text; begin
 foreach t in array array['issp_accounts','issp_profiles','issp_records','issp_transactions','issp_preferences'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy issp_subject_read on public.%I for select to authenticated using(public.issp_student_access(institution_id,student_id))',t);
  execute format('create trigger issp_audit after insert or update or delete on public.%I for each row execute function public.audit_identity_change()',t);
 end loop;
end $$;
create function public.issp_save_account(inst uuid,student uuid,year_id uuid,data jsonb,expected integer default 0) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.issp_accounts;
begin
 if not public.issp_student_access(inst,student,true) or not exists(select 1 from public.student_studies where institution_id=inst and student_id=student and academic_year_id=year_id) then raise exception 'ISSP_FORBIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(inst::text||student::text||year_id::text,0));
 select * into r from public.issp_accounts where institution_id=inst and student_id=student and academic_year_id=year_id for update;
 if coalesce(r.revision,0) is distinct from expected then raise exception 'ISSP_CONFLICT'; end if;
 if r.id is null then
  insert into public.issp_accounts(institution_id,student_id,academic_year_id,dining_enabled,rights_level,valid_from,valid_until,daily_support_cents,reference,note,updated_by)
  values(inst,student,year_id,coalesce((data->>'dining_enabled')::boolean,false),btrim(data->>'rights_level'),(data->>'valid_from')::date,(data->>'valid_until')::date,(data->>'daily_support_cents')::integer,btrim(data->>'reference'),btrim(data->>'note'),auth.uid()) returning * into r;
 else
  update public.issp_accounts set dining_enabled=coalesce((data->>'dining_enabled')::boolean,false),rights_level=btrim(data->>'rights_level'),valid_from=(data->>'valid_from')::date,valid_until=(data->>'valid_until')::date,
   daily_support_cents=(data->>'daily_support_cents')::integer,reference=btrim(data->>'reference'),note=btrim(data->>'note'),revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 return r.id;
end $$;
create function public.issp_save_record(target_account uuid,record_kind text,data jsonb,evidence text,target uuid default null,expected integer default 0,item_active boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.issp_accounts;r public.issp_records;
begin
 select * into a from public.issp_accounts where id=target_account for update;
 if a.id is null or not public.issp_student_access(a.institution_id,a.student_id,true) then raise exception 'ISSP_FORBIDDEN'; end if;
 if target is null then
  if expected is distinct from 0 then raise exception 'ISSP_CONFLICT'; end if;
  insert into public.issp_records(institution_id,student_id,account_id,kind,payload,reference,active,updated_by) values(a.institution_id,a.student_id,a.id,record_kind,data,btrim(evidence),item_active,auth.uid()) returning * into r;
 else
  select * into r from public.issp_records where id=target and account_id=a.id for update;
  if r.id is null then raise exception 'ISSP_FORBIDDEN'; end if;
  if r.revision is distinct from expected then raise exception 'ISSP_CONFLICT'; end if;
  if r.kind<>record_kind then raise exception 'ISSP_INVALID'; end if;
  update public.issp_records set payload=data,reference=btrim(evidence),active=item_active,revision=revision+1,updated_by=auth.uid(),updated_at=clock_timestamp() where id=r.id returning * into r;
 end if;
 return r.id;
end $$;
create function public.issp_post_transaction(target_account uuid,transaction_kind text,amount_cents integer,receipt_total integer,item_provider text,item_reference text,item_description text,item_date timestamptz,original uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.issp_accounts;old public.issp_transactions;existing public.issp_transactions;delta integer;balance bigint;result uuid;local_date date;
begin
 select * into a from public.issp_accounts where id=target_account for update;
 if a.id is null or not public.issp_student_access(a.institution_id,a.student_id,true) then raise exception 'ISSP_FORBIDDEN'; end if;
 if transaction_kind not in ('allocation','purchase','reversal') or transaction_kind is null or item_date is null or not isfinite(item_date) or item_date>clock_timestamp()+interval '1 minute' then raise exception 'ISSP_INVALID'; end if;
 if transaction_kind='reversal' then
  select * into old from public.issp_transactions where id=original and account_id=a.id;
  if old.id is null or old.kind='reversal' then raise exception 'ISSP_INVALID'; end if;
  if exists(select 1 from public.issp_transactions where reverses_id=old.id) then raise exception 'ISSP_REVERSED'; end if;
  delta=-old.delta_cents;
 else
  if original is not null or amount_cents is null or amount_cents<0 or amount_cents>100000000 or (transaction_kind='allocation' and amount_cents=0) then raise exception 'ISSP_INVALID'; end if;
  delta=case when transaction_kind='allocation' then amount_cents else -amount_cents end;
  if transaction_kind='purchase' then
   if not a.dining_enabled then raise exception 'ISSP_RIGHTS'; end if;
   local_date=(item_date at time zone 'Europe/Zagreb')::date;
   if exists(select 1 from public.issp_records where account_id=a.id and kind='termination' and active and (payload->>'date')::date<=local_date) then raise exception 'ISSP_RIGHTS'; end if;
   if local_date<a.valid_from or local_date>a.valid_until then raise exception 'ISSP_DATES'; end if;
  end if;
 end if;
 select * into existing from public.issp_transactions where account_id=a.id and reference=btrim(item_reference);
 if existing.id is not null then
  if existing.kind=transaction_kind and existing.delta_cents=delta and existing.total_cents=receipt_total and existing.provider=btrim(item_provider) and existing.description=btrim(item_description) and existing.occurred_at=item_date and existing.reverses_id is not distinct from original then return existing.id; end if;
  raise exception 'ISSP_CONFLICT';
 end if;
 select coalesce(sum(delta_cents),0) into balance from public.issp_transactions where account_id=a.id;
 if balance+delta<0 then raise exception 'ISSP_BALANCE'; end if;
 insert into public.issp_transactions(institution_id,student_id,account_id,kind,delta_cents,total_cents,provider,reference,description,occurred_at,created_by,reverses_id)
 values(a.institution_id,a.student_id,a.id,transaction_kind,delta,receipt_total,btrim(item_provider),btrim(item_reference),btrim(item_description),case when transaction_kind='reversal' then clock_timestamp() else item_date end,auth.uid(),original) returning id into result;
 return result;
end $$;
create function public.issp_save_preferences(inst uuid,email_address text,approved boolean,expected integer default 0) returns void
language plpgsql security definer set search_path='' as $$
declare r public.issp_preferences;
begin
 if not public.issp_student_access(inst,auth.uid()) or not public.has_role(inst,array['student']::public.institution_role[]) then raise exception 'ISSP_FORBIDDEN'; end if;
 if email_address is null or (email_address<>'' and email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'ISSP_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(inst::text||auth.uid()::text,1));
 select * into r from public.issp_preferences where institution_id=inst and student_id=auth.uid() for update;
 if coalesce(r.revision,0) is distinct from expected then raise exception 'ISSP_CONFLICT'; end if;
 insert into public.issp_preferences(institution_id,student_id,contact_email,notifications) values(inst,auth.uid(),btrim(email_address),approved)
 on conflict(institution_id,student_id) do update set contact_email=excluded.contact_email,notifications=excluded.notifications,revision=public.issp_preferences.revision+1,updated_at=clock_timestamp();
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('issp-photos','issp-photos',false,2097152,array['image/jpeg','image/png','image/webp']);
create function public.issp_photo_access(path text,editing boolean default false) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare inst uuid;student uuid;
begin
 if path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$' then return false; end if;
 begin inst=split_part(path,'/',1)::uuid;student=split_part(path,'/',2)::uuid;exception when invalid_text_representation then return false;end;
 return public.issp_student_access(inst,student,editing) and (editing or public.academic_manager(inst) or exists(select 1 from public.issp_profiles p where p.institution_id=inst and p.student_id=student and p.photo_path=path));
end $$;
create policy issp_photo_read on storage.objects for select to authenticated using(bucket_id='issp-photos' and public.issp_photo_access(name));
create policy issp_photo_insert on storage.objects for insert to authenticated with check(bucket_id='issp-photos' and public.issp_photo_access(name,true));
create policy issp_photo_delete on storage.objects for delete to authenticated using(bucket_id='issp-photos' and public.issp_photo_access(name,true));
create function public.issp_save_profile(inst uuid,student uuid,item_phone text,item_photo text,expected integer default 0) returns void
language plpgsql security definer set search_path='' as $$
declare r public.issp_profiles;
begin
 if not public.issp_student_access(inst,student,true) or item_phone is null or item_photo is null then raise exception 'ISSP_FORBIDDEN'; end if;
 if item_photo<>'' and (not public.issp_photo_access(item_photo,true) or split_part(item_photo,'/',1)<>inst::text or split_part(item_photo,'/',2)<>student::text or not exists(select 1 from storage.objects where bucket_id='issp-photos' and name=item_photo and (metadata->>'size')::bigint between 1 and 2097152 and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp'))) then raise exception 'ISSP_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(inst::text||student::text,2));
 select * into r from public.issp_profiles where institution_id=inst and student_id=student for update;
 if coalesce(r.revision,0) is distinct from expected then raise exception 'ISSP_CONFLICT'; end if;
 insert into public.issp_profiles(institution_id,student_id,phone,photo_path,updated_by) values(inst,student,btrim(item_phone),item_photo,auth.uid())
 on conflict(institution_id,student_id) do update set phone=excluded.phone,photo_path=excluded.photo_path,revision=public.issp_profiles.revision+1,updated_by=auth.uid(),updated_at=clock_timestamp();
end $$;
revoke execute on function public.issp_student_access(uuid,uuid,boolean),public.issp_save_account(uuid,uuid,uuid,jsonb,integer),public.issp_save_record(uuid,text,jsonb,text,uuid,integer,boolean),public.issp_post_transaction(uuid,text,integer,integer,text,text,text,timestamptz,uuid),public.issp_save_preferences(uuid,text,boolean,integer),public.issp_photo_access(text,boolean),public.issp_save_profile(uuid,uuid,text,text,integer) from public,anon;
grant execute on function public.issp_student_access(uuid,uuid,boolean),public.issp_save_account(uuid,uuid,uuid,jsonb,integer),public.issp_save_record(uuid,text,jsonb,text,uuid,integer,boolean),public.issp_post_transaction(uuid,text,integer,integer,text,text,text,timestamptz,uuid),public.issp_save_preferences(uuid,text,boolean,integer),public.issp_photo_access(text,boolean),public.issp_save_profile(uuid,uuid,text,text,integer) to authenticated;
notify pgrst,'reload schema';

-- Validate RPC payloads in the database as well as in the application.
create function public.issp_valid_record(kind text,data jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare definitions jsonb='{"work_criterion":{"title":"Kriteriji dodjele prava na studentski rad","fields":[{"name":"criterion","label":"Kriterij","options":[["student","Imate li status studenta?"],["ects","Ostvaren najmanje 1 ECTS u prethodnoj godini?"],["first_year","Prva godina nije upisana treći put?"],["duration","Studiranje nije dulje od dvostrukog trajanja studija?"],["employment","Student nije u radnom odnosu?"]]},{"name":"status","label":"Uvjet zadovoljen","options":[["yes","DA"],["no","NE"],["unknown","Nije provjereno"]]}]},"dining_criterion":{"title":"Kriteriji dodjele prava na prehranu","fields":[{"name":"criterion","label":"Kriterij","options":[["regular","Pravo temeljem redovitog upisa u tekuću akademsku godinu"],["county","Različita županija prebivališta i mjesta studiranja"],["dorm","Smještaj u domu koji ne pruža uslugu prehrane"]]},{"name":"status","label":"Uvjet zadovoljen","options":[["yes","DA"],["no","NE"],["unknown","Nije provjereno"]]}]},"employment":{"title":"Radno-pravni status","fields":[{"name":"status","label":"Status zaposlenja","options":[["not_employed","Nije zaposlen"],["employed","Zaposlen"],["unknown","Nije provjereno"]]},{"name":"description","label":"Opis statusa"},{"name":"checked_on","label":"Datum provjere","type":"date"}]},"termination":{"title":"Evidentiran prestanak prava","fields":[{"name":"date","label":"Datum prestanka","type":"date"},{"name":"reason","label":"Razlog prestanka","type":"textarea"}]},"special_right":{"title":"Posebno pravo","fields":[{"name":"title","label":"Posebno pravo na prehranu"},{"name":"starts_on","label":"Od","type":"date"},{"name":"ends_on","label":"Do","type":"date"}]},"disability":{"title":"Invaliditet","fields":[{"name":"category","label":"Kategorija"},{"name":"description","label":"Opis","type":"textarea"},{"name":"consent","label":"Evidentirana suglasnost","options":[["yes","DA"],["no","NE"]]}]},"dorm":{"title":"Dom studenta","fields":[{"name":"name","label":"Naziv doma"},{"name":"type","label":"Vrsta","options":[["student","Studentski dom"],["pupil","Učenički dom"]]}]},"pause":{"title":"Mirovanja","fields":[{"name":"program","label":"Studij"},{"name":"starts_on","label":"Početak","type":"date"},{"name":"ends_on","label":"Kraj","type":"date","optional":true},{"name":"note","label":"Napomena","type":"textarea","optional":true}]},"card":{"title":"Iskaznice","fields":[{"name":"number","label":"Broj iskaznice"},{"name":"status","label":"Status","options":[["issued","Izdana"],["requested","Zatražena"],["lost","Izgubljena"],["revoked","Poništena"]]},{"name":"print_status","label":"Status tiskanja"},{"name":"model","label":"Naziv modela"},{"name":"active","label":"Aktivna iskaznica","options":[["yes","DA"],["no","NE"]]}]},"temporary_card":{"title":"Privremene iskaznice","fields":[{"name":"number","label":"Broj iskaznice"},{"name":"status","label":"Status"},{"name":"valid_until","label":"Vrijedi do","type":"date"},{"name":"active","label":"Aktivna iskaznica","options":[["yes","DA"],["no","NE"]]}]},"mobility":{"title":"Mobilnost","fields":[{"name":"host","label":"Ustanova INO"},{"name":"country","label":"Država"},{"name":"program","label":"Program razmjene"},{"name":"direction","label":"Smjer","options":[["out","Odlazna"],["in","Dolazna"]]},{"name":"starts_on","label":"Početak","type":"date"},{"name":"ends_on","label":"Kraj","type":"date"}]},"ownership":{"title":"Vlasnik u visokom učilištu","fields":[{"name":"name","label":"Visoko učilište"},{"name":"date","label":"Datum ispisa","type":"date","optional":true},{"name":"reason","label":"Opis razloga","optional":true}]},"esi":{"title":"ESI oznaka studenta","fields":[{"name":"value","label":"ESI"},{"name":"created_on","label":"Datum stvaranja zapisa","type":"date"}]}}'::jsonb; field jsonb; entry jsonb; field_value text; key text; valid_date date;
begin
 if data is null or jsonb_typeof(data)<>'object' or not definitions ? kind then return false; end if;
 for key in select jsonb_object_keys(data) loop
  if not exists(select 1 from jsonb_array_elements(definitions->kind->'fields') f where f->>'name'=key) then return false; end if;
 end loop;
 for field in select f.value from jsonb_array_elements(definitions->kind->'fields') as f(value) loop
  if jsonb_typeof(data->(field->>'name')) is distinct from 'string' then return false; end if;
  field_value=data->>(field->>'name');
  if coalesce((field->>'optional')::boolean,false)=false and length(btrim(field_value))=0 then return false; end if;
  if length(field_value)>(case when field->>'type'='textarea' then 2000 else 200 end) then return false; end if;
  if field ? 'options' and not exists(select 1 from jsonb_array_elements(field->'options') o where o->>0=field_value) then return false; end if;
  if field->>'type'='date' and field_value<>'' then
   if field_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
   begin valid_date=field_value::date; exception when others then return false; end;
  end if;
 end loop;
 if coalesce(data->>'starts_on','')<>'' and coalesce(data->>'ends_on','')<>'' and (data->>'starts_on')>(data->>'ends_on') then return false; end if;
 return true;
end $$;
alter table public.issp_records add check(public.issp_valid_record(kind,payload));
revoke execute on function public.issp_valid_record(text,jsonb) from public,anon;
grant execute on function public.issp_valid_record(text,jsonb) to authenticated;
notify pgrst,'reload schema';
