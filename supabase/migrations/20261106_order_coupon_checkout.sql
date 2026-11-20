drop function if exists public.create_customer_order(jsonb,text,jsonb);
drop function if exists private.create_customer_order(jsonb,text,jsonb);
alter table public.orders add column if not exists discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0);
alter table public.orders add column if not exists coupon_code text;
create or replace function private.create_customer_order(
  p_items jsonb,
  p_delivery_method text,
  p_shipping_address jsonb default null,
  p_coupon_code text default null
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
  v_discount_amount numeric(12,2) := 0;
  v_coupon_id uuid;
  v_coupon record;
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
  if p_delivery_method = 'pickup' and not exists (
    select 1 from public.store_settings where id = 1 and pickup_enabled = true
  ) then
    raise exception 'Retirada não está habilitada no momento';
  end if;

  if p_delivery_method = 'delivery' then
    if jsonb_typeof(p_shipping_address) <> 'object' then
      raise exception 'Endereço de entrega obrigatório';
    end if;
    v_neighborhood := nullif(trim(p_shipping_address->>'neighborhood'), '');
    if v_neighborhood is null or nullif(trim(p_shipping_address->>'recipient_name'), '') is null
       or nullif(trim(p_shipping_address->>'phone'), '') is null
       or nullif(trim(p_shipping_address->>'postal_code'), '') is null
       or nullif(trim(p_shipping_address->>'street'), '') is null
       or nullif(trim(p_shipping_address->>'number'), '') is null then
      raise exception 'Preencha todos os campos obrigatórios do endereço';
    end if;
    if not exists (select 1 from public.store_settings where id = 1 and delivery_enabled = true) then
      raise exception 'Entrega não está habilitada no momento';
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

  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select id, discount_type, discount_value, minimum_order, starts_at, expires_at, usage_limit, usage_count
      into v_coupon
    from public.coupons
    where code = upper(trim(p_coupon_code)) and is_active = true
    for update;
    if not found then raise exception 'Cupom inválido ou inativo'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > now() then raise exception 'Este cupom ainda não está válido'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < now() then raise exception 'Este cupom expirou'; end if;
    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then raise exception 'Limite de utilizações deste cupom atingido'; end if;
    if v_subtotal < v_coupon.minimum_order then raise exception 'O pedido não atingiu o valor mínimo do cupom'; end if;
    if exists(select 1 from public.coupon_usages where coupon_id = v_coupon.id and customer_id = v_customer_id) then
      raise exception 'Você já utilizou este cupom';
    end if;
    v_coupon_id := v_coupon.id;
    v_discount_amount := case
      when v_coupon.discount_type = 'percentage' then round(v_subtotal * v_coupon.discount_value / 100, 2)
      else least(v_coupon.discount_value, v_subtotal)
    end;
  end if;
  v_total := greatest(0, v_subtotal + v_delivery_fee - v_discount_amount);
  v_order_number := 'GL-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6));

  insert into public.orders (
    customer_id, order_number, status, subtotal, delivery_fee, discount_amount, coupon_code, total,
    payment_status, delivery_method, shipping_address
  ) values (
    v_customer_id, v_order_number, 'pending', v_subtotal, v_delivery_fee, v_discount_amount, nullif(upper(trim(coalesce(p_coupon_code, ''))), ''),
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

  if v_coupon_id is not null then
    update public.coupons set usage_count = usage_count + 1 where id = v_coupon_id;
    insert into public.coupon_usages(coupon_id, customer_id, order_id, discount_amount)
    values(v_coupon_id, v_customer_id, v_order_id, v_discount_amount);
  end if;
  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'discount_amount', v_discount_amount,
    'total', v_total,
    'status', 'pending'
  );
end;
$$;

revoke all on function private.create_customer_order(jsonb, text, jsonb, text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.create_customer_order(jsonb, text, jsonb, text) to authenticated;

create or replace function public.create_customer_order(
  p_items jsonb,
  p_delivery_method text,
  p_shipping_address jsonb default null,
  p_coupon_code text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_customer_order(p_items, p_delivery_method, p_shipping_address, p_coupon_code);
$$;

revoke all on function public.create_customer_order(jsonb, text, jsonb, text) from public, anon;
grant execute on function public.create_customer_order(jsonb, text, jsonb, text) to authenticated;
