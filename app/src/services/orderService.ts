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
) {
  const { data, error } = await supabase.rpc("create_customer_order", {
    p_items: items,
    p_delivery_method: deliveryMethod,
    p_shipping_address: shippingAddress,
  });
  if (error) throw error;
  return data as {
    order_id: string;
    order_number: string;
    subtotal: number;
    delivery_fee: number;
    total: number;
    status: string;
  };
}
