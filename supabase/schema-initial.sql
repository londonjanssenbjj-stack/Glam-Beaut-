-- Glam Beaut — estrutura inicial do banco
-- Revisar antes de executar no projeto correto.
-- Não contém chaves, senhas ou dados reais.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= price),
  sku text unique,
  image_url text,
  is_active boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text unique,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id),
  movement_type text not null check (movement_type in ('entry','sale','adjustment','return')),
  quantity integer not null check (quantity <> 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id),
  order_number text not null unique,
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','ready_for_pickup','completed','cancelled','refunded')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  delivery_method text not null check (delivery_method in ('delivery','pickup')),
  shipping_address jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  sku text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) check (price is null or price >= 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id),
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'requested' check (status in ('requested','confirmed','completed','cancelled','no_show')),
  customer_note text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists products_active_category_idx on public.products (is_active, category_id);
create index if not exists variants_product_idx on public.product_variants (product_id);
create index if not exists orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index if not exists appointments_customer_start_idx on public.appointments (customer_id, starts_at);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
on public.categories for select to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select to anon, authenticated
using (is_active = true);

drop policy if exists "Public can read active variants" on public.product_variants;
create policy "Public can read active variants"
on public.product_variants for select to anon, authenticated
using (is_active = true and exists (
  select 1 from public.products p
  where p.id = product_id and p.is_active = true
));

drop policy if exists "Public can read active services" on public.services;
create policy "Public can read active services"
on public.services for select to anon, authenticated
using (is_active = true);

drop policy if exists "Customers can read own profile" on public.profiles;
create policy "Customers can read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Customers can create own profile" on public.profiles;
create policy "Customers can create own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Customers can update own profile" on public.profiles;
create policy "Customers can update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Customers can read own orders" on public.orders;
create policy "Customers can read own orders"
on public.orders for select to authenticated
using ((select auth.uid()) = customer_id);

drop policy if exists "Customers can read own order items" on public.order_items;
create policy "Customers can read own order items"
on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and o.customer_id = (select auth.uid())
));

drop policy if exists "Customers can read own appointments" on public.appointments;
create policy "Customers can read own appointments"
on public.appointments for select to authenticated
using ((select auth.uid()) = customer_id);

-- Exposição explícita da Data API: apenas leitura do catálogo público.
grant select on public.categories, public.products, public.product_variants, public.services to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.orders, public.order_items, public.appointments to authenticated;

-- Sem grants de cliente para estoque, movimentações, criação/alteração de pedidos
-- ou agendamentos. Essas operações serão executadas por Edge Functions autenticadas.

-- Complementos necessários para administração, endereços, entrega e pagamentos.
-- Escritas administrativas e transacionais permanecem exclusivamente no backend
-- (Edge Functions), após validação de sessão e papel administrativo.

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','staff','customer')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  postal_code text not null,
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null default 'Corumbá',
  state text not null default 'MS',
  reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  neighborhoods text[] not null default '{}',
  fee numeric(12,2) not null default 0 check (fee >= 0),
  free_from numeric(12,2) check (free_from is null or free_from >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id),
  customer_id uuid not null references auth.users(id),
  order_id uuid references public.orders(id) on delete set null,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null check (provider in ('mercado_pago')),
  provider_payment_id text unique,
  preference_id text,
  status text not null default 'pending' check (status in ('pending','approved','authorized','in_process','rejected','cancelled','refunded','charged_back')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null check (provider in ('mercado_pago')),
  provider_event_id text,
  event_type text not null,
  signature_valid boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'Glam Beaut',
  whatsapp_phone text,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists addresses_customer_idx on public.addresses(customer_id);
create index if not exists coupon_usages_customer_idx on public.coupon_usages(customer_id, created_at desc);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payment_events_payment_idx on public.payment_events(payment_id, created_at desc);

alter table public.user_roles enable row level security;
alter table public.addresses enable row level security;
alter table public.delivery_regions enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_usages enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "Users can read own roles" on public.user_roles;
create policy "Users can read own roles" on public.user_roles
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Customers can manage own addresses" on public.addresses;
create policy "Customers can manage own addresses" on public.addresses
for all to authenticated
using ((select auth.uid()) = customer_id)
with check ((select auth.uid()) = customer_id);

drop policy if exists "Public can read active delivery regions" on public.delivery_regions;
create policy "Public can read active delivery regions" on public.delivery_regions
for select to anon, authenticated using (is_active = true);

drop policy if exists "Customers can read own coupon usages" on public.coupon_usages;
create policy "Customers can read own coupon usages" on public.coupon_usages
for select to authenticated using ((select auth.uid()) = customer_id);

drop policy if exists "Customers can read own payments" on public.payments;
create policy "Customers can read own payments" on public.payments
for select to authenticated using (exists (
  select 1 from public.orders o
  where o.id = order_id and o.customer_id = (select auth.uid())
));

-- Dados de pagamento, cupons, configurações e eventos não são expostos
-- diretamente ao navegador. O backend faz as operações privilegiadas.
grant select on public.user_roles, public.addresses, public.coupon_usages, public.payments to authenticated;
grant insert, update, delete on public.addresses to authenticated;
grant select on public.delivery_regions to anon, authenticated;
