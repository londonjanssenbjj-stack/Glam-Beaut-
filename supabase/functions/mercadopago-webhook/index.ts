import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySignature(signature: string, requestId: string, dataId: string, secret: string) {
  const fields = Object.fromEntries(signature.split(",").map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, value.join("=")];
  }));
  if (!fields.ts || !fields.v1 || !requestId || !dataId) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${fields.ts};`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(expected, fields.v1.toLowerCase());
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "Método não permitido." });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
    const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!supabaseUrl || !serviceKey || !mpToken || !webhookSecret) {
      return json(503, { error: "Webhook não configurado." });
    }

    const body = await req.json();
    const url = new URL(req.url);
    const dataId = url.searchParams.get("data.id") ?? body?.data?.id?.toString() ?? "";
    const requestId = req.headers.get("x-request-id") ?? "";
    const signature = req.headers.get("x-signature") ?? "";
    if (!dataId || !await verifySignature(signature, requestId, dataId, webhookSecret)) {
      return json(401, { error: "Assinatura inválida." });
    }
    if (body?.type !== "order" && body?.type !== "orders_v2") {
      return json(200, { received: true, ignored: true });
    }

    const mpResponse = await fetch("https://api.mercadopago.com/v1/orders/" + encodeURIComponent(dataId), {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const mpOrder = await mpResponse.json();
    if (!mpResponse.ok) return json(502, { error: "Não foi possível consultar a order no Mercado Pago." });

    const orderId = mpOrder.external_reference;
    if (typeof orderId !== "string" || String(mpOrder.id) !== dataId) return json(400, { error: "Order sem referência externa válida." });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,total,payment_status")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json(404, { error: "Pedido não encontrado." });

    const total = Number(mpOrder.total_amount);
    const paidTotal = Number(mpOrder.total_paid_amount ?? 0);
    const currency = mpOrder.currency ?? mpOrder.currency_id;
    if (currency !== "BRL" || !Number.isFinite(total) || Math.abs(total - Number(order.total)) > 0.01) {
      return json(409, { error: "Valor ou moeda da order não corresponde ao pedido." });
    }

    // An already-paid order must never be downgraded by a delayed/retried
    // pending or failed notification. A verified refund remains actionable.
    if (order.payment_status === "paid" && mpOrder.status !== "refunded") {
      return json(200, { received: true, payment_status: "paid", ignored_stale_update: true });
    }

    const status = String(mpOrder.status ?? "");
    const detail = String(mpOrder.status_detail ?? "");
    let paymentStatus: "paid" | "pending" | "failed" | "refunded";
    let providerStatus: "approved" | "in_process" | "rejected" | "cancelled" | "refunded";
    if (status === "processed" && detail === "accredited") {
      if (!Number.isFinite(paidTotal) || Math.abs(paidTotal - Number(order.total)) > 0.01) {
        return json(409, { error: "Valor efetivamente pago não corresponde ao pedido." });
      }
      paymentStatus = "paid";
      providerStatus = "approved";
    } else if (status === "refunded") {
      paymentStatus = "refunded";
      providerStatus = "refunded";
    } else if (status === "failed") {
      paymentStatus = "failed";
      providerStatus = "rejected";
    } else if (status === "canceled") {
      paymentStatus = "failed";
      providerStatus = "cancelled";
    } else if (status === "created" || status === "processing" || status === "action_required" || status === "processed") {
      paymentStatus = "pending";
      providerStatus = "in_process";
    } else {
      return json(202, { received: true, ignored_status: status });
    }

    const paymentId = mpOrder.transactions?.payments?.[0]?.id;
    const { data: existingPayment, error: existingPaymentError } = await admin.from("payments")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existingPaymentError) throw existingPaymentError;

    const paymentPayload = {
      order_id: order.id,
      provider: "mercado_pago",
      provider_order_id: String(mpOrder.id),
      ...(paymentId ? { provider_payment_id: String(paymentId) } : {}),
      status: providerStatus,
      amount: total,
      currency: "BRL",
      updated_at: new Date().toISOString(),
    };
    const paymentWrite = existingPayment
      ? await admin.from("payments").update(paymentPayload).eq("id", existingPayment.id).select("id").single()
      : await admin.from("payments").insert(paymentPayload).select("id").single();
    if (paymentWrite.error) throw paymentWrite.error;

    const eventId = String(body.id ?? `${mpOrder.id}:${mpOrder.last_updated_date ?? status}:${status}`);
    const { error: eventError } = await admin.from("payment_events").upsert({
      payment_id: paymentWrite.data.id,
      provider: "mercado_pago",
      provider_event_id: eventId,
      event_type: String(body.action ?? `order.${status}`),
      signature_valid: true,
      payload: body,
      processed_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_event_id" });
    if (eventError) throw eventError;

    const { error: orderUpdateError } = await admin.from("orders")
      .update({
        payment_status: paymentStatus,
        ...(paymentStatus === "paid" ? { status: "confirmed" } : {}),
        ...(paymentStatus === "refunded" ? { status: "refunded" } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (orderUpdateError) throw orderUpdateError;

    return json(200, { received: true, payment_status: paymentStatus });
  } catch (error) {
    console.error("mercadopago-webhook failed", error);
    return json(500, { error: "Falha ao processar notificação." });
  }
});
