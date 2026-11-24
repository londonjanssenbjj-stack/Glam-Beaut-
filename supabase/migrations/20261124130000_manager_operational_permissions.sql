-- Draft migration: add the operational manager role without weakening RLS.
-- Apply only after reviewing in staging and testing role separation.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'customer'::text, 'manager'::text]));

-- Managers may operate product catalog and inventory; Master-only areas remain admin-only.
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins and managers can manage categories" ON public.categories
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins and managers can manage products" ON public.products
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "Admins can manage product variants" ON public.product_variants;
CREATE POLICY "Admins and managers can manage product variants" ON public.product_variants
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "Admins can read inventory" ON public.inventory;
CREATE POLICY "Admins and managers can read inventory" ON public.inventory
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "Admins can read inventory movements" ON public.inventory_movements;
CREATE POLICY "Admins and managers can read inventory movements" ON public.inventory_movements
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "Admins can read all orders" ON public.orders;
CREATE POLICY "Admins and managers can read all orders" ON public.orders
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ));

DROP POLICY IF EXISTS "Admins can read all order items" ON public.order_items;
CREATE POLICY "Admins and managers can read all order items" ON public.order_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid() AND r.role IN ('admin','manager')
  ));

-- Operational RPC authorization: stock adjustments and order-status updates.
CREATE OR REPLACE FUNCTION private.admin_adjust_inventory(p_variant_id uuid, p_quantity integer, p_note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE v_new_quantity integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role IN ('admin','manager')
  ) THEN
    RAISE EXCEPTION 'Acesso administrativo necessário' USING errcode = '42501';
  END IF;
  IF p_quantity = 0 THEN RAISE EXCEPTION 'A quantidade deve ser diferente de zero'; END IF;
  INSERT INTO public.inventory (variant_id, quantity, updated_at)
  VALUES (p_variant_id, p_quantity, now())
  ON CONFLICT (variant_id) DO UPDATE
    SET quantity = public.inventory.quantity + excluded.quantity, updated_at = now()
    WHERE public.inventory.quantity + excluded.quantity >= 0
  RETURNING quantity INTO v_new_quantity;
  IF v_new_quantity IS NULL THEN RAISE EXCEPTION 'Estoque insuficiente ou variação inexistente'; END IF;
  INSERT INTO public.inventory_movements (variant_id, movement_type, quantity, note)
  VALUES (p_variant_id, CASE WHEN p_quantity > 0 THEN 'entry' ELSE 'adjustment' END,
          p_quantity, nullif(trim(coalesce(p_note, '')), ''));
  RETURN v_new_quantity;
END;
$function$;

CREATE OR REPLACE FUNCTION private.admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ) THEN
    RAISE EXCEPTION 'Acesso administrativo necessário' USING errcode = '42501';
  END IF;
  IF p_status NOT IN ('confirmed','processing','shipped','ready_for_pickup','completed','cancelled','refunded') THEN
    RAISE EXCEPTION 'Status de pedido inválido';
  END IF;
  UPDATE public.orders SET status = p_status, updated_at = now() WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
END;
$function$;

-- The existing public wrappers remain in place; their implementation is updated above.
