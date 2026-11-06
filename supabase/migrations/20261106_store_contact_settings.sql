create or replace function private.admin_save_store_settings(
  p_whatsapp_phone text,
  p_pickup_enabled boolean,
  p_delivery_enabled boolean
) returns void
language plpgsql
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

  if nullif(regexp_replace(coalesce(p_whatsapp_phone, ''), '[^0-9]', '', 'g'), '') is not null
     and length(regexp_replace(p_whatsapp_phone, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise exception 'Informe um WhatsApp com DDD e código do país, entre 10 e 15 dígitos';
  end if;

  insert into public.store_settings(id, whatsapp_phone, pickup_enabled, delivery_enabled, updated_at)
  values (
    1,
    nullif(regexp_replace(coalesce(p_whatsapp_phone, ''), '[^0-9]', '', 'g'), ''),
    p_pickup_enabled,
    p_delivery_enabled,
    now()
  )
  on conflict (id) do update set
    whatsapp_phone = excluded.whatsapp_phone,
    pickup_enabled = excluded.pickup_enabled,
    delivery_enabled = excluded.delivery_enabled,
    updated_at = now();
end;
$$;

revoke all on function private.admin_save_store_settings(text,boolean,boolean) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.admin_save_store_settings(text,boolean,boolean) to authenticated;

create or replace function public.admin_save_store_settings(p_whatsapp_phone text,p_pickup_enabled boolean,p_delivery_enabled boolean)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.admin_save_store_settings(p_whatsapp_phone,p_pickup_enabled,p_delivery_enabled); $$;

revoke all on function public.admin_save_store_settings(text,boolean,boolean) from public, anon;
grant execute on function public.admin_save_store_settings(text,boolean,boolean) to authenticated;

create or replace function private.get_store_whatsapp_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select whatsapp_phone from public.store_settings where id = 1 limit 1; $$;

revoke all on function private.get_store_whatsapp_phone() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.get_store_whatsapp_phone() to anon, authenticated;

create or replace function public.get_store_whatsapp_phone()
returns text
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_store_whatsapp_phone(); $$;

revoke all on function public.get_store_whatsapp_phone() from public;
grant execute on function public.get_store_whatsapp_phone() to anon, authenticated;