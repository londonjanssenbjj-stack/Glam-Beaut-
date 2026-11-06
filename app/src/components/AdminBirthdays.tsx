import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Birthday={customer_id:string;birth_date:string};
type Profile={id:string;full_name:string;email:string|null;phone:string|null};

export function AdminBirthdays(){
 const [items,setItems]=useState<Birthday[]>([]);
 const [profiles,setProfiles]=useState<Profile[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{
  const [b,p]=await Promise.all([
   supabase.from("customer_birthdays").select("customer_id,birth_date"),
   supabase.from("profiles").select("id,full_name,email,phone")
  ]);
  if(b.error)throw b.error;if(p.error)throw p.error;
  if(active){setItems((b.data??[]) as Birthday[]);setProfiles((p.data??[]) as Profile[]);}
 }catch(e){if(active)setError(e instanceof Error?e.message:"Falha ao carregar aniversários.");}
 finally{if(active)setLoading(false);}})();return()=>{active=false;};},[]);
 const today=new Date();const year=today.getFullYear();
 const ordered=items.map(item=>{const date=new Date(item.birth_date+"T12:00:00");let next=new Date(year,date.getMonth(),date.getDate());if(next<new Date(year,today.getMonth(),today.getDate()))next=new Date(year+1,date.getMonth(),date.getDate());return {...item,next};}).sort((a,b)=>a.next.getTime()-b.next.getTime());
 return <section className="admin-list"><p className="eyebrow">RELACIONAMENTO</p><h2>Aniversariantes</h2><p>Datas informadas pelos próprios clientes. O benefício ainda depende de configuração comercial.</p>
 {error&&<p className="error-message" role="alert">{error}</p>}
 {loading?<p>Carregando aniversários…</p>:ordered.length?ordered.map(item=>{const profile=profiles.find(p=>p.id===item.customer_id);return <article className="admin-row" key={item.customer_id}><div><strong>{profile?.full_name||"Cliente"}</strong><small>{new Date(item.birth_date+"T12:00:00").toLocaleDateString("pt-BR")} · {profile?.email??"Sem e-mail"} · {profile?.phone??"Sem telefone"}</small></div><strong>{item.next.toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</strong></article>}):<p>Nenhum aniversário cadastrado.</p>}
 </section>;
}
