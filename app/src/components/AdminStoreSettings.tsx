import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

export function AdminStoreSettings() {
  const [phone,setPhone]=useState("");
  const [pickup,setPickup]=useState(true);
  const [delivery,setDelivery]=useState(true);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  useEffect(()=>{let active=true;(async()=>{
    try {
      const {data,error}=await supabase.rpc("admin_get_store_settings");
      if(error)throw error;
      const settings=Array.isArray(data)?data[0]:null;
      if(active&&settings){setPhone(settings.whatsapp_phone??"");setPickup(settings.pickup_enabled);setDelivery(settings.delivery_enabled);}
    } catch(cause) {if(active)setError(cause instanceof Error?cause.message:"Não foi possível carregar as configurações.");}
    finally {if(active)setLoading(false);}
  })();return()=>{active=false;};},[]);

  async function save(event:FormEvent){
    event.preventDefault();setSaving(true);setError("");setNotice("");
    try {
      const digits=phone.replaceAll("+","").replaceAll(" ","").replaceAll("-","").replaceAll("(","").replaceAll(")","");
      if(digits&& (digits.length<10||digits.length>15))throw new Error("Informe o WhatsApp com código do país e DDD.");
      const {error}=await supabase.rpc("admin_save_store_settings",{p_whatsapp_phone:digits||null,p_pickup_enabled:pickup,p_delivery_enabled:delivery});
      if(error)throw error;
      setPhone(digits);setNotice("Configurações da loja salvas.");
    } catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível salvar as configurações.");}
    finally{setSaving(false);}
  }

  return <section className="admin-store-settings">
    <p className="eyebrow">CONFIGURAÇÕES DA LOJA</p><h2>Contato e modalidades</h2>
    <p>Informe o número oficial do WhatsApp com código do país e DDD. Exemplo de formato: 5567999999999.</p>
    {error&&<p className="error-message" role="alert">{error}</p>}
    {notice&&<p className="notice" role="status">{notice}</p>}
    {loading?<p>Carregando configurações…</p>:<form className="admin-form" onSubmit={save}>
      <label>WhatsApp da loja<input type="tel" inputMode="numeric" autoComplete="tel" placeholder="5567999999999" value={phone} onChange={e=>setPhone(e.target.value)}/></label>
      <label className="check-label"><input type="checkbox" checked={pickup} onChange={e=>setPickup(e.target.checked)}/> Permitir retirada na loja</label>
      <label className="check-label"><input type="checkbox" checked={delivery} onChange={e=>setDelivery(e.target.checked)}/> Permitir entrega</label>
      <button className="submit-button" disabled={saving}>{saving?"Salvando…":"Salvar configurações"}</button>
    </form>}
  </section>;
}
