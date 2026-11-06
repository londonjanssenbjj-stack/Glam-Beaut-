import { supabase } from "../lib/supabase";

export async function sendStoreWhatsApp(message: string): Promise<void> {
  const { data, error } = await supabase.rpc("get_store_whatsapp_phone");
  if (error) throw error;
  const phone = typeof data === "string" ? data.replace(/\\D/g, "") : "";
  if (!phone) throw new Error("O WhatsApp da loja ainda não foi configurado pelo administrador.");
  if (phone.length < 10 || phone.length > 15) throw new Error("O número de WhatsApp da loja está inválido.");
  const url = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
  window.location.assign(url);
}
