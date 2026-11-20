import { supabase } from "../lib/supabase";

export async function createCustomerAppointment(
  serviceId: string,
  startsAt: string,
  customerNote: string,
) {
  const { data, error } = await supabase.rpc("create_customer_appointment", {
    p_service_id: serviceId,
    p_starts_at: startsAt,
    p_customer_note: customerNote.trim() || null,
  });
  if (error) throw error;
  return data as {
    appointment_id: string;
    service_name: string;
    starts_at: string;
    ends_at: string;
    status: string;
  };
}
