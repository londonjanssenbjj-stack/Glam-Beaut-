import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/format";
import { startMercadoPagoCheckout } from "../services/orderService";
import { sendStoreWhatsApp } from "../services/whatsappService";

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
  const [error, setError] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayNotice, setBirthdayNotice] = useState("");
  const [payingOrder, setPayingOrder] = useState<string | null>(null);

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
        if (appointmentResult.error) throw appointmentResult.error;
        if (birthdayResult.error) throw birthdayResult.error;
        if (active) {
          setOrders((orderResult.data ?? []) as CustomerOrder[]);
          setAppointments((appointmentResult.data ?? []) as CustomerAppointment[]);
          setBirthDate(birthdayResult.data?.birth_date ?? "");
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

  async function contactWhatsApp(message: string) {
    setError("");
    try { await sendStoreWhatsApp(message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível abrir o WhatsApp."); }
  }

  async function payOrder(orderId: string) {
    setPayingOrder(orderId); setError("");
    try {
      const url = await startMercadoPagoCheckout(orderId);
      window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o pagamento.");
      setPayingOrder(null);
    }
  }

  async function saveBirthday(event: FormEvent) {
    event.preventDefault(); setBirthdaySaving(true); setError(""); setBirthdayNotice("");
    try {
      const { error } = await supabase.from("customer_birthdays").upsert({ customer_id: userId, birth_date: birthDate, updated_at: new Date().toISOString() }, { onConflict: "customer_id" });
      if (error) throw error;
      setBirthdayNotice("Data de nascimento salva.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a data."); }
    finally { setBirthdaySaving(false); }
  }

  return <section className="customer-account">
    <div className="account-heading">
      <p className="eyebrow">ÁREA DO CLIENTE</p>
      <h2>Olá, {fullName || "Cliente"}</h2>
      <p>Acompanhe seus pedidos e solicitações de horário.</p>
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    <form className="admin-form birthday-form" onSubmit={saveBirthday}>
      <h3>Meu aniversário</h3>
      <p>Cadastre sua data para receber informações sobre benefícios de aniversário da loja.</p>
      <label>Data de nascimento<input type="date" required max={new Date().toLocaleDateString("en-CA")} value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
      <button className="submit-button" disabled={birthdaySaving || !birthDate}>{birthdaySaving ? "Salvando…" : "Salvar aniversário"}</button>
      {birthdayNotice && <p className="notice" role="status">{birthdayNotice}</p>}
    </form>
    {loading ? <p className="status-message">Carregando seu histórico…</p> : <>
      <div className="account-history">
        <div className="admin-list">
          <h3>Meus pedidos ({orders.length})</h3>
          {orders.length ? orders.map(order => <article className="admin-row" key={order.id}>
            <div><strong>{order.order_number}</strong><small>{new Date(order.created_at).toLocaleString("pt-BR")} · {order.status} · pagamento {order.payment_status}</small></div>
            <div className="account-order-actions"><strong>{formatCurrency(Number(order.total))}</strong><button type="button" className="add-cart-button" onClick={() => void contactWhatsApp("Olá! Sou " + fullName + ". Gostaria de informações sobre o pedido " + order.order_number + ", no valor de " + formatCurrency(Number(order.total)) + ".")}>WhatsApp</button>{order.payment_status === "pending" && <button className="add-cart-button" disabled={payingOrder !== null} onClick={() => void payOrder(order.id)}>{payingOrder === order.id ? "Abrindo pagamento…" : "Pagar agora"}</button>}</div>
          </article>) : <p>Você ainda não possui pedidos.</p>}
        </div>
        <div className="admin-list">
          <h3>Meus agendamentos ({appointments.length})</h3>
          {appointments.length ? appointments.map(item => <article className="admin-row" key={item.id}>
            <div><strong>{item.service_name}</strong><small>{new Date(item.starts_at).toLocaleString("pt-BR")} · {item.status}</small></div><button type="button" className="add-cart-button" onClick={() => void contactWhatsApp("Olá! Sou " + fullName + ". Gostaria de informações sobre meu agendamento de " + item.service_name + " em " + new Date(item.starts_at).toLocaleString("pt-BR") + ".")}>WhatsApp</button>
          </article>) : <p>Você ainda não possui agendamentos.</p>}
        </div>
      </div>
    </>}
  </section>;
}
