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
