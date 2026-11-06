import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./contexts/AuthContext";
import { AdminDashboard } from "./components/AdminDashboard";
import { supabaseConfigured } from "./lib/supabase";
import { getPublicCatalog, testSupabaseConnection } from "./services/catalogService";
import { formatCurrency } from "./lib/format";
import type { DbProduct, DbService } from "./types/database";

export default function App() {
  const auth = useAuth();
  const [view, setView] = useState("loja");
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [services, setServices] = useState<DbService[]>([]);
  const [connection, setConnection] = useState("Verificando conexão…");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!supabaseConfigured) { setConnection("Configure as variáveis de ambiente."); return; }
    testSupabaseConnection().then(r => { if (alive) setConnection(r.message); });
    getPublicCatalog().then(data => {
      if (alive) { setProducts(data.products); setServices(data.services); }
    }).catch(e => { if (alive) setMessage(e instanceof Error ? e.message : "Falha ao carregar catálogo."); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (auth.user) setView("conta");
    else if (view === "conta" || view === "admin") setView("loja");
  }, [auth.user]);

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
          <h3>{p.name}</h3><p>{p.description}</p><strong>{formatCurrency(Number(p.price))}</strong>
        </article>) : <p>Nenhum produto ativo no momento.</p>}</div>
      </section>
      <section className="catalog-section" id="servicos"><p className="eyebrow">CUIDADO E BEM-ESTAR</p><h2>Serviços</h2>
        <div className="service-grid">{services.length ? services.map(s => <article className="service-card" key={s.id}>
          <h3>{s.name}</h3><p>{s.description}</p><strong>{s.price === null ? "Consulte o valor" : formatCurrency(Number(s.price))}</strong>
        </article>) : <p>Serviços serão exibidos quando estiverem ativos.</p>}</div>
      </section>
    </>}
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
