import { supabase } from "../lib/supabase";

export interface OrderItemInput {
  variant_id: string;
  quantity: number;
}

export interface ShippingAddressInput {
  recipient_name: string;
  phone: string;
  postal_code: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  reference?: string;
}

export async function createCustomerOrder(
  items: OrderItemInput[],
  deliveryMethod: "delivery" | "pickup",
  shippingAddress: ShippingAddressInput | null,
  couponCode: string | null,
) {
  const { data, error } = await supabase.rpc("create_customer_order", {
    p_items: items,
    p_delivery_method: deliveryMethod,
    p_shipping_address: shippingAddress,
    p_coupon_code: couponCode,
  });
  if (error) throw error;
  return data as {
    order_id: string;
    order_number: string;
    subtotal: number;
    delivery_fee: number;
    discount_amount: number;
    total: number;
    status: string;
  };
}

export async function startMercadoPagoCheckout(orderId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-payment", {
    body: { order_id: orderId },
  });
  if (error) throw error;
  const checkoutUrl = data?.checkout_url;
  if (typeof checkoutUrl !== "string") throw new Error("O provedor não retornou o endereço de pagamento.");
  const parsed = new URL(checkoutUrl);
  if (parsed.protocol !== "https:" || !/(^|\\.)mercadopago\\.com(\\.br)?$/.test(parsed.hostname)) {
    throw new Error("Endereço de pagamento inválido.");
  }
  return checkoutUrl;
}
