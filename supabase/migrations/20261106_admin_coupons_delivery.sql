drop policy if exists "Admins can read coupons" on public.coupons;
create policy "Admins can read coupons" on public.coupons
for select to authenticated using (
  exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin')
);
drop policy if exists "Admins can read delivery regions" on public.delivery_regions;
create policy "Admins can read delivery regions" on public.delivery_regions
for select to authenticated using (
  exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin')
);
grant select on public.coupons, public.delivery_regions to authenticated;

create or replace function private.admin_save_coupon(
 p_id uuid, p_code text, p_discount_type text, p_discount_value numeric,
 p_minimum_order numeric, p_starts_at timestamptz, p_expires_at timestamptz,
 p_usage_limit integer, p_is_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then
  raise exception 'Acesso administrativo necessário' using errcode='42501';
 end if;
 if length(trim(p_code)) < 3 or p_discount_type not in ('percentage','fixed') or p_discount_value <= 0 or p_minimum_order < 0 then
  raise exception 'Dados do cupom inválidos';
 end if;
 if p_discount_type='percentage' and p_discount_value > 100 then raise exception 'Desconto percentual não pode exceder 100'; end if;
 if p_starts_at is not null and p_expires_at is not null and p_expires_at <= p_starts_at then raise exception 'Validade final deve ser posterior ao início'; end if;
 if p_id is null then
  insert into public.coupons(code,discount_type,discount_value,minimum_order,starts_at,expires_at,usage_limit,is_active)
  values(upper(trim(p_code)),p_discount_type,p_discount_value,p_minimum_order,p_starts_at,p_expires_at,p_usage_limit,p_is_active) returning id into v_id;
 else
  update public.coupons set code=upper(trim(p_code)),discount_type=p_discount_type,discount_value=p_discount_value,minimum_order=p_minimum_order,starts_at=p_starts_at,expires_at=p_expires_at,usage_limit=p_usage_limit,is_active=p_is_active where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Cupom não encontrado'; end if;
 end if;
 return v_id;
end; $$;
revoke all on function private.admin_save_coupon(uuid,text,text,numeric,numeric,timestamptz,timestamptz,integer,boolean) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.admin_save_coupon(uuid,text,text,numeric,numeric,timestamptz,timestamptz,integer,boolean) to authenticated;
create or replace function public.admin_save_coupon(p_id uuid,p_code text,p_discount_type text,p_discount_value numeric,p_minimum_order numeric,p_starts_at timestamptz,p_expires_at timestamptz,p_usage_limit integer,p_is_active boolean)
returns uuid language sql security invoker set search_path='' as $$ select private.admin_save_coupon(p_id,p_code,p_discount_type,p_discount_value,p_minimum_order,p_starts_at,p_expires_at,p_usage_limit,p_is_active); $$;
revoke all on function public.admin_save_coupon(uuid,text,text,numeric,numeric,timestamptz,timestamptz,integer,boolean) from public,anon;
grant execute on function public.admin_save_coupon(uuid,text,text,numeric,numeric,timestamptz,timestamptz,integer,boolean) to authenticated;

create or replace function private.admin_save_delivery_region(
 p_id uuid,p_name text,p_neighborhoods text[],p_fee numeric,p_free_from numeric,p_is_active boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then
  raise exception 'Acesso administrativo necessário' using errcode='42501';
 end if;
 if length(trim(p_name)) < 2 or p_fee < 0 or (p_free_from is not null and p_free_from < 0) then raise exception 'Dados da região inválidos'; end if;
 if coalesce(cardinality(p_neighborhoods),0)=0 then raise exception 'Informe ao menos um bairro atendido'; end if;
 if p_id is null then
  insert into public.delivery_regions(name,neighborhoods,fee,free_from,is_active) values(trim(p_name),p_neighborhoods,p_fee,p_free_from,p_is_active) returning id into v_id;
 else
  update public.delivery_regions set name=trim(p_name),neighborhoods=p_neighborhoods,fee=p_fee,free_from=p_free_from,is_active=p_is_active where id=p_id returning id into v_id;
  if v_id is null then raise exception 'Região não encontrada'; end if;
 end if;
 return v_id;
end; $$;
revoke all on function private.admin_save_delivery_region(uuid,text,text[],numeric,numeric,boolean) from public,anon;
grant execute on function private.admin_save_delivery_region(uuid,text,text[],numeric,numeric,boolean) to authenticated;
create or replace function public.admin_save_delivery_region(p_id uuid,p_name text,p_neighborhoods text[],p_fee numeric,p_free_from numeric,p_is_active boolean)
returns uuid language sql security invoker set search_path='' as $$ select private.admin_save_delivery_region(p_id,p_name,p_neighborhoods,p_fee,p_free_from,p_is_active); $$;
revoke all on function public.admin_save_delivery_region(uuid,text,text[],numeric,numeric,boolean) from public,anon;
grant execute on function public.admin_save_delivery_region(uuid,text,text[],numeric,numeric,boolean) to authenticated;