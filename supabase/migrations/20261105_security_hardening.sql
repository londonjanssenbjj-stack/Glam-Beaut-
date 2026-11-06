-- Glam Beaut: endurecimento de acesso e índices após primeira auditoria.
-- Tabelas operacionais permanecem inacessíveis diretamente pelo navegador;
-- operações serão mediadas por Edge Functions e validação de autorização.

drop policy if exists "No direct client access to inventory" on public.inventory;
create policy "No direct client access to inventory" on public.inventory
for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct client access to inventory movements" on public.inventory_movements;
create policy "No direct client access to inventory movements" on public.inventory_movements
for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct client access to coupons" on public.coupons;
create policy "No direct client access to coupons" on public.coupons
for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct client access to payment events" on public.payment_events;
create policy "No direct client access to payment events" on public.payment_events
for all to anon, authenticated using (false) with check (false);

drop policy if exists "No direct client access to store settings" on public.store_settings;
create policy "No direct client access to store settings" on public.store_settings
for all to anon, authenticated using (false) with check (false);

-- A função de automação RLS já existente no projeto não deve ser invocável
-- por clientes anônimos ou autenticados.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists appointments_service_idx on public.appointments(service_id);
create index if not exists coupon_usages_coupon_idx on public.coupon_usages(coupon_id);
create index if not exists coupon_usages_order_idx on public.coupon_usages(order_id);
create index if not exists inventory_movements_variant_idx on public.inventory_movements(variant_id);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists order_items_variant_idx on public.order_items(variant_id);
create index if not exists products_category_idx on public.products(category_id);
