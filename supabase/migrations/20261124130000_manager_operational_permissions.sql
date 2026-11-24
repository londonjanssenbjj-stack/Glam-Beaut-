-- Draft migration: add operational manager role without weakening existing RLS.
-- Intended for review/test on an isolated Supabase branch before production application.
-- Admin policies are preserved. Manager permissions are additive and explicitly exclude DELETE.

ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'customer'::text, 'manager'::text]));

-- Managers need visibility of inactive operational records for administration.
CREATE POLICY "Managers can read categories" ON public.categories FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can read products" ON public.products FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can read product variants" ON public.product_variants FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));

-- Managers may create and update operational records, but cannot delete categories/products/variants.
CREATE POLICY "Managers can insert categories" ON public.categories FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can update categories" ON public.categories FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));

CREATE POLICY "Managers can insert products" ON public.products FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can update products" ON public.products FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));

CREATE POLICY "Managers can insert product variants" ON public.product_variants FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can update product variants" ON public.product_variants FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));

CREATE POLICY "Managers can read inventory" ON public.inventory FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can read inventory movements" ON public.inventory_movements FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can read all orders" ON public.orders FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));
CREATE POLICY "Managers can read all order items" ON public.order_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'manager'));

CREATE OR REPLACE FUNCTION private.admin_adjust_inventory(p_variant_id uuid, p_quantity integer, p_note text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_new_quantity integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','manager')
  ) THEN RAISE EXCEPTION 'Acesso administrativo necessário' USING errcode = '42501'; END IF;
  IF p_quantity = 0 THEN RAISE EXCEPTION 'A quantidade deve ser diferente de zero'; END IF;

  -- Create a zero-balance row if absent; subsequent UPDATE applies positive/negative delta atomically.
  INSERT INTO public.inventory (variant_id, quantity, updated_at) VALUES (p_variant_id, 0, now())
  ON CONFLICT (variant_id) DO NOTHING;
  UPDATE public.inventory
    SET quantity = quantity + p_quantity, updated_at = now()
    WHERE variant_id = p_variant_id AND quantity + p_quantity >= 0
  RETURNING quantity INTO v_new_quantity;
  IF v_new_quantity IS NULL THEN RAISE EXCEPTION 'Estoque insuficiente ou variação inexistente'; END IF;

  INSERT INTO public.inventory_movements (variant_id, movement_type, quantity, note)
  VALUES (p_variant_id, CASE WHEN p_quantity > 0 THEN 'entry' ELSE 'adjustment' END,
          p_quantity, nullif(trim(coalesce(p_note, '')), ''));
  RETURN v_new_quantity;
END;
$function$;

CREATE OR REPLACE FUNCTION private.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_role text; v_current_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso administrativo necessário' USING errcode = '42501'; END IF;
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager') LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Acesso administrativo necessário' USING errcode = '42501'; END IF;
  IF p_status NOT IN ('confirmed','processing','shipped','ready_for_pickup','completed','cancelled','refunded') THEN
    RAISE EXCEPTION 'Status de pedido inválido'; END IF;
  SELECT status INTO v_current_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_current_status IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_role = 'manager' THEN
    IF p_status IN ('cancelled','refunded') THEN
      RAISE EXCEPTION 'Cancelamento e reembolso são restritos ao Admin Master' USING errcode = '42501';
    END IF;
    IF v_current_status IN ('cancelled','refunded') THEN
      RAISE EXCEPTION 'Pedidos cancelados ou reembolsados não podem ser reabertos pelo gerente' USING errcode = '42501';
    END IF;
  END IF;
  UPDATE public.orders SET status = p_status, updated_at = now() WHERE id = p_order_id;
END;
$function$;

-- Role assignment is intentionally excluded from this migration.
-- Assign the manager role only after reviewed migration and explicit identity confirmation,
-- using a separate controlled admin operation.
