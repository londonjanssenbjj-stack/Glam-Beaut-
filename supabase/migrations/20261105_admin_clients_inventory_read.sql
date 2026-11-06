drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles
for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

drop policy if exists "Admins can read all product variants" on public.product_variants;
create policy "Admins can read all product variants" on public.product_variants
for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

grant select on public.profiles, public.product_variants to authenticated;
