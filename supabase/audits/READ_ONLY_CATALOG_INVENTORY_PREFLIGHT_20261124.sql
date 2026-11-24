-- GLAM BEAUT: READ-ONLY CATALOG/INVENTORY PREFLIGHT
-- Execute only in an authorized SQL editor after reviewing table names.
-- This script performs SELECT only; it does not alter production data.

-- 1) Existing catalog products and their status, SKU, image, and price
select
  p.id, p.name, p.sku, p.price, p.is_active,
  p.image_url, p.category_id, p.created_at
from public.products p
order by p.name;

-- 2) Variant summary per product (detect products missing variants)
select
  p.id as product_id, p.name,
  count(pv.id) as variant_count,
  count(*) filter (where pv.id is not null and coalesce(pv.sku,p.sku) is not null) as sku_present_count
from public.products p
left join public.product_variants pv on pv.product_id = p.id
group by p.id,p.name
order by p.name;

-- 3) Duplicate SKU candidates across product/variant records
with sku_rows as (
  select p.id as product_id, p.name as product_name,
         coalesce(pv.sku,p.sku) as sku,
         pv.id as variant_id, pv.name as variant_name
  from public.products p
  left join public.product_variants pv on pv.product_id=p.id
  where coalesce(pv.sku,p.sku) is not null
)
select sku, count(*) as occurrences,
       string_agg(product_name || coalesce(' / '||variant_name,''), '; ') as records
from sku_rows
group by sku
having count(*) > 1
order by sku;

-- 4) Inventory balances and movement history count by variant
select
  p.id as product_id, p.name as product_name,
  pv.id as variant_id, pv.name as variant_name, pv.sku,
  coalesce(inv.quantity,0) as quantity,
  coalesce(m.movements_count,0) as movement_count
from public.products p
join public.product_variants pv on pv.product_id=p.id
left join public.inventory inv on inv.variant_id=pv.id
left join (
  select variant_id, count(*) as movements_count
  from public.inventory_movements
  group by variant_id
) m on m.variant_id=pv.id
order by p.name,pv.name;

-- 5) Active catalog check: flag active product lacking image or active variant
select p.id,p.name,p.is_active,p.image_url,
       count(pv.id) filter (where pv.is_active) as active_variants
from public.products p
left join public.product_variants pv on pv.product_id=p.id
where p.is_active
group by p.id,p.name,p.is_active,p.image_url
having p.image_url is null
    or count(pv.id) filter (where pv.is_active)=0
order by p.name;

-- 6) Orders/payment status summary for checkout QA (avoid customer personal data)
select status, payment_status, count(*) as order_count
from public.orders
group by status,payment_status
order by status,payment_status;
