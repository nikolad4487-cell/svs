-- Stable, unique public route labels; institution names can change independently.
alter table public.institutions add column url_slug text;
update public.institutions set url_slug=case
 when lower(code) ~ '^[a-z0-9]+(-[a-z0-9]+)*$' then lower(code)
 else 'vu-'||replace(id::text,'-','') end;
alter table public.institutions alter column url_slug set not null;
alter table public.institutions add constraint institution_url_slug_unique unique(url_slug),
 add constraint institution_url_slug_valid check(length(url_slug) between 2 and 64 and url_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create function public.institution_route_slug() returns trigger language plpgsql set search_path='' as $$
begin
 if new.url_slug is null or new.url_slug='' then
  if TG_OP='UPDATE' then new.url_slug=old.url_slug;
  else new.url_slug=case when lower(new.code) ~ '^[a-z0-9]+(-[a-z0-9]+)*$' then lower(new.code) else 'vu-'||replace(new.id::text,'-','') end;end if;
 end if;
 return new;
end; $$;
create trigger institution_route_slug before insert or update on public.institutions for each row execute function public.institution_route_slug();
revoke execute on function public.institution_route_slug() from public,anon,authenticated;
notify pgrst,'reload schema';
