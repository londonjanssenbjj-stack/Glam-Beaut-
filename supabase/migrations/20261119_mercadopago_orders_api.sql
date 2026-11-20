-- Add the Mercado Pago Orders API identifier while retaining the legacy preference_id.
alter table public.payments
  add column if not exists provider_order_id text;

create unique index if not exists payments_provider_order_id_uidx
  on public.payments(provider_order_id)
  where provider_order_id is not null;
