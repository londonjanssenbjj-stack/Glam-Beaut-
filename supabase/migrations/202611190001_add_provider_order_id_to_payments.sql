-- Persist the Mercado Pago Orders API identifier separately from the legacy
-- Preferences API identifier stored in preference_id.
alter table public.payments
  add column if not exists provider_order_id text;

create unique index if not exists payments_provider_order_id_key
  on public.payments (provider_order_id)
  where provider_order_id is not null;
