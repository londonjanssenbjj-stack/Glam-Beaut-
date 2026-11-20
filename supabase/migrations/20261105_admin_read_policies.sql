-- Leitura administrativa restrita para o painel Glam Beaut.
-- Escritas sensíveis permanecem no backend após validação de role.
drop policy if exists "Admins can manage categories" on public.categories;
create policy "Admins can manage categories" on public.categories
for all to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'))
with check (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can manage products" on public.products;
create policy "Admins can manage products" on public.products
for all to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'))
with check (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can read all orders" on public.orders;
create policy "Admins can read all orders" on public.orders
for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can read all order items" on public.order_items;
create policy "Admins can read all order items" on public.order_items
for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can read all appointments" on public.appointments;
create policy "Admins can read all appointments" on public.appointments
for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can read inventory" on public.inventory;
create policy "Admins can read inventory" on public.inventory
for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can read inventory movements" on public.inventory_movements;
create policy "Admins can read inventory movements" on public.inventory_movements
for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can manage services" on public.services;
create policy "Admins can manage services" on public.services
for all to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'))
with check (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

grant select on public.orders, public.order_items, public.appointments, public.inventory, public.inventory_movements to authenticated;
grant insert, update, delete on public.categories, public.products, public.services to authenticated;
