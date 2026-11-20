create or replace function private.admin_get_store_settings()
returns table(whatsapp_phone text,pickup_enabled boolean,delivery_enabled boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Acesso administrativo necessário' using errcode = '42501';
  end if;
  return query
  select s.whatsapp_phone,s.pickup_enabled,s.delivery_enabled
  from public.store_settings s where s.id=1;
  if not found then
    return query select null::text,true,true;
  end if;
end;
$$;
revoke all on function private.admin_get_store_settings() from public,anon;
grant execute on function private.admin_get_store_settings() to authenticated;
create or replace function public.admin_get_store_settings()
returns table(whatsapp_phone text,pickup_enabled boolean,delivery_enabled boolean)
language sql
stable
security invoker
set search_path = ''
as $$ select * from private.admin_get_store_settings(); $$;
revoke all on function public.admin_get_store_settings() from public,anon;
grant execute on function public.admin_get_store_settings() to authenticated;