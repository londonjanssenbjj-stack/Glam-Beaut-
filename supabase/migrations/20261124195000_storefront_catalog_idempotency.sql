-- Ensure storefront category slugs used by the current public category filters exist.
insert into public.categories(name, slug, sort_order, is_active)
values
  ('Skincare', 'skincare', 10, true),
  ('Perfumaria', 'perfumaria', 20, true),
  ('Roupas', 'roupas', 30, true),
  ('Bolsas', 'bolsas', 40, true),
  ('Acessórios', 'acessorios', 50, true),
  ('Kits e Presentes', 'kits', 60, true)
on conflict (slug) do update
set name = excluded.name, sort_order = excluded.sort_order, is_active = true;

-- Glam Beaut storefront catalog + idempotent order wrapper
-- Draft for branch review only. NOT applied to Supabase.
-- Public catalog reveals only sellable active variants and availability (boolean), never exact inventory.

create or replace function public.storefront_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_data order by product_name, variant_name), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'product_id', p.id,
      'product_name', p.name,
      'slug', p.slug,
      'description', p.description,
      'image_url', p.image_url,
      'is_featured', p.is_featured,
      'created_at', p.created_at,
      'category_name', c.name,
      'category_slug', c.slug,
      'variant_id', pv.id,
      'variant_name', pv.name,
      'sku', coalesce(pv.sku, p.sku),
      'price', coalesce(pv.price_override, p.price)
    ) as row_data,
    p.name as product_name,
    pv.name as variant_name
    from public.products p
    join public.product_variants pv on pv.product_id = p.id
    left join public.categories c on c.id = p.category_id
    join public.inventory i on i.variant_id = pv.id
    where p.is_active = true
      and pv.is_active = true
      and i.quantity > 0
  ) catalog_rows;
$$;

revoke all on function public.storefront_catalog() from public;
grant execute on function public.storefront_catalog() to anon, authenticated;

create table if not exists private.customer_order_requests (
  request_key uuid primary key,
  customer_id uuid not null,
  payload_hash text not null,
  order_id uuid unique references public.orders(id),
  response jsonb,
  created_at timestamptz not null default now()
);

alter table private.customer_order_requests enable row level security;
revoke all on private.customer_order_requests from anon, authenticated;

create or replace function public.create_customer_order_idempotent(
  p_request_key uuid,
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
  v_user uuid := auth.uid();
  v_hash text;
  v_row private.customer_order_requests%rowtype;
  v_created integer;
  v_response jsonb;
begin
  if v_user is null then
    raise exception 'Autenticação necessária' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'Chave de requisição obrigatória';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Itens do pedido inválidos';
  end if;

  -- Reject duplicate variant IDs before canonical hashing, matching the authoritative RPC.
  if exists (
    select 1
    from jsonb_array_elements(p_items) x
    group by x.value->>'variant_id'
    having count(*) > 1
  ) then
    raise exception 'A sacola contém variações duplicadas';
  end if;

  -- Canonical request hash: order by variant UUID and quantity, and normalize coupon.
  select encode(extensions.digest(
    jsonb_build_object(
      'items', (select coalesce(jsonb_agg(x.value order by x.value->>'variant_id', x.value->>'quantity'), '[]'::jsonb)
                from jsonb_array_elements(p_items) x),
      'delivery_method', p_delivery_method,
      'shipping_address', coalesce(p_shipping_address, '{}'::jsonb),
      'coupon_code', upper(trim(coalesce(p_coupon_code, '')))
    )::text, 'sha256'
  ), 'hex') into v_hash;

  insert into private.customer_order_requests(request_key,customer_id,payload_hash)
  values (p_request_key,v_user,v_hash)
  on conflict (request_key) do nothing;
  get diagnostics v_created = row_count;

  select * into v_row
  from private.customer_order_requests
  where request_key = p_request_key
  for update;

  if v_row.customer_id <> v_user then
    raise exception 'Chave de pedido pertence a outra conta' using errcode = '42501';
  end if;
  if v_row.payload_hash <> v_hash then
    raise exception 'Chave repetida com dados diferentes. Inicie um novo checkout.' using errcode = '23505';
  end if;

  if v_created = 0 then
    if v_row.response is null then
      raise exception 'Pedido idempotente ainda está sendo processado. Tente novamente.';
    end if;
    return v_row.response;
  end if;

  -- Existing order RPC is the authoritative transactional validator/reserver.
  v_response := public.create_customer_order(
    p_items, p_delivery_method, p_shipping_address, p_coupon_code
  );

  update private.customer_order_requests
  set order_id = (v_response->>'order_id')::uuid,
      response = v_response
  where request_key = p_request_key;

  return v_response;
end;
$$;

revoke all on function public.create_customer_order_idempotent(uuid,jsonb,text,jsonb,text) from public, anon;
grant execute on function public.create_customer_order_idempotent(uuid,jsonb,text,jsonb,text) to authenticated;
