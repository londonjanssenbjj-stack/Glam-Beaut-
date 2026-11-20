import { supabase } from "../lib/supabase";
import type { DbCategory, DbProduct, DbService, DbVariant } from "../types/database";

export async function getPublicCatalog() {
  const [categories, products, services, variants] = await Promise.all([
    supabase.from("categories").select("id,name,slug,sort_order,is_active").eq("is_active", true).order("sort_order"),
    supabase.from("products").select("id,category_id,name,slug,description,price,compare_at_price,sku,image_url,is_active,is_featured").eq("is_active", true).order("name"),
    supabase.from("services").select("id,name,slug,description,price,duration_minutes,is_active").eq("is_active", true).order("name"),
    supabase.from("product_variants").select("id,product_id,name,sku,price_override,is_active").eq("is_active", true).order("name"),
  ]);
  const error = categories.error ?? products.error ?? services.error ?? variants.error;
  if (error) throw error;
  return {
    categories: (categories.data ?? []) as DbCategory[],
    products: (products.data ?? []) as DbProduct[],
    services: (services.data ?? []) as DbService[],
    variants: (variants.data ?? []) as DbVariant[],
  };
}

export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { error } = await supabase.from("categories").select("id").limit(1);
    if (error) throw error;
    return { ok: true, message: "Conexão com o banco estabelecida." };
  } catch (cause) {
    return { ok: false, message: cause instanceof Error ? cause.message : "Falha na consulta do catálogo." };
  }
}
