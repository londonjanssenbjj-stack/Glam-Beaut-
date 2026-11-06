create or replace function public.create_customer_order(
  p_items jsonb,
  p_delivery_method text,
  p_shipping_address jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_item jsonb;
  v_variant_id uuid;
  v_quantity integer;
  v_product_id uuid;
  v_product_name text;
  v_sku text;
  v_unit_price numeric(12,2);
  v_line_total numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2) := 0;
  v_neighborhood text;
  v_region record;
  v_order_id uuid;
  v_order_number text;
  v_total numeric(12,2);
  v_count integer := 0;
begin
  if v_customer_id is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'A sacola deve conter entre 1 e 30 itens';
  end if;

  if p_delivery_method not in ('delivery','pickup') then
    raise exception 'Método de entrega inválido';
  end if;

  if p_delivery_method = 'delivery' then
    if jsonb_typeof(p_shipping_address) <> 'object' then
      raise exception 'Endereço de entrega obrigatório';
    end if;
    v_neighborhood := nullif(trim(p_shipping_address->>'neighborhood'), '');
    if v_neighborhood is null then
      raise exception 'Bairro de entrega obrigatório';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) x
    group by x->>'variant_id'
    having count(*) > 1
  ) then
    raise exception 'A sacola contém variações duplicadas';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_variant_id := (v_item->>'variant_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'Item da sacola inválido';
    end;

    if v_quantity < 1 or v_quantity > 100 then
      raise exception 'Quantidade inválida';
    end if;

    select pv.product_id, p.name, coalesce(pv.sku, p.sku),
           coalesce(pv.price_override, p.price)
      into v_product_id, v_product_name, v_sku, v_unit_price
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_variant_id
      and pv.is_active = true
      and p.is_active = true
    for update of pv, p;

    if not found then
      raise exception 'Produto ou variação indisponível';
    end if;

    update public.inventory
       set quantity = quantity - v_quantity,
           updated_at = now()
     where variant_id = v_variant_id
       and quantity >= v_quantity;

    if not found then
      raise exception 'Estoque insuficiente para: %', v_product_name;
    end if;

    v_line_total := round(v_unit_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_line_total;

    insert into public.inventory_movements (variant_id, movement_type, quantity, note)
    values (v_variant_id, 'sale', -v_quantity, 'Reserva de estoque do pedido');

    v_count := v_count + 1;
  end loop;

  if p_delivery_method = 'delivery' then
    select dr.fee, dr.free_from into v_region
    from public.delivery_regions dr
    where dr.is_active = true
      and lower(v_neighborhood) = any (
        select lower(x) from unnest(dr.neighborhoods) as x
      )
    order by dr.fee asc
    limit 1;

    if not found then
      raise exception 'Ainda não há entrega habilitada para este bairro';
    end if;

    v_delivery_fee := case
      when v_region.free_from is not null and v_subtotal >= v_region.free_from then 0
      else v_region.fee
    end;
  end if;

  v_total := v_subtotal + v_delivery_fee;
  v_order_number := 'GL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

  insert into public.orders (
    customer_id, order_number, status, subtotal, delivery_fee, total,
    payment_status, delivery_method, shipping_address
  ) values (
    v_customer_id, v_order_number, 'pending', v_subtotal, v_delivery_fee,
    v_total, 'pending', p_delivery_method,
    case when p_delivery_method = 'delivery' then p_shipping_address else null end
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    select pv.product_id, p.name, coalesce(pv.sku, p.sku),
           coalesce(pv.price_override, p.price)
      into v_product_id, v_product_name, v_sku, v_unit_price
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    v_line_total := round(v_unit_price * v_quantity, 2);

    insert into public.order_items (
      order_id, product_id, variant_id, product_name, sku,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product_id, v_variant_id, v_product_name, v_sku,
      v_unit_price, v_quantity, v_line_total
    );
  end loop;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.create_customer_order(jsonb, text, jsonb) from public, anon;
grant execute on function public.create_customer_order(jsonb, text, jsonb) to authenticated;
