create table if not exists public.customer_birthdays (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  birth_date date not null,
  updated_at timestamptz not null default now(),
  constraint customer_birthdays_valid_date check (birth_date <= current_date)
);
alter table public.customer_birthdays enable row level security;
drop policy if exists "Customers can manage own birthday" on public.customer_birthdays;
create policy "Customers can manage own birthday" on public.customer_birthdays
for all to authenticated using ((select auth.uid()) = customer_id)
with check ((select auth.uid()) = customer_id);
drop policy if exists "Admins can read customer birthdays" on public.customer_birthdays;
create policy "Admins can read customer birthdays" on public.customer_birthdays
for select to authenticated using (
 exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
grant select,insert,update,delete on public.customer_birthdays to authenticated;
create index if not exists customer_birthdays_month_day_idx on public.customer_birthdays (extract(month from birth_date), extract(day from birth_date));