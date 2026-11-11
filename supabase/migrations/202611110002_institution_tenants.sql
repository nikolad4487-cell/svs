-- Public registry metadata only. Existing users, memberships and academic rows retain their IDs.
alter table public.institutions
 add column registry_key text unique,
 add column isvu_institution_id text unique check(length(isvu_institution_id)<=100),
 add column registry_name text,
 add column short_name text not null default '' check(length(short_name)<=100),
 add column parent_institution_id uuid references public.institutions(id),
 add column parent_name text,
 add column address text check(length(address)<=1000),
 add column official_website text check(length(official_website)<=2048 and (official_website is null or official_website ~ '^https?://[^[:space:]@]+$')),
 add column website_source text,
 add column registry_contact_email text check(length(registry_contact_email)<=254 and (registry_contact_email is null or registry_contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 add column registry_phone text check(length(registry_phone)<=1000),
 add column website_verification_status text not null default 'requires_verification' check(website_verification_status in ('requires_verification','registry_reported','admin_verified')),
 add column source_url text check(length(source_url)<=2048 and (source_url is null or source_url ~ '^https://[^[:space:]@]+$')),
 add column subdomain text unique,
 add column full_domain text generated always as (subdomain||'.isvu.me') stored,
 add column domain_verification_status text not null default 'requires_verification' check(domain_verification_status in ('requires_verification','registry_derived','admin_verified')),
 add column domain_origin text not null default 'manual' check(length(domain_origin)<=100),
 add column domain_notes text not null default '' check(length(domain_notes)<=2000),
 add column registry_metadata_locked boolean not null default false,
 add column source_snapshot jsonb not null default '{}' check(jsonb_typeof(source_snapshot)='object' and octet_length(source_snapshot::text)<=32000),
 add column updated_at timestamptz not null default now();
create function public.valid_institution_subdomain(value text) returns boolean language sql immutable set search_path='' as $$
 select value is not null and length(value) between 2 and 63 and value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 and value<>all(array['www','admin','api','auth','mail','app','smtp','imap','pop','ns1','ns2','static','assets','localhost','support','status','autodiscover','tenant','portal','studomat','merlin','webmail','isvu','referada','raspored','issp']);
$$;
alter table public.institutions add constraint institution_subdomain_valid check(subdomain is null or public.valid_institution_subdomain(subdomain));
create function public.protect_institution_registry() returns trigger language plpgsql set search_path='' as $$
declare p uuid;seen uuid[];
begin
 if current_user not in ('postgres','service_role','supabase_admin') then
  if not public.is_superadmin() then
  if to_jsonb(new)-array['name','code','headquarters','contact_email','logo_url','active','email_domains','registrar_contact','student_instructions','identity_portal_url','url_slug','updated_at','full_domain']
    is distinct from to_jsonb(old)-array['name','code','headquarters','contact_email','logo_url','active','email_domains','registrar_contact','student_instructions','identity_portal_url','url_slug','updated_at','full_domain'] then
   raise exception 'REGISTRY_FORBIDDEN';
  end if;
  end if;
 end if;
 if new.parent_institution_id is not null then
  seen=array[new.id];p=new.parent_institution_id;
  while p is not null loop
   if p=any(seen) then raise exception 'REGISTRY_PARENT_CYCLE'; end if;
   seen=array_append(seen,p);select parent_institution_id into p from public.institutions where id=p;
  end loop;
 end if;
 new.updated_at=clock_timestamp();return new;
end $$;
create trigger protect_institution_registry before update on public.institutions for each row execute function public.protect_institution_registry();

create function public.institution_directory(search text default '',tenant_slug text default null) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',i.id,'registry_key',i.registry_key,'name',i.name,'registry_name',i.registry_name,'short_name',i.short_name,
 'parent_name',coalesce(p.name,i.parent_name),'parent_institution_id',i.parent_institution_id,'headquarters',i.headquarters,'official_website',i.official_website,
 'registry_contact_email',i.registry_contact_email,'registry_phone',i.registry_phone,'address',i.address,'website_verification_status',i.website_verification_status,'source_url',i.source_url,'isvu_institution_id',i.isvu_institution_id,'subdomain',i.subdomain,'full_domain',i.full_domain,
 'domain_verification_status',i.domain_verification_status,'domain_origin',i.domain_origin,'domain_notes',i.domain_notes)
 from public.institutions i left join public.institutions p on p.id=i.parent_institution_id
 where i.active and i.subdomain is not null and (tenant_slug is null or i.subdomain=tenant_slug)
 and length(search)<=200 and (search='' or concat_ws(' ',i.name,i.headquarters,p.name,i.parent_name) ilike '%'||search||'%')
 order by i.name,i.parent_name,i.id;
$$;
-- Importing is privileged; anonymous callers can only read the bounded public directory above.
create function public.import_institution_catalog(items jsonb,legacy_bindings jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;r public.institutions;binding jsonb;target_id uuid;key text;source_id text;mapped boolean;processed integer=0;parent_key text;mapped_ids uuid[]=array[]::uuid[];
begin
 if not (public.is_superadmin() or auth.role()='service_role' or (auth.role() is null and session_user in ('postgres','supabase_admin'))) then raise exception 'REGISTRY_FORBIDDEN'; end if;
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 500 or jsonb_typeof(legacy_bindings) is distinct from 'object' then raise exception 'REGISTRY_INVALID'; end if;
 if (select count(distinct v->>'registry_key') from jsonb_array_elements(items) v)<>jsonb_array_length(items) then raise exception 'REGISTRY_SOURCE_CONFLICT'; end if;
 perform pg_advisory_xact_lock(20261111,125);
 for item in select value from jsonb_array_elements(items) loop
  key=item->>'registry_key';source_id=nullif(item->>'isvu_institution_id','');mapped=false;
  if key is null or key !~ '^hr-isvu-125:[0-9]{3}$' or length(item->>'name') not between 2 and 200 or not public.valid_institution_subdomain(item->>'subdomain') then raise exception 'REGISTRY_INVALID'; end if;
  select * into r from public.institutions where registry_key=key for update;
  if r.id is null and source_id is not null then
   select * into r from public.institutions where isvu_institution_id=source_id for update;
   if r.id is not null and r.registry_key is distinct from key then raise exception 'REGISTRY_SOURCE_CONFLICT'; end if;
  end if;
  if r.id is not null and source_id is not null and r.isvu_institution_id is not null and r.isvu_institution_id<>source_id then raise exception 'REGISTRY_SOURCE_CONFLICT'; end if;
  binding=legacy_bindings->key;
  if r.id is null and binding is not null then
   select * into r from public.institutions where id=(binding->>'id')::uuid for update;
   if r.id is not null then
    if r.registry_key is not null or r.code is distinct from binding->>'expected_code' or r.url_slug is distinct from binding->>'expected_slug' or r.headquarters is distinct from binding->>'expected_headquarters' then raise exception 'REGISTRY_BINDING_CONFLICT'; end if;
    mapped=true;mapped_ids=array_append(mapped_ids,r.id);
   end if;
  end if;
  if r.id is null then
   insert into public.institutions(id,name,code,headquarters,url_slug,registry_key,isvu_institution_id,registry_name,short_name,parent_name,address,official_website,registry_contact_email,registry_phone,website_source,website_verification_status,source_url,subdomain,domain_verification_status,domain_origin,domain_notes,source_snapshot)
   values((item->>'id')::uuid,item->>'name','ISVU125-'||right(key,3),item->>'headquarters',item->>'subdomain',key,source_id,item->>'name',upper(item->>'subdomain'),item->>'parent_name',item->>'address',item->>'official_website',item->>'registry_contact_email',item->>'registry_phone',item->>'website_source',item->>'website_verification_status',item->>'source_url',item->>'subdomain',item->>'domain_verification_status',item->>'domain_origin',item->>'domain_notes',item);
  elsif mapped then
   -- Preserve the established tenant and all its manual fields, users, email domains and academic records.
   update public.institutions set short_name=coalesce(nullif(short_name,''),code),registry_key=key,isvu_institution_id=source_id,registry_name=item->>'name',parent_name=item->>'parent_name',
    official_website=item->>'official_website',registry_contact_email=item->>'registry_contact_email',registry_phone=item->>'registry_phone',website_source=item->>'website_source',website_verification_status=item->>'website_verification_status',source_url=item->>'source_url',
    subdomain=item->>'subdomain',domain_verification_status=item->>'domain_verification_status',domain_origin='existing_application_route',domain_notes='Povezano s postojećim tenantom; očuvani su identifikator, korisnici i ručni podaci.',source_snapshot=item,registry_metadata_locked=true where id=r.id;
  elsif r.registry_metadata_locked then
   update public.institutions set isvu_institution_id=coalesce(isvu_institution_id,source_id),registry_contact_email=coalesce(registry_contact_email,item->>'registry_contact_email'),registry_phone=coalesce(registry_phone,item->>'registry_phone'),source_snapshot=item where id=r.id and (source_snapshot is distinct from item or (isvu_institution_id is null and source_id is not null));
  else
   -- A changed source website must never silently rename an already assigned application hostname.
   update public.institutions set name=item->>'name',registry_name=item->>'name',headquarters=item->>'headquarters',parent_name=item->>'parent_name',address=item->>'address',
    isvu_institution_id=coalesce(source_id,isvu_institution_id),official_website=item->>'official_website',registry_contact_email=item->>'registry_contact_email',registry_phone=item->>'registry_phone',website_source=item->>'website_source',website_verification_status=item->>'website_verification_status',source_url=item->>'source_url',source_snapshot=item where id=r.id and source_snapshot is distinct from item;
  end if;
  processed=processed+1;
 end loop;
 for item in select value from jsonb_array_elements(items) loop
  parent_key=item->>'parent_registry_key';
  update public.institutions i set parent_institution_id=p.id from public.institutions p
   where i.registry_key=item->>'registry_key' and p.registry_key=parent_key and (not i.registry_metadata_locked or i.id=any(mapped_ids)) and i.parent_institution_id is distinct from p.id;
 end loop;
 return jsonb_build_object('processed',processed,'catalog_count',(select count(*) from public.institutions where registry_key like 'hr-isvu-125:%'));
end $$;
create function public.save_institution_registry(target uuid,data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r public.institutions;
begin
 if not public.is_superadmin() then raise exception 'REGISTRY_FORBIDDEN'; end if;
 select * into r from public.institutions where id=target for update;
 if r.id is null then raise exception 'REGISTRY_NOT_FOUND'; end if;
 if data->>'updated_at' is distinct from r.updated_at::text and (data->>'updated_at')::timestamptz is distinct from r.updated_at then raise exception 'REGISTRY_CONFLICT'; end if;
 update public.institutions set name=btrim(data->>'name'),headquarters=btrim(data->>'headquarters'),short_name=btrim(data->>'short_name'),address=nullif(btrim(data->>'address'),''),
  official_website=nullif(btrim(data->>'official_website'),''),website_source=case when nullif(btrim(data->>'official_website'),'') is null then null else 'administrator' end,
  website_verification_status=data->>'website_verification_status',subdomain=data->>'subdomain',domain_origin='manual',domain_verification_status=data->>'domain_verification_status',domain_notes=btrim(data->>'domain_notes'),
  parent_institution_id=nullif(data->>'parent_institution_id','')::uuid,registry_metadata_locked=(data->>'registry_metadata_locked')::boolean,active=(data->>'active')::boolean where id=target;
end $$;
revoke execute on function public.valid_institution_subdomain(text),public.protect_institution_registry(),public.institution_directory(text,text),public.import_institution_catalog(jsonb,jsonb),public.save_institution_registry(uuid,jsonb) from public,anon;
grant execute on function public.valid_institution_subdomain(text),public.institution_directory(text,text) to anon,authenticated,service_role;
grant execute on function public.import_institution_catalog(jsonb,jsonb),public.save_institution_registry(uuid,jsonb) to authenticated,service_role;
notify pgrst,'reload schema';
