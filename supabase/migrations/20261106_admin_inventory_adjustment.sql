create schema if not exists private;

create or replace function private.admin_adjust_inventory(
  p_variant_id uuid,
  p_quantity integer,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_quantity integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'Acesso administrativo necessário' using errcode = '42501';
  end if;
  if p_quantity = 0 then raise exception 'A quantidade deve ser diferente de zero'; end if;

  insert into public.inventory (variant_id, quantity, updated_at)
  values (p_variant_id, p_quantity, now())
  on conflict (variant_id) do update
    set quantity = public.inventory.quantity + excluded.quantity, updated_at = now()
    where public.inventory.quantity + excluded.quantity >= 0
  returning quantity into v_new_quantity;

  if v_new_quantity is null then
    raise exception 'Estoque insuficiente ou variação inexistente';
  end if;

  insert into public.inventory_movements (variant_id, movement_type, quantity, note)
  values (p_variant_id, case when p_quantity > 0 then 'entry' else 'adjustment' end,
          p_quantity, nullif(trim(coalesce(p_note, '')), ''));
  return v_new_quantity;
end;
$$;

revoke all on function private.admin_adjust_inventory(uuid, integer, text) from public, anon;
grant execute on function private.admin_adjust_inventory(uuid, integer, text) to authenticated;

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid,
  p_quantity integer,
  p_note text default null
)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.admin_adjust_inventory(p_variant_id, p_quantity, p_note);
$$;
revoke all on function public.admin_adjust_inventory(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_inventory(uuid, integer, text) to authenticated;
