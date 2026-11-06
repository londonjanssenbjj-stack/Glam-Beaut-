import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Método não permitido." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const accessToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const siteUrl = Deno.env.get("APP_SITE_URL");
    const webhookUrl = Deno.env.get("MERCADO_PAGO_WEBHOOK_URL");
    if (!supabaseUrl || !anonKey || !serviceKey || !accessToken || !mpToken || !siteUrl || !webhookUrl) {
      return reply(503, { error: "Integração de pagamento ainda não configurada no servidor." });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return reply(401, { error: "Sessão inválida." });

    const { order_id } = await req.json();
    if (typeof order_id !== "string") return reply(400, { error: "Pedido inválido." });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,customer_id,order_number,status,payment_status,total,created_at")
      .eq("id", order_id)
      .eq("customer_id", userData.user.id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.status === "cancelled" || order.payment_status !== "pending") {
      return reply(409, { error: "Pedido não encontrado ou não está aguardando pagamento." });
    }
    if (Number(order.total) <= 0) return reply(400, { error: "O total do pedido não permite pagamento online." });

    const { data: existing } = await admin.from("payments")
      .select("preference_id,checkout_url,status")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existing?.checkout_url && existing.status === "pending") {
      return reply(200, { checkout_url: existing.checkout_url, preference_id: existing.preference_id });
    }

    const { data: lines, error: linesError } = await admin.from("order_items")
      .select("product_name,sku,unit_price,quantity")
      .eq("order_id", order.id);
    if (linesError) throw linesError;
    if (!lines?.length) return reply(409, { error: "Pedido sem itens." });

    // A preferência usa o total fechado pelo banco. Os itens detalhados permanecem no pedido.
    const items = [{
      title: "Pedido " + order.order_number,
      description: lines.map((line) => line.product_name + " x" + line.quantity).join(", "),
      quantity: 1,
      unit_price: Number(order.total),
      currency_id: "BRL",
    }];

    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": order.id,
      },
      body: JSON.stringify({
        items,
        external_reference: order.id,
        notification_url: webhookUrl,
        back_urls: {
          success: siteUrl + "?payment=success&order=" + encodeURIComponent(order.order_number),
          pending: siteUrl + "?payment=pending&order=" + encodeURIComponent(order.order_number),
          failure: siteUrl + "?payment=failure&order=" + encodeURIComponent(order.order_number),
        },
        auto_return: "approved",
        statement_descriptor: "GLAM BEAUT",
        metadata: { order_id: order.id, order_number: order.order_number },
      }),
    });
    const preference = await preferenceResponse.json();
    if (!preferenceResponse.ok || !preference.id || !preference.init_point) {
      console.error("Mercado Pago preference error", preference);
      return reply(502, { error: "Não foi possível iniciar o pagamento. Tente novamente." });
    }

    const { error: saveError } = await admin.from("payments").upsert({
      order_id: order.id,
      provider: "mercado_pago",
      preference_id: String(preference.id),
      status: "pending",
      amount: Number(order.total),
      currency: "BRL",
      checkout_url: preference.init_point,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
    if (saveError) throw saveError;

    return reply(200, { checkout_url: preference.init_point, preference_id: String(preference.id) });
  } catch (error) {
    console.error("create-payment failed", error);
    return reply(500, { error: "Erro interno ao preparar o pagamento." });
  }
});
