import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!allowedOrigin || req.headers.get("Origin") !== allowedOrigin) return reply(403, { error: "Origem não autorizada." });
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    const accessToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const siteUrl = Deno.env.get("APP_SITE_URL");
    const webhookUrl = Deno.env.get("MERCADO_PAGO_WEBHOOK_URL");
    if (!supabaseUrl || !anonKey || !serviceKey || !accessToken || !mpToken || !siteUrl || !webhookUrl) {
      return reply(503, { error: "Integração de pagamento ainda não configurada no servidor." });
    }

    const site = new URL(siteUrl);
    const webhook = new URL(webhookUrl);
    if (site.protocol !== "https:" || webhook.protocol !== "https:" || site.origin !== allowedOrigin) {
      return reply(503, { error: "URLs HTTPS e origem do site precisam estar configuradas corretamente." });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return reply(401, { error: "Sessão inválida." });

    const payload = await req.json();
    const orderId = payload?.order_id;
    if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      return reply(400, { error: "Pedido inválido." });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,customer_id,order_number,status,payment_status,total")
      .eq("id", orderId)
      .eq("customer_id", userData.user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.status === "cancelled" || order.status === "refunded" || order.payment_status !== "pending") {
      return reply(409, { error: "Pedido não encontrado ou não está aguardando pagamento." });
    }
    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) return reply(400, { error: "O total do pedido não permite pagamento online." });

    const { data: existing, error: existingError } = await admin.from("payments")
      .select("provider_order_id,checkout_url,status")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.provider_order_id && existing.checkout_url && existing.status === "pending") {
      return reply(200, { checkout_url: existing.checkout_url, order_id: existing.provider_order_id });
    }

    const { data: lines, error: linesError } = await admin.from("order_items")
      .select("product_name,quantity")
      .eq("order_id", order.id);
    if (linesError) throw linesError;
    if (!lines?.length) return reply(409, { error: "Pedido sem itens." });

    // O total vem do pedido fechado no banco (inclui frete e descontos).
    // O Checkout Pro recebe um único item consolidado para manter a soma exata.
    const description = lines.map((line) => `${line.product_name} x${line.quantity}`).join(", ").slice(0, 250);
    const orderBody: Record<string, unknown> = {
      type: "online",
      processing_mode: "manual",
      capture_mode: "automatic_async",
      total_amount: total.toFixed(2),
      external_reference: order.id,
      description: `Glam Beaut - Pedido ${order.order_number}`,
      items: [{
        title: `Pedido ${order.order_number}`,
        description,
        quantity: 1,
        unit_price: total.toFixed(2),
      }],
      config: {
        online: {
          success_url: siteUrl + "?payment=success&order=" + encodeURIComponent(order.order_number),
          pending_url: siteUrl + "?payment=pending&order=" + encodeURIComponent(order.order_number),
          failure_url: siteUrl + "?payment=failure&order=" + encodeURIComponent(order.order_number),
          auto_return: "approved",
        },
      },
    };
    if (userData.user.email) orderBody.payer = { email: userData.user.email };

    const mpResponse = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.id,
      },
      body: JSON.stringify(orderBody),
    });
    const mpOrder = await mpResponse.json();
    if (!mpResponse.ok || !mpOrder.id || !mpOrder.checkout_url) {
      console.error("Mercado Pago Orders API error", { status: mpResponse.status, response: mpOrder });
      return reply(502, { error: "Não foi possível iniciar o pagamento. Tente novamente." });
    }

    const { error: saveError } = await admin.from("payments").upsert({
      order_id: order.id,
      provider: "mercado_pago",
      provider_order_id: String(mpOrder.id),
      status: "pending",
      amount: total,
      currency: "BRL",
      checkout_url: mpOrder.checkout_url,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
    if (saveError) throw saveError;

    return reply(200, { checkout_url: mpOrder.checkout_url, order_id: String(mpOrder.id) });
  } catch (error) {
    console.error("create-payment failed", error);
    return reply(500, { error: "Erro interno ao preparar o pagamento." });
  }
});
