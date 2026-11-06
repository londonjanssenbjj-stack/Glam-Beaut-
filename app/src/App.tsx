import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./contexts/AuthContext";
import { AdminDashboard } from "./components/AdminDashboard";
import { supabaseConfigured } from "./lib/supabase";
import { getPublicCatalog, testSupabaseConnection } from "./services/catalogService";
import { formatCurrency } from "./lib/format";
import type { DbProduct, DbService, DbVariant } from "./types/database";
import { createCustomerOrder } from "./services/orderService";
import { createCustomerAppointment } from "./services/appointmentService";
type CartLine = { product: DbProduct; variant: DbVariant; quantity: number };

export default function App() {
  const auth = useAuth();
  const [view, setView] = useState("loja");
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [variants, setVariants] = useState<DbVariant[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [services, setServices] = useState<DbService[]>([]);
  const [connection, setConnection] = useState("Verificando conexão…");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [appointmentNote, setAppointmentNote] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("pickup");
  const [address, setAddress] = useState({ recipient_name: "", phone: "", postal_code: "", street: "", number: "", complement: "", neighborhood: "", reference: "" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("glam-cart-v1");
      if (saved) { const parsed = JSON.parse(saved) as CartLine[]; setCart(Array.isArray(parsed) ? parsed.filter(line => line?.product?.id && line?.variant?.id && Number.isInteger(line.quantity) && line.quantity > 0) : []); }
    } catch { localStorage.removeItem("glam-cart-v1"); }
  }, []);

  useEffect(() => { localStorage.setItem("glam-cart-v1", JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured) { setConnection("Configure as variáveis de ambiente."); return; }
    testSupabaseConnection().then(r => { if (alive) setConnection(r.message); });
    getPublicCatalog().then(data => {
      if (alive) { setProducts(data.products); setServices(data.services); setVariants(data.variants); }
    }).catch(e => { if (alive) setMessage(e instanceof Error ? e.message : "Falha ao carregar catálogo."); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (auth.user) setView("conta");
    else if (view === "conta" || view === "admin") setView("loja");
  }, [auth.user]);

  function addToCart(product: DbProduct, variant: DbVariant) {
    if (!variant.is_active || !product.is_active) {
      setMessage("Este item não está disponível para compra.");
      return;
    }
    setCart(current => {
      const existing = current.find(line => line.variant.id === variant.id);
      return existing
        ? current.map(line => line.variant.id === variant.id
          ? { ...line, quantity: Math.min(100, line.quantity + 1) }
          : line)
        : [...current, { product, variant, quantity: 1 }];
    });
    setMessage("");
    setCartOpen(true);
  }
  function changeQuantity(variantId: string, quantity: number) {
    setCart(current => quantity < 1
      ? current.filter(line => line.variant.id !== variantId)
      : current.map(line => line.variant.id === variantId
        ? { ...line, quantity: Math.min(100, quantity) }
        : line));
  }
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.reduce((sum, line) => sum + Number(line.variant.price_override ?? line.product.price) * line.quantity, 0);

  async function submitAppointment(event: FormEvent) {
    event.preventDefault();
    if (!auth.user) { setMessage("Entre ou crie sua conta para solicitar um horário."); setView("login"); return; }
    if (!appointmentDate || !appointmentTime) { setMessage("Escolha a data e o horário."); return; }
    setBusy(true); setMessage("");
    try {
      const startsAt = new Date(appointmentDate + "T" + appointmentTime).toISOString();
      const result = await createCustomerAppointment(selectedServiceId, startsAt, appointmentNote);
      setMessage("Solicitação registrada para " + result.service_name + ". Aguarde a confirmação.");
      setView("loja"); setAppointmentDate(""); setAppointmentTime(""); setAppointmentNote("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível solicitar o horário."); }
    finally { setBusy(false); }
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();
    if (!auth.user) { setMessage("Entre ou crie sua conta para concluir o pedido."); setCheckoutOpen(false); setCartOpen(false); setView("login"); return; }
    setBusy(true); setMessage("");
    try {
      const result = await createCustomerOrder(
        cart.map(line => ({ variant_id: line.variant.id, quantity: line.quantity })),
        deliveryMethod,
        deliveryMethod === "delivery" ? address : null,
      );
      setCart([]); setCheckoutOpen(false); setCartOpen(false);
      setMessage("Pedido " + result.order_number + " registrado como pendente. Total validado no servidor: " + formatCurrency(Number(result.total)) + ".");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível registrar o pedido.");
    } finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      if (view === "login") await auth.signIn(email, password);
      if (view === "cadastro") await auth.signUp({ email, password, fullName: name, phone });
      if (view === "recuperar") await auth.resetPassword(email);
      setMessage(view === "cadastro" ? "Cadastro enviado. Verifique seu e-mail se a confirmação estiver ativa." : "Solicitação concluída.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally { setBusy(false); }
  }

  return <main className="glam-app">
    <header className="setup-header">
      <a className="brand" href="#inicio" onClick={() => setView("loja")}>glam<span>.</span></a>
      <nav className="main-nav">
        <button onClick={() => setView("loja")}>Loja</button>
        <button onClick={() => setCartOpen(true)}>Sacola ({cartCount})</button>
        <a href="#servicos">Serviços</a>
        {auth.user ? <>
          <button onClick={() => setView("conta")}>Minha conta</button>
          {auth.roles.includes("admin") && <button onClick={() => setView("admin")}>Admin</button>}
          <button onClick={() => auth.signOut().catch(e => setMessage(e.message))}>Sair</button>
        </> : <button onClick={() => setView("login")}>Entrar</button>}
      </nav>
    </header>
    <section className="welcome-hero" id="inicio">
      <p className="eyebrow">BELEZA • ESTÉTICA • BEM-ESTAR</p>
      <h1>Sua beleza, sua experiência Glam.</h1>
      <p className="intro">Produtos e serviços selecionados para seus momentos de autocuidado.</p>
      <p className="connection-state">{connection}</p>
    </section>
    {message && <p className="notice" role="status">{message}</p>}
    {view === "loja" && <>
      <section className="catalog-section"><p className="eyebrow">CURADORIA GLAM</p><h2>Produtos</h2>
        <div className="product-grid">{products.length ? products.map(p => <article className="product-card" key={p.id}>
          <div className="product-image">{p.image_url ? <img src={p.image_url} alt={p.name}/> : <span>GLAM BEAUT</span>}</div>
          <h3>{p.name}</h3><p>{p.description}</p><strong>{formatCurrency(Number(p.price))}</strong><div className="variant-options">{variants.filter(v => v.product_id === p.id).map(v => <button className="add-cart-button" key={v.id} onClick={() => addToCart(p, v)}>Adicionar {v.name} · {formatCurrency(Number(v.price_override ?? p.price))}</button>)}</div>{!variants.some(v => v.product_id === p.id) && <p className="cart-note">Opções de compra indisponíveis no momento.</p>}
        </article>) : <p>Nenhum produto ativo no momento.</p>}</div>
      </section>
      <section className="catalog-section" id="servicos"><p className="eyebrow">CUIDADO E BEM-ESTAR</p><h2>Serviços</h2>
        <div className="service-grid">{services.length ? services.map(s => <article className="service-card" key={s.id}>
          <h3>{s.name}</h3><p>{s.description}</p><strong>{s.price === null ? "Consulte o valor" : formatCurrency(Number(s.price))}</strong><button className="add-cart-button" disabled={!s.duration_minutes} onClick={() => { setSelectedServiceId(s.id); setView("agendamento"); }}>{s.duration_minutes ? "Solicitar horário" : "Agendamento indisponível"}</button>
        </article>) : <p>Serviços serão exibidos quando estiverem ativos.</p>}</div>
      </section>
    </>}
    {view === "agendamento" && <section className="auth-panel"><p className="eyebrow">AGENDAMENTO</p><h2>Solicitar horário</h2><form className="checkout-form" onSubmit={submitAppointment}><label>Serviço<select required value={selectedServiceId} onChange={e=>setSelectedServiceId(e.target.value)}>{services.filter(s=>s.duration_minutes).map(s=><option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} min</option>)}</select></label><label>Data<input type="date" required min={new Date().toLocaleDateString("en-CA")} value={appointmentDate} onChange={e=>setAppointmentDate(e.target.value)}/></label><label>Horário<input type="time" required value={appointmentTime} onChange={e=>setAppointmentTime(e.target.value)}/></label><label>Observações (opcional)<textarea rows={3} value={appointmentNote} onChange={e=>setAppointmentNote(e.target.value)}/></label><p className="cart-note">O horário será solicitado e ficará pendente até a confirmação da equipe. Conflitos são verificados no servidor.</p><button className="submit-button" disabled={busy || !selectedServiceId}>{busy ? "Enviando…" : "Solicitar agendamento"}</button><button type="button" onClick={()=>setView("loja")}>Voltar à loja</button></form></section>}
    {cartOpen && <div className="cart-backdrop" role="presentation" onClick={() => setCartOpen(false)}><aside className="cart-drawer" role="dialog" aria-modal="true" aria-label="Sacola de compras" onClick={e => e.stopPropagation()}><div className="cart-title"><h2>Sua sacola ({cartCount})</h2><button onClick={() => setCartOpen(false)} aria-label="Fechar sacola">×</button></div>{cart.length ? <>{cart.map(line => <article className="cart-line" key={line.variant.id}><div><strong>{line.product.name} — {line.variant.name}</strong><small>{formatCurrency(Number(line.variant.price_override ?? line.product.price))} cada</small></div><div className="quantity-control"><button onClick={() => changeQuantity(line.variant.id, line.quantity - 1)}>−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.variant.id, line.quantity + 1)}>+</button></div><strong>{formatCurrency(Number(line.variant.price_override ?? line.product.price) * line.quantity)}</strong></article>)}<div className="cart-total"><span>Subtotal</span><strong>{formatCurrency(cartTotal)}</strong></div>{!checkoutOpen ? <button className="submit-button" onClick={() => setCheckoutOpen(true)}>Continuar para entrega e pagamento</button> : <form className="checkout-form" onSubmit={submitOrder}><h3>Finalizar pedido</h3><label>Receber como<select value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value as "delivery" | "pickup")}><option value="pickup">Retirar na loja</option><option value="delivery">Receber por entrega</option></select></label>{deliveryMethod === "delivery" && <><label>Nome de quem recebe<input required value={address.recipient_name} onChange={e=>setAddress({...address,recipient_name:e.target.value})}/></label><label>Telefone<input required value={address.phone} onChange={e=>setAddress({...address,phone:e.target.value})}/></label><label>CEP<input required value={address.postal_code} onChange={e=>setAddress({...address,postal_code:e.target.value})}/></label><label>Rua<input required value={address.street} onChange={e=>setAddress({...address,street:e.target.value})}/></label><label>Número<input required value={address.number} onChange={e=>setAddress({...address,number:e.target.value})}/></label><label>Complemento<input value={address.complement} onChange={e=>setAddress({...address,complement:e.target.value})}/></label><label>Bairro<input required value={address.neighborhood} onChange={e=>setAddress({...address,neighborhood:e.target.value})}/></label><label>Referência<input value={address.reference} onChange={e=>setAddress({...address,reference:e.target.value})}/></label></>}<p className="cart-note">O servidor recalcula preços, frete e estoque. O pedido ficará pendente até a confirmação do pagamento.</p><button className="submit-button" disabled={busy}>{busy ? "Registrando…" : "Registrar pedido"}</button></form>}</> : <p>Sua sacola está vazia.</p>}</aside></div>}
    {["login","cadastro","recuperar"].includes(view) && <section className="auth-panel">
      <p className="eyebrow">ÁREA DO CLIENTE</p><h2>{view === "login" ? "Entrar" : view === "cadastro" ? "Criar cadastro" : "Recuperar senha"}</h2>
      <form onSubmit={submit}>
        {view === "cadastro" && <><label>Nome completo<input required value={name} onChange={e => setName(e.target.value)}/></label><label>Telefone<input value={phone} onChange={e => setPhone(e.target.value)}/></label></>}
        <label>E-mail<input type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
        {view !== "recuperar" && <label>Senha<input type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/></label>}
        <button className="submit-button" disabled={busy || !supabaseConfigured}>{busy ? "Aguarde…" : "Continuar"}</button>
      </form>
      <div className="auth-links"><button onClick={() => setView("login")}>Entrar</button><button onClick={() => setView("cadastro")}>Criar conta</button><button onClick={() => setView("recuperar")}>Esqueci a senha</button></div>
    </section>}
    {view === "conta" && auth.user && <section className="auth-panel"><h2>Olá, {auth.profile?.full_name || auth.user.email}</h2><p>Perfil: {auth.roles.includes("admin") ? "Administrador" : "Cliente"}</p><button onClick={() => auth.signOut()}>Sair da conta</button></section>}
    {view === "admin" && (auth.roles.includes("admin") ? <AdminDashboard /> : <section className="catalog-section"><h2>Acesso restrito</h2><p>Esta área é exclusiva para administradores.</p></section>)}
    <footer className="setup-footer">Glam Beleza Estética e Bem-estar · Corumbá — Mato Grosso do Sul</footer>
  </main>;
}
