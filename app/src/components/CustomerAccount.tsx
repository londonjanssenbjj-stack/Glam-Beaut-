import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/format";

interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
}

interface CustomerAppointment {
  id: string;
  service_name: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
}

export function CustomerAccount({ userId, fullName }: { userId: string; fullName: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");\n  const [birthDate, setBirthDate] = useState("");\n  const [birthdaySaving, setBirthdaySaving] = useState(false);\n  const [birthdayNotice, setBirthdayNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [orderResult, appointmentResult, birthdayResult] = await Promise.all([
          supabase.from("orders")
            .select("id,order_number,status,payment_status,total,created_at")
            .eq("customer_id", userId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase.from("appointments")
            .select("id,service_name,starts_at,ends_at,status")
            .eq("customer_id", userId)
            .order("starts_at", { ascending: false })
            .limit(50),
          supabase.from("customer_birthdays").select("birth_date").eq("customer_id", userId).maybeSingle(),
        ]);
        if (orderResult.error) throw orderResult.error;
        if (appointmentResult.error) throw appointmentResult.error;\n        if (birthdayResult.error) throw birthdayResult.error;
        if (active) {
          setOrders((orderResult.data ?? []) as CustomerOrder[]);
          setAppointments((appointmentResult.data ?? []) as CustomerAppointment[]);\n          setBirthDate(birthdayResult.data?.birth_date ?? "");
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar seu histórico.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  async function saveBirthday(event: FormEvent) {\n    event.preventDefault(); setBirthdaySaving(true); setError(""); setBirthdayNotice("");\n    try {\n      const { error } = await supabase.from("customer_birthdays").upsert({ customer_id: userId, birth_date: birthDate, updated_at: new Date().toISOString() }, { onConflict: "customer_id" });\n      if (error) throw error;\n      setBirthdayNotice("Data de nascimento salva.");\n    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a data."); }\n    finally { setBirthdaySaving(false); }\n  }\n\n  return <section className="customer-account">
    <div className="account-heading">
      <p className="eyebrow">ÁREA DO CLIENTE</p>
      <h2>Olá, {fullName || "Cliente"}</h2>
      <p>Acompanhe seus pedidos e solicitações de horário.</p>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <form className="admin-form birthday-form" onSubmit={saveBirthday}>\n      <h3>Meu aniversário</h3>\n      <p>Cadastre sua data para receber informações sobre benefícios de aniversário da loja.</p>\n      <label>Data de nascimento<input type="date" required max={new Date().toLocaleDateString("en-CA")} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>\n      <button className="submit-button" disabled={birthdaySaving || !birthDate}>{birthdaySaving ? "Salvando…" : "Salvar aniversário"}</button>\n      {birthdayNotice && <p className="notice" role="status">{birthdayNotice}</p>}\n    </form>\n    {loading ? <p className="status-message">Carregando seu histórico…</p> : <>
      <div className="account-history">
        <div className="admin-list">
          <h3>Meus pedidos ({orders.length})</h3>
          {orders.length ? orders.map(order => <article className="admin-row" key={order.id}>
            <div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString("pt-BR")} · {order.status} · pagamento {order.payment_status}</small></div>
            <strong>{formatCurrency(Number(order.total))}</strong>
          </article>) : <p>Você ainda não possui pedidos.</p>}
        </div>
        <div className="admin-list">
          <h3>Meus agendamentos ({appointments.length})</h3>
          {appointments.length ? appointments.map(item => <article className="admin-row" key={item.id}>
            <div><strong>{item.service_name}</strong><small>{new Date(item.starts_at).toLocaleString("pt-BR")} · {item.status}</small></div>
          </article>) : <p>Você ainda não possui agendamentos.</p>}
        </div>
      </div>
    </>}
  </section>;
}
