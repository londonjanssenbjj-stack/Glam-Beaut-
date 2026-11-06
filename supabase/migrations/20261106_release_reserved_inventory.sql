alter table public.orders
  add column if not exists inventory_released_at timestamptz;

create or replace function private.release_order_inventory_on_terminal_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_release boolean;
begin
  v_release :=
    (new.status in ('cancelled','refunded') or new.payment_status in ('failed','refunded'))
    and old.inventory_released_at is null;

  if not v_release then
    return new;
  end if;

  for v_item in
    select oi.variant_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = new.id
      and oi.variant_id is not null
    group by oi.variant_id
  loop
    insert into public.inventory(variant_id,quantity,updated_at)
    values(v_item.variant_id,v_item.quantity,now())
    on conflict(variant_id) do update
      set quantity = public.inventory.quantity + excluded.quantity,
          updated_at = now();

    insert into public.inventory_movements(variant_id,movement_type,quantity,note)
    values(v_item.variant_id,'return',v_item.quantity,'Liberação automática de reserva do pedido ' || new.order_number);
  end loop;

  update public.orders
  set inventory_released_at = now()
  where id = new.id
  returning * into new;

  return new;
end;
$$;

revoke all on function private.release_order_inventory_on_terminal_status() from public, anon, authenticated;

drop trigger if exists release_order_inventory_on_terminal_status on public.orders;
create trigger release_order_inventory_on_terminal_status
after update of status,payment_status on public.orders
for each row
when (
  old.inventory_released_at is null
  and (
    new.status in ('cancelled','refunded')
    or new.payment_status in ('failed','refunded')
  )
)
execute function private.release_order_inventory_on_terminal_status();