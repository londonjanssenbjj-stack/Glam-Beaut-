import { supabase } from "../lib/supabase";
import type { DbCategory } from "../types/database";
import type { AdminAppointment, AdminInventoryItem, AdminOrder, AdminProduct, AdminProfile, AdminService } from "../types/admin";

export async function loadAdminData() {
  const [products, services, categories, orders, appointments, profiles, inventory] = await Promise.all([
    supabase.from("products").select("id,category_id,name,slug,description,price,image_url,is_active,is_featured").order("created_at", { ascending: false }),
    supabase.from("services").select("id,name,slug,description,price,duration_minutes,is_active").order("name"),
    supabase.from("categories").select("id,name,slug,sort_order,is_active").order("sort_order"),
    supabase.from("orders").select("id,order_number,status,payment_status,total,delivery_method,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("appointments").select("id,service_name,starts_at,status,customer_id").order("starts_at", { ascending: true }).limit(100),\n    supabase.from("profiles").select("id,full_name,phone,email").order("full_name").limit(200),\n    supabase.from("inventory").select("variant_id,quantity,updated_at,product_variants!inner(id,name,sku,product_id,products(name))").order("updated_at", { ascending: false }).limit(200),
  ]);
  const error = products.error ?? services.error ?? categories.error ?? orders.error ?? appointments.error ?? profiles.error ?? inventory.error;
  if (error) throw error;
  return {
    products: (products.data ?? []) as AdminProduct[],
    services: (services.data ?? []) as AdminService[],
    categories: (categories.data ?? []) as DbCategory[],
    orders: (orders.data ?? []) as AdminOrder[],
    appointments: (appointments.data ?? []) as AdminAppointment[],\n    profiles: (profiles.data ?? []) as AdminProfile[],\n    inventory: (inventory.data ?? []) as unknown as AdminInventoryItem[],
  };
}

export async function saveAdminProduct(input: Omit<AdminProduct, "id">, id?: string) {
  const result = id
    ? await supabase.from("products").update(input).eq("id", id).select("id").single()
    : await supabase.from("products").insert(input).select("id").single();
  if (result.error) throw result.error;
}

export async function setProductActive(id: string, isActive: boolean) {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function saveAdminService(input: Omit<AdminService, "id">, id?: string) {
  const result = id
    ? await supabase.from("services").update(input).eq("id", id).select("id").single()
    : await supabase.from("services").insert(input).select("id").single();
  if (result.error) throw result.error;
}

export async function setServiceActive(id: string, isActive: boolean) {
  const { error } = await supabase.from("services").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function adjustInventory(variantId: string, quantity: number, note: string) {
  const { error } = await supabase.rpc("admin_adjust_inventory", {
    p_variant_id: variantId, p_quantity: quantity, p_note: note,
  });
  if (error) throw error;
}
