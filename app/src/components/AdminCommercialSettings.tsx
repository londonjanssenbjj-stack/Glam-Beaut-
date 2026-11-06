import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/format";

type Coupon = { id:string; code:string; discount_type:"percentage"|"fixed"; discount_value:number; minimum_order:number; starts_at:string|null; expires_at:string|null; usage_limit:number|null; usage_count:number; is_active:boolean };
type Region = { id:string; name:string; neighborhoods:string[]; fee:number; free_from:number|null; is_active:boolean };
const emptyCoupon = { code:"", discount_type:"percentage" as "percentage"|"fixed", discount_value:"10", minimum_order:"0", starts_at:"", expires_at:"", usage_limit:"", is_active:false };
const emptyRegion = { name:"", neighborhoods:"", fee:"0", free_from:"", is_active:false };

export function AdminCommercialSettings() {
  const [coupons,setCoupons]=useState<Coupon[]>([]);
  const [regions,setRegions]=useState<Region[]>([]);
  const [coupon,setCoupon]=useState(emptyCoupon);
  const [region,setRegion]=useState(emptyRegion);
  const [couponId,setCouponId]=useState<string|null>(null);
  const [regionId,setRegionId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  async function refresh() {
    const [c,r]=await Promise.all([
      supabase.from("coupons").select("id,code,discount_type,discount_value,minimum_order,starts_at,expires_at,usage_limit,usage_count,is_active").order("created_at",{ascending:false}),
      supabase.from("delivery_regions").select("id,name,neighborhoods,fee,free_from,is_active").order("name")
    ]);
    if(c.error) throw c.error;
    if(r.error) throw r.error;
    setCoupons((c.data??[]) as Coupon[]);
    setRegions((r.data??[]) as Region[]);
  }
  useEffect(()=>{ void refresh().catch(e=>setError(e instanceof Error?e.message:"Falha ao carregar cupons e regiões.")); },[]);

  async function saveCoupon(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const value=Number(coupon.discount_value), minimum=Number(coupon.minimum_order);
      if(!Number.isFinite(value)||value<=0||!Number.isFinite(minimum)||minimum<0) throw new Error("Informe valores válidos para o desconto e pedido mínimo.");
      if(coupon.discount_type==="percentage"&&value>100) throw new Error("O desconto percentual não pode exceder 100%.");
      const {error}=await supabase.rpc("admin_save_coupon",{p_id:couponId,p_code:coupon.code,p_discount_type:coupon.discount_type,p_discount_value:value,p_minimum_order:minimum,p_starts_at:coupon.starts_at?new Date(coupon.starts_at).toISOString():null,p_expires_at:coupon.expires_at?new Date(coupon.expires_at).toISOString():null,p_usage_limit:coupon.usage_limit?Number(coupon.usage_limit):null,p_is_active:coupon.is_active});
      if(error) throw error;
      setCoupon(emptyCoupon);setCouponId(null);setNotice("Cupom salvo.");await refresh();
    } catch(e) { setError(e instanceof Error?e.message:"Não foi possível salvar o cupom."); }
    finally { setBusy(false); }
  }
  async function saveRegion(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");setNotice("");
    try {
      const neighborhoods=region.neighborhoods.split(",").map(v=>v.trim()).filter(Boolean);
      if(!neighborhoods.length) throw new Error("Informe ao menos um bairro atendido.");
      const fee=Number(region.fee),free=region.free_from===""?null:Number(region.free_from);
      if(!Number.isFinite(fee)||fee<0||(free!==null&&(!Number.isFinite(free)||free<0))) throw new Error("Taxas e valores mínimos devem ser válidos.");
      const {error}=await supabase.rpc("admin_save_delivery_region",{p_id:regionId,p_name:region.name,p_neighborhoods:neighborhoods,p_fee:fee,p_free_from:free,p_is_active:region.is_active});
      if(error) throw error;
      setRegion(emptyRegion);setRegionId(null);setNotice("Região de entrega salva.");await refresh();
    } catch(e) { setError(e instanceof Error?e.message:"Não foi possível salvar a região."); }
    finally { setBusy(false); }
  }
  function editCoupon(item:Coupon) {
    setCouponId(item.id);setCoupon({code:item.code,discount_type:item.discount_type,discount_value:String(item.discount_value),minimum_order:String(item.minimum_order),starts_at:item.starts_at?item.starts_at.slice(0,16):"",expires_at:item.expires_at?item.expires_at.slice(0,16):"",usage_limit:item.usage_limit===null?"":String(item.usage_limit),is_active:item.is_active});
  }
  function editRegion(item:Region) {
    setRegionId(item.id);setRegion({name:item.name,neighborhoods:item.neighborhoods.join(", "),fee:String(item.fee),free_from:item.free_from===null?"":String(item.free_from),is_active:item.is_active});
  }

  return <section className="admin-commercial">
    <p className="eyebrow">REGRAS COMERCIAIS</p><h2>Cupons e entregas</h2>
    {error&&<p className="error-message" role="alert">{error}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
    <div className="admin-columns">
      <form className="admin-form" onSubmit={saveCoupon}>
        <h3>{couponId?"Editar cupom":"Novo cupom"}</h3>
        <label>Código<input required minLength={3} value={coupon.code} onChange={e=>setCoupon({...coupon,code:e.target.value.toUpperCase()})}/></label>
        <label>Tipo de desconto<select value={coupon.discount_type} onChange={e=>setCoupon({...coupon,discount_type:e.target.value as "percentage"|"fixed"})}><option value="percentage">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></label>
        <label>Desconto<input required type="number" min="0.01" step="0.01" value={coupon.discount_value} onChange={e=>setCoupon({...coupon,discount_value:e.target.value})}/></label>
        <label>Pedido mínimo (R$)<input type="number" min="0" step="0.01" value={coupon.minimum_order} onChange={e=>setCoupon({...coupon,minimum_order:e.target.value})}/></label>
        <label>Início (opcional)<input type="datetime-local" value={coupon.starts_at} onChange={e=>setCoupon({...coupon,starts_at:e.target.value})}/></label>
        <label>Validade final (opcional)<input type="datetime-local" value={coupon.expires_at} onChange={e=>setCoupon({...coupon,expires_at:e.target.value})}/></label>
        <label>Limite de utilizações (vazio = ilimitado)<input type="number" min="1" step="1" value={coupon.usage_limit} onChange={e=>setCoupon({...coupon,usage_limit:e.target.value})}/></label>
        <label className="check-label"><input type="checkbox" checked={coupon.is_active} onChange={e=>setCoupon({...coupon,is_active:e.target.checked})}/> Ativo</label>
        <button className="submit-button" disabled={busy}>{busy?"Salvando…":"Salvar cupom"}</button>
        {couponId&&<button type="button" onClick={()=>{setCoupon(emptyCoupon);setCouponId(null);}}>Cancelar edição</button>}
      </form>
      <div className="admin-list"><h3>Cupons cadastrados ({coupons.length})</h3>
        {coupons.map(item=><article className="admin-row" key={item.id}><div><strong>{item.code}</strong><small>{item.discount_type==="percentage"?item.discount_value+"%":formatCurrency(Number(item.discount_value))} · {item.usage_count}{item.usage_limit===null?"":" / "+item.usage_limit} usos · {item.is_active?"Ativo":"Inativo"}</small></div><button onClick={()=>editCoupon(item)}>Editar</button></article>)}
        {!coupons.length&&<p>Nenhum cupom cadastrado.</p>}
      </div>
    </div>
    <div className="admin-columns">
      <form className="admin-form" onSubmit={saveRegion}>
        <h3>{regionId?"Editar região":"Nova região de entrega"}</h3>
        <label>Nome da região<input required value={region.name} onChange={e=>setRegion({...region,name:e.target.value})}/></label>
        <label>Bairros atendidos (separados por vírgula)<textarea required rows={3} value={region.neighborhoods} onChange={e=>setRegion({...region,neighborhoods:e.target.value})}/></label>
        <label>Taxa de entrega (R$)<input required type="number" min="0" step="0.01" value={region.fee} onChange={e=>setRegion({...region,fee:e.target.value})}/></label>
        <label>Entrega grátis a partir de (R$)<input type="number" min="0" step="0.01" value={region.free_from} onChange={e=>setRegion({...region,free_from:e.target.value})}/></label>
        <label className="check-label"><input type="checkbox" checked={region.is_active} onChange={e=>setRegion({...region,is_active:e.target.checked})}/> Ativa</label>
        <button className="submit-button" disabled={busy}>{busy?"Salvando…":"Salvar região"}</button>
        {regionId&&<button type="button" onClick={()=>{setRegion(emptyRegion);setRegionId(null);}}>Cancelar edição</button>}
      </form>
      <div className="admin-list"><h3>Regiões cadastradas ({regions.length})</h3>
        {regions.map(item=><article className="admin-row" key={item.id}><div><strong>{item.name}</strong><small>{item.neighborhoods.join(", ")} · {formatCurrency(Number(item.fee))}{item.free_from===null?"":" · grátis acima de "+formatCurrency(Number(item.free_from))} · {item.is_active?"Ativa":"Inativa"}</small></div><button onClick={()=>editRegion(item)}>Editar</button></article>)}
        {!regions.length&&<p>Nenhuma região cadastrada.</p>}
      </div>
    </div>
  </section>;
}
