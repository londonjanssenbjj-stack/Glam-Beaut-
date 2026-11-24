/* GLAM BEAUT - SUPABASE INTEGRATION MODULE
 * Isolated integration scaffold. This file is NOT loaded by index.html yet.
 * Existing storefront and production main branch remain untouched.
 *
 * Before wiring into the UI, provide:
 * window.GLAM_SUPABASE_CONFIG = {
 *   url: "https://YOUR_PROJECT.supabase.co",
 *   publishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
 * };
 *
 * Never put Mercado Pago Access Token, webhook secret, or Supabase service-role
 * key in browser code.
 */
(function () {
  "use strict";

  const config = window.GLAM_SUPABASE_CONFIG || {};
  const SUPABASE_URL = String(config.url || "").replace(/\/$/, "");
  const SUPABASE_PUBLISHABLE_KEY = String(config.publishableKey || "");

  let clientPromise = null;

  function requireConfig() {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Supabase ainda não foi configurado: URL e publishable key são necessárias.");
    }
  }

  async function getClient() {
    requireConfig();
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Biblioteca Supabase JS não carregada.");
    }
    if (!clientPromise) {
      clientPromise = Promise.resolve(window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
      ));
    }
    return clientPromise;
  }

  async function getSession() {
    const sb = await getClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function ensureCustomerRecords(user, metadata = {}) {
    if (!user || !user.id) throw new Error("Usuário autenticado não encontrado.");
    const sb = await getClient();
    const { data: existingProfile, error: profileReadError } = await sb
      .from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profileReadError) throw profileReadError;
    if (!existingProfile) {
      const { error: profileInsertError } = await sb.from("profiles").insert({
        id: user.id,
        full_name: metadata.full_name || user.user_metadata?.full_name || "",
        phone: metadata.phone || user.user_metadata?.phone || null,
        email: user.email || null
      });
      if (profileInsertError) throw profileInsertError;
    }
    const { data: roleRow, error: roleReadError } = await sb
      .from("user_roles").select("user_id").eq("user_id", user.id).eq("role", "customer").maybeSingle();
    if (roleReadError) throw roleReadError;
    if (!roleRow) {
      const { error: roleInsertError } = await sb.from("user_roles").insert({
        user_id: user.id,
        role: "customer"
      });
      if (roleInsertError) throw roleInsertError;
    }
    return true;
  }

  async function signUp({ email, password, name, phone }) {
    const sb = await getClient();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: name || "", phone: phone || "" } }
    });
    if (error) throw error;
    if (data.user && data.session) await ensureCustomerRecords(data.user, { full_name: name, phone });
    return data;
  }

  async function signIn({ email, password }) {
    const sb = await getClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await ensureCustomerRecords(data.user);
    return data;
  }

  async function signOut() {
    const sb = await getClient();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
  }

  async function loadActiveCatalog() {
    const sb = await getClient();
    const { data, error } = await sb
      .from("products")
      .select("id,name,slug,description,price,compare_at_price,image_url,is_featured,category_id,product_variants(id,name,sku,price_override,is_active)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(product => ({
      ...product,
      product_variants: (product.product_variants || []).filter(v => v.is_active),
    })).filter(product => product.product_variants.length > 0);
  }

  async function loadActiveCategories() {
    const sb = await getClient();
    const { data, error } = await sb
      .from("categories")
      .select("id,name,slug,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function loadActiveDeliveryRegions() {
    const sb = await getClient();
    const { data, error } = await sb
      .from("delivery_regions")
      .select("id,name,neighborhoods,fee,free_from")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function createCustomerOrder({ items, deliveryMethod, shippingAddress, couponCode }) {
    const sb = await getClient();
    const session = await getSession();
    if (!session) throw new Error("Faça login para continuar o pedido.");
    if (!Array.isArray(items) || !items.length) throw new Error("Carrinho vazio.");
    const rpcArgs = {
      p_items: items.map(item => ({
        variant_id: item.variant_id,
        quantity: Number(item.quantity)
      })),
      p_delivery_method: deliveryMethod,
      p_shipping_address: deliveryMethod === "delivery" ? shippingAddress : null,
      p_coupon_code: couponCode || null
    };
    const { data, error } = await sb.rpc("create_customer_order", rpcArgs);
    if (error) throw error;
    return data;
  }

  async function startMercadoPagoCheckout(orderId) {
    const sb = await getClient();
    const session = await getSession();
    if (!session) throw new Error("Faça login para iniciar o pagamento.");
    const { data, error } = await sb.functions.invoke("create-payment", {
      body: { order_id: orderId }
    });
    if (error) throw error;
    const checkoutUrl = data && data.checkout_url;
    if (!checkoutUrl || !/^https:\/\//i.test(checkoutUrl)) {
      throw new Error("A função de pagamento não retornou uma URL de checkout válida.");
    }
    return checkoutUrl;
  }

  async function getOrderStatus(orderId) {
    const sb = await getClient();
    const session = await getSession();
    if (!session) throw new Error("Faça login para consultar o pedido.");
    // Deliberately no direct-table query here: order visibility should be
    // provided by a verified, RLS-protected endpoint/RPC before integration.
    throw new Error("Consulta de status precisa do endpoint seguro definido para o schema de pedidos.");
  }

  window.GlamSupabase = Object.freeze({
    getClient,
    getSession,
    signUp,
    signIn,
    signOut,
    ensureCustomerRecords,
    loadActiveCatalog,
    loadActiveCategories,
    loadActiveDeliveryRegions,
    createCustomerOrder,
    startMercadoPagoCheckout,
    getOrderStatus
  });
})();
