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

  function getVariantPrice(product, variant) {
    if (!product || !variant) throw new Error("Produto/variante inválidos.");
    const override = variant.price_override;
    const base = product.price;
    const chosen = override !== null && override !== undefined ? override : base;
    const price = Number(chosen);
    if (!Number.isFinite(price) || price < 0) throw new Error("Preço da variante inválido.");
    return price;
  }

  function normalizeCartItems(items) {
    if (!Array.isArray(items)) throw new Error("Carrinho inválido.");
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const map = new Map();
    for (const item of items) {
      if (!uuidPattern.test(String(item.variant_id || ""))) throw new Error("Variante inválida no carrinho.");
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error("Quantidade inválida.");
      const combined = (map.get(item.variant_id) || 0) + qty;
      if (combined > 99) throw new Error("Limite de quantidade por variante excedido.");
      map.set(item.variant_id, combined);
    }
    return Array.from(map, ([variant_id, quantity]) => ({ variant_id, quantity }));
  }

  function parsePaymentReturn(search = window.location.search) {
    const params = new URLSearchParams(search);
    const status = (params.get("payment") || params.get("status") || params.get("collection_status") || "").toLowerCase();
    const orderId = params.get("order_id") || params.get("order") || params.get("external_reference") || "";
    const normalized = ["success", "approved"].includes(status) ? "success"
      : ["pending", "in_process", "processing"].includes(status) ? "pending"
      : ["failure", "failed", "rejected", "cancelled", "canceled", "refunded"].includes(status) ? "failure"
      : "unknown";
    return { status: normalized, orderId };
  }

  async function createCustomerOrder({ items, deliveryMethod, shippingAddress, couponCode }) {
    const sb = await getClient();
    const session = await getSession();
    if (!session) throw new Error("Faça login para continuar o pedido.");
    if (!Array.isArray(items) || !items.length) throw new Error("Carrinho vazio.");
    if (!["delivery", "pickup"].includes(deliveryMethod)) {
      throw new Error("Escolha entrega ou retirada.");
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const normalizedItems = normalizeCartItems(items).map(item => {
      const quantity = Number(item.quantity);
      if (!uuidPattern.test(String(item.variant_id || ""))) {
        throw new Error("Uma variante do carrinho possui identificador inválido.");
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        throw new Error("Quantidade inválida no carrinho.");
      }
      return { variant_id: item.variant_id, quantity };
    });
    if (deliveryMethod === "delivery") {
      const requiredAddressFields = ["recipient_name", "phone", "postal_code", "street", "number", "neighborhood"];
      if (!shippingAddress || requiredAddressFields.some(key => !String(shippingAddress[key] || "").trim())) {
        throw new Error("Preencha todos os dados necessários para entrega.");
      }
    }
    const rpcArgs = {
      p_items: normalizedItems,
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

  async function verifyPaymentReturn(search = window.location.search) {
    const returned = parsePaymentReturn(search);
    if (!returned.orderId) return { status: "unknown", verified: false, reason: "missing_order_id" };
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9]{3}-[89ab][0-9]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(returned.orderId) && !/^GL-\\d{14}-[A-F0-9]{6}$/i.test(returned.orderId)) {
      return { status: "unknown", verified: false, reason: "invalid_order_identifier" };
    }
    const serverData = await getOrderStatus(returned.orderId);
    const order = serverData.order || {};
    const payment = serverData.payment || {};
    const orderStatus = String(order.payment_status || payment.status || "").toLowerCase();
    const verifiedStatus = orderStatus === "approved" || orderStatus === "paid" ? "success"
      : ["pending", "in_process", "processing"].includes(orderStatus) ? "pending"
      : ["rejected", "cancelled", "canceled", "failed", "refunded"].includes(orderStatus) ? "failure"
      : "unknown";
    return { status: verifiedStatus, verified: true, order: order, payment: payment };
  }

  async function getOrderStatus(orderId) {
    const sb = await getClient();
    const session = await getSession();
    if (!session) throw new Error("Faça login para consultar o pedido.");
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidPattern.test(String(orderId || ""));
    const isOrderNumber = /^GL-\\d{14}-[A-F0-9]{6}$/i.test(String(orderId || ""));
    if (!isUuid && !isOrderNumber) throw new Error("Identificador de pedido inválido.");
    const { data, error } = await sb.functions.invoke("order-status", {
      body: isUuid ? { order_id: orderId } : { order_number: orderId }
    });
    if (error) throw error;
    if (!data || !data.order) throw new Error("Resposta de status inválida.");
    return data;
  }

  window.GlamSupabase = Object.freeze({
    getClient,
    getSession,
    signUp,
    signIn,
    signOut,
    ensureCustomerRecords,
    loadActiveCatalog,
    getVariantPrice: getVariantPrice,
    normalizeCartItems,
    parsePaymentReturn,
    verifyPaymentReturn,
    loadActiveCategories,
    loadActiveDeliveryRegions,
    createCustomerOrder,
    startMercadoPagoCheckout,
    getOrderStatus
  });
})();
