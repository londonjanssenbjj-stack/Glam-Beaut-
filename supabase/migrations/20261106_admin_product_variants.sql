drop policy if exists "Admins can manage product variants" on public.product_variants;
create policy "Admins can manage product variants" on public.product_variants
for all to authenticated
using (exists (
  select 1 from public.user_roles r
  where r.user_id = (select auth.uid()) and r.role = 'admin'
))
with check (exists (
  select 1 from public.user_roles r
  where r.user_id = (select auth.uid()) and r.role = 'admin'
));
grant select, insert, update, delete on public.product_variants to authenticated;
