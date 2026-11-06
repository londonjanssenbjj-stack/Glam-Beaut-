import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatCurrency } from "../lib/format";
import { loadAdminData, saveAdminProduct, saveAdminService, saveAdminVariant, adjustInventory, setProductActive, setServiceActive, setVariantActive, updateAdminOrderStatus, updateAdminAppointmentStatus } from "../services/adminService";
import type { AdminAppointment, AdminOrder, AdminProduct, AdminService, AdminVariant } from "../types/admin";
import type { DbCategory } from "../types/database";
import { AdminCommercialSettings } from "./AdminCommercialSettings";

type Tab = "products" | "services" | "orders" | "appointments" | "customers" | "inventory" | "variants" | "commercial";

const emptyProduct = { category_id: "", name: "", slug: "", description: "", price: "0", image_url: "", is_active: false, is_featured: false };
const emptyService = { name: "", slug: "", description: "", price: "", duration_minutes: "", is_active: false };

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [services, setServices] = useState<AdminService[]>([]);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [customers, setCustomers] = useState<import("../types/admin").AdminProfile[]>([]);
  const [inventory, setInventory] = useState<import("../types/admin").AdminInventoryItem[]>([]);
  const [variants, setVariants] = useState<AdminVariant[]>([]);
  const [variantForm, setVariantForm] = useState({ product_id: "", name: "", sku: "", price_override: "" });
  const [stockForm, setStockForm] = useState({ variant_id: "", quantity: "1", note: "" });
  const [productForm, setProductForm] = useState(emptyProduct);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await loadAdminData();
      setProducts(data.products); setServices(data.services); setCategories(data.categories);
      setOrders(data.orders); setAppointments(data.appointments); setCustomers(data.profiles); setInventory(data.inventory); setVariants(data.variants);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados administrativos.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  function editProduct(item: AdminProduct) {
    setEditingProduct(item.id);
    setProductForm({
      category_id: item.category_id ?? "", name: item.name, slug: item.slug,
      description: item.description ?? "", price: String(item.price),
      image_url: item.image_url ?? "", is_active: item.is_active, is_featured: item.is_featured,
    });
    setTab("products");
  }

  function editService(item: AdminService) {
    setEditingService(item.id);
    setServiceForm({
      name: item.name, slug: item.slug, description: item.description ?? "",
      price: item.price === null ? "" : String(item.price),
      duration_minutes: item.duration_minutes === null ? "" : String(item.duration_minutes),
      is_active: item.is_active,
    });
    setTab("services");
  }

  async function submitProduct(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await saveAdminProduct({
        category_id: productForm.category_id || null,
        name: productForm.name.trim(), slug: productForm.slug.trim(),
        description: productForm.description.trim() || null,
        price: Number(productForm.price), image_url: productForm.image_url.trim() || null,
        is_active: productForm.is_active, is_featured: productForm.is_featured,
      }, editingProduct ?? undefined);
      setProductForm(emptyProduct); setEditingProduct(null); setNotice("Produto salvo."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar produto."); }
    finally { setSaving(false); }
  }

  async function submitService(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await saveAdminService({
        name: serviceForm.name.trim(), slug: serviceForm.slug.trim(),
        description: serviceForm.description.trim() || null,
        price: serviceForm.price === "" ? null : Number(serviceForm.price),
        duration_minutes: serviceForm.duration_minutes === "" ? null : Number(serviceForm.duration_minutes),
        is_active: serviceForm.is_active,
      }, editingService ?? undefined);
      setServiceForm(emptyService); setEditingService(null); setNotice("Serviço salvo."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar serviço."); }
    finally { setSaving(false); }
  }

  async function toggleProduct(item: AdminProduct) {
    try { await setProductActive(item.id, !item.is_active); setNotice("Situação do produto atualizada."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao atualizar produto."); }
  }
  async function submitVariant(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await saveAdminVariant({ product_id: variantForm.product_id, name: variantForm.name.trim(), sku: variantForm.sku.trim() || null, price_override: variantForm.price_override === "" ? null : Number(variantForm.price_override), is_active: true });
      setVariantForm({ product_id: "", name: "", sku: "", price_override: "" }); setNotice("Variação cadastrada."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao cadastrar variação."); }
    finally { setSaving(false); }
  }
  async function submitStock(event: FormEvent) {
    event.preventDefault(); const quantity = Number(stockForm.quantity);
    if (!Number.isInteger(quantity) || quantity === 0) { setError("Informe uma quantidade inteira diferente de zero."); return; }
    setSaving(true); setError(""); setNotice("");
    try { const current = await adjustInventory(stockForm.variant_id, quantity, stockForm.note); setNotice("Estoque atualizado. Saldo atual: " + current + " unidade(s)."); setStockForm({ ...stockForm, quantity: "1", note: "" }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao movimentar estoque."); }
    finally { setSaving(false); }
  }
  async function toggleVariant(item: AdminVariant) {
    try { await setVariantActive(item.id, !item.is_active); setNotice("Variação atualizada."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao atualizar variação."); }
  }

  async function changeOrderStatus(item: AdminOrder, status: string) {
    if (status === item.status) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await updateAdminOrderStatus(item.id, status);
      setNotice("Status do pedido " + item.order_number + " atualizado.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar pedido.");
    } finally { setSaving(false); }
  }

  async function changeAppointmentStatus(item: AdminAppointment, status: string) {
    if (status === item.status) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await updateAdminAppointmentStatus(item.id, status);
      setNotice("Status do agendamento atualizado.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao atualizar agendamento.");
    } finally { setSaving(false); }
  }

  async function toggleService(item: AdminService) {
    try { await setServiceActive(item.id, !item.is_active); setNotice("Situação do serviço atualizada."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao atualizar serviço."); }
  }

  return <section className="admin-panel">
    <div className="admin-heading"><div><p className="eyebrow">GESTÃO GLAM</p><h2>Painel administrativo</h2></div><button onClick={() => void refresh()}>Atualizar dados</button></div>
    <div className="admin-tabs" role="tablist">
      {([["products","Produtos"],["services","Serviços"],["orders","Pedidos"],["appointments","Agendamentos"],["customers","Clientes"],["variants","Variações"],["inventory","Estoque"],["commercial","Cupons e entregas"]] as const).map(([key,label]) =>
        <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {loading ? <p className="status-message">Carregando painel…</p> : <>
      {tab === "commercial" && <AdminCommercialSettings />}
      {tab === "products" && <div className="admin-columns">
        <form className="admin-form" onSubmit={submitProduct}>
          <h3>{editingProduct ? "Editar produto" : "Novo produto"}</h3>
          <label>Nome<input required value={productForm.name} onChange={e => setProductForm({...productForm,name:e.target.value})}/></label>
          <label>Identificador (slug)<input required pattern="[a-z0-9-]+" value={productForm.slug} onChange={e => setProductForm({...productForm,slug:e.target.value})}/></label>
          <label>Categoria<select value={productForm.category_id} onChange={e => setProductForm({...productForm,category_id:e.target.value})}><option value="">Sem categoria</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Descrição<textarea rows={3} value={productForm.description} onChange={e => setProductForm({...productForm,description:e.target.value})}/></label>
          <label>Preço (R$)<input required type="number" min="0" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm,price:e.target.value})}/></label>
          <label>URL da imagem<input type="url" value={productForm.image_url} onChange={e => setProductForm({...productForm,image_url:e.target.value})}/></label>
          <label className="check-label"><input type="checkbox" checked={productForm.is_featured} onChange={e => setProductForm({...productForm,is_featured:e.target.checked})}/> Destaque</label>
          <label className="check-label"><input type="checkbox" checked={productForm.is_active} onChange={e => setProductForm({...productForm,is_active:e.target.checked})}/> Ativo na loja</label>
          <div className="admin-actions"><button className="submit-button" disabled={saving}>{saving ? "Salvando…" : "Salvar produto"}</button><button type="button" onClick={()=>{setProductForm(emptyProduct);setEditingProduct(null);}}>Limpar</button></div>
        </form>
        <div className="admin-list"><h3>Produtos cadastrados ({products.length})</h3>
          {products.map(item=><article className="admin-row" key={item.id}><div><strong>{item.name}</strong><small>{formatCurrency(Number(item.price))} · {item.is_active ? "Ativo" : "Inativo"}</small></div><div><button onClick={()=>editProduct(item)}>Editar</button><button onClick={()=>void toggleProduct(item)}>{item.is_active ? "Desativar" : "Ativar"}</button></div></article>)}
        </div>
      </div>}
      {tab === "services" && <div className="admin-columns">
        <form className="admin-form" onSubmit={submitService}>
          <h3>{editingService ? "Editar serviço" : "Novo serviço"}</h3>
          <label>Nome<input required value={serviceForm.name} onChange={e=>setServiceForm({...serviceForm,name:e.target.value})}/></label>
          <label>Identificador (slug)<input required pattern="[a-z0-9-]+" value={serviceForm.slug} onChange={e=>setServiceForm({...serviceForm,slug:e.target.value})}/></label>
          <label>Descrição<textarea rows={3} value={serviceForm.description} onChange={e=>setServiceForm({...serviceForm,description:e.target.value})}/></label>
          <label>Preço (R$)<input type="number" min="0" step="0.01" value={serviceForm.price} onChange={e=>setServiceForm({...serviceForm,price:e.target.value})}/></label>
          <label>Duração (minutos)<input type="number" min="1" step="1" value={serviceForm.duration_minutes} onChange={e=>setServiceForm({...serviceForm,duration_minutes:e.target.value})}/></label>
          <label className="check-label"><input type="checkbox" checked={serviceForm.is_active} onChange={e=>setServiceForm({...serviceForm,is_active:e.target.checked})}/> Ativo na loja</label>
          <div className="admin-actions"><button className="submit-button" disabled={saving}>Salvar serviço</button><button type="button" onClick={()=>{setServiceForm(emptyService);setEditingService(null);}}>Limpar</button></div>
        </form>
        <div className="admin-list"><h3>Serviços cadastrados ({services.length})</h3>
          {services.map(item=><article className="admin-row" key={item.id}><div><strong>{item.name}</strong><small>{item.price === null ? "Consultar valor" : formatCurrency(Number(item.price))} · {item.is_active ? "Ativo" : "Inativo"}</small></div><div><button onClick={()=>editService(item)}>Editar</button><button onClick={()=>void toggleService(item)}>{item.is_active ? "Desativar" : "Ativar"}</button></div></article>)}
        </div>
      </div>}
      {tab === "orders" && <div className="admin-list"><h3>Pedidos recentes ({orders.length})</h3>{orders.length ? orders.map(item=><article className="admin-row" key={item.id}><div><strong>{item.order_number}</strong><small>{new Date(item.created_at).toLocaleString("pt-BR")} · pagamento {item.payment_status}</small></div><div className="admin-row-actions"><strong>{formatCurrency(Number(item.total))}</strong><select aria-label={"Status do pedido " + item.order_number} value={item.status} disabled={saving} onChange={e=>void changeOrderStatus(item,e.target.value)}><option value="pending">Pendente</option><option value="confirmed">Confirmado</option><option value="processing">Em preparação</option><option value="shipped">Enviado</option><option value="ready_for_pickup">Pronto para retirada</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="refunded">Reembolsado</option></select></div></article>) : <p>Nenhum pedido registrado.</p>}</div>}
      {tab === "appointments" && <div className="admin-list"><h3>Agendamentos ({appointments.length})</h3>{appointments.length ? appointments.map(item=><article className="admin-row" key={item.id}><div><strong>{item.service_name}</strong><small>{new Date(item.starts_at).toLocaleString("pt-BR")}</small></div><select aria-label={"Status do agendamento " + item.service_name} value={item.status} disabled={saving} onChange={e=>void changeAppointmentStatus(item,e.target.value)}><option value="requested">Solicitado</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="no_show">Não compareceu</option></select></article>) : <p>Nenhum agendamento registrado.</p>}</div>}
      {tab === "customers" && <div className="admin-list"><h3>Clientes cadastrados ({customers.length})</h3>{customers.length ? customers.map(item=><article className="admin-row" key={item.id}><div><strong>{item.full_name || "Nome não informado"}</strong><small>{item.email ?? "Sem e-mail"} · {item.phone ?? "Sem telefone"}</small></div><small>{item.id.slice(0,8)}…</small></article>) : <p>Nenhum cliente cadastrado.</p>}</div>}
      {tab === "variants" && <div className="admin-columns"><form className="admin-form" onSubmit={submitVariant}><h3>Nova variação</h3><label>Produto<select required value={variantForm.product_id} onChange={e=>setVariantForm({...variantForm,product_id:e.target.value})}><option value="">Selecione</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Nome da variação<input required placeholder="Ex.: 100 ml, P, cor preta" value={variantForm.name} onChange={e=>setVariantForm({...variantForm,name:e.target.value})}/></label><label>SKU<input value={variantForm.sku} onChange={e=>setVariantForm({...variantForm,sku:e.target.value})}/></label><label>Preço específico (opcional)<input type="number" min="0" step="0.01" value={variantForm.price_override} onChange={e=>setVariantForm({...variantForm,price_override:e.target.value})}/></label><button className="submit-button" disabled={saving || products.length===0}>{saving ? "Salvando…" : "Cadastrar variação"}</button></form><div className="admin-list"><h3>Variações cadastradas ({variants.length})</h3>{variants.map(item=><article className="admin-row" key={item.id}><div><strong>{products.find(p=>p.id===item.product_id)?.name ?? "Produto"} — {item.name}</strong><small>{item.sku ?? "Sem SKU"} · {item.price_override===null ? "Preço do produto" : formatCurrency(Number(item.price_override))} · {item.is_active ? "Ativa" : "Inativa"}</small></div><button onClick={()=>void toggleVariant(item)}>{item.is_active ? "Desativar" : "Ativar"}</button></article>)}</div></div>}
      {tab === "inventory" && <div className="admin-columns"><form className="admin-form" onSubmit={submitStock}><h3>Movimentar estoque</h3><label>Variação<select required value={stockForm.variant_id} onChange={e=>setStockForm({...stockForm,variant_id:e.target.value})}><option value="">Selecione</option>{variants.map(v=><option key={v.id} value={v.id}>{products.find(p=>p.id===v.product_id)?.name ?? "Produto"} — {v.name}</option>)}</select></label><label>Quantidade (+ entrada / − saída)<input required type="number" step="1" value={stockForm.quantity} onChange={e=>setStockForm({...stockForm,quantity:e.target.value})}/></label><label>Observação<input value={stockForm.note} onChange={e=>setStockForm({...stockForm,note:e.target.value})}/></label><button className="submit-button" disabled={saving || variants.length===0}>{saving ? "Registrando…" : "Registrar movimentação"}</button></form><div className="admin-list"><h3>Posição de estoque ({inventory.length} variações)</h3>{inventory.length ? inventory.map(item=><article className="admin-row" key={item.variant_id}><div><strong>{item.product_variants?.products?.name ?? "Produto"} — {item.product_variants?.name ?? "Variação"}</strong><small>SKU: {item.product_variants?.sku ?? "Não informado"}</small></div><strong>{item.quantity} un.</strong></article>) : <p>Nenhum estoque cadastrado.</p>}</div></div>}
    </>}
  </section>;
}
