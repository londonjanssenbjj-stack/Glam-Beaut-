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
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${fields.ts};`;
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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mpToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    const webhookSecret = Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET");
    if (!supabaseUrl || !serviceKey || !mpToken || !webhookSecret) {
      return json(503, { error: "Webhook não configurado." });
    }

    const body = await req.json();
    const dataId = req.url ? new URL(req.url).searchParams.get("data.id") ?? body?.data?.id?.toString() : null;
    const requestId = req.headers.get("x-request-id") ?? "";
    const signature = req.headers.get("x-signature") ?? "";
    if (!dataId || !await verifySignature(signature, requestId, dataId, webhookSecret)) {
      return json(401, { error: "Assinatura inválida." });
    }
    if (body?.type !== "payment") return json(200, { received: true, ignored: true });

    const paymentResponse = await fetch("https://api.mercadopago.com/v1/payments/" + encodeURIComponent(dataId), {
      headers: { Authorization: `Bearer ${mpToken}` },
    });
    const mpPayment = await paymentResponse.json();
    if (!paymentResponse.ok) return json(502, { error: "Não foi possível consultar o pagamento." });

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const orderId = mpPayment.external_reference;
    if (typeof orderId !== "string") return json(400, { error: "Pagamento sem referência de pedido." });

    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,total,payment_status")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json(404, { error: "Pedido não encontrado." });

    const amount = Number(mpPayment.transaction_amount);
    if (mpPayment.currency_id !== "BRL" || !Number.isFinite(amount) || Math.abs(amount - Number(order.total)) > 0.01) {
      return json(409, { error: "Valor ou moeda do pagamento não corresponde ao pedido." });
    }

    const statusMap: Record<string, string> = {
      approved: "paid",
      rejected: "failed",
      cancelled: "failed",
      refunded: "refunded",
      charged_back: "refunded",
      pending: "pending",
      in_process: "pending",
      authorized: "pending",
    };
    const paymentStatus = statusMap[mpPayment.status];
    if (!paymentStatus) return json(202, { received: true, ignored_status: mpPayment.status });

    const { data: paymentRow, error: paymentError } = await admin.from("payments")
      .upsert({
        order_id: order.id,
        provider: "mercado_pago",
        provider_payment_id: String(mpPayment.id),
        status: mpPayment.status,
        amount,
        currency: "BRL",
        updated_at: new Date().toISOString(),
      }, { onConflict: "order_id" })
      .select("id")
      .single();
    if (paymentError) throw paymentError;

    const { error: eventError } = await admin.from("payment_events").upsert({
      payment_id: paymentRow.id,
      provider: "mercado_pago",
      provider_event_id: String(body.id ?? dataId),
      event_type: String(body.action ?? "payment.updated"),
      signature_valid: true,
      payload: body,
      processed_at: new Date().toISOString(),
    }, { onConflict: "provider,provider_event_id" });
    if (eventError) throw eventError;

    const { error: orderUpdateError } = await admin.from("orders")
      .update({
        payment_status: paymentStatus,
        ...(paymentStatus === "paid" ? { status: "confirmed" } : {}),
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
