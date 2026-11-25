create or replace function private.admin_update_order_status(
  p_order_id uuid,
  p_status text
)
returns void
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

  if p_status not in ('confirmed','processing','shipped','ready_for_pickup','completed','cancelled','refunded') then
    raise exception 'Status de pedido inválido';
  end if;

  update public.orders
  set status = p_status, updated_at = now()
  where id = p_order_id;

  if not found then raise exception 'Pedido não encontrado'; end if;
end;
$$;

create or replace function public.admin_update_order_status(p_order_id uuid, p_status text)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.admin_update_order_status(p_order_id, p_status); $$;

revoke all on function private.admin_update_order_status(uuid,text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.admin_update_order_status(uuid,text) to authenticated;
revoke all on function public.admin_update_order_status(uuid,text) from public, anon;
grant execute on function public.admin_update_order_status(uuid,text) to authenticated;

create or replace function private.admin_update_appointment_status(
  p_appointment_id uuid,
  p_status text
)
returns void
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

  if p_status not in ('confirmed','completed','cancelled','no_show') then
    raise exception 'Status de agendamento inválido';
  end if;

  update public.appointments
  set status = p_status
  where id = p_appointment_id;

  if not found then raise exception 'Agendamento não encontrado'; end if;
end;
$$;

create or replace function public.admin_update_appointment_status(p_appointment_id uuid, p_status text)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.admin_update_appointment_status(p_appointment_id, p_status); $$;

revoke all on function private.admin_update_appointment_status(uuid,text) from public, anon;
grant execute on function private.admin_update_appointment_status(uuid,text) to authenticated;
revoke all on function public.admin_update_appointment_status(uuid,text) from public, anon;
grant execute on function public.admin_update_appointment_status(uuid,text) to authenticated;
