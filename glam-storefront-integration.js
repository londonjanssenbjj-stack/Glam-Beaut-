/* Glam Beaut storefront integration - development branch only.
   Public Supabase credentials only. No payment secrets in this file. */
(function(){
  const cfg=window.GLAM_SUPABASE_CONFIG;
  if(!cfg||!window.supabase){console.warn("Glam backend integration not loaded");return;}
  const db=window.supabase.createClient(cfg.url,cfg.publishableKey);
  window.GLAM_DB=db;
  let catalog=[],authSession=null,submitting=false;
  const $=id=>document.getElementById(id);
  const moneyFmt=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  function showBackendMessage(msg){if($("checkoutMessage"))$("checkoutMessage").innerHTML='<span class="success">'+escapeHTML(msg)+'</span>';}
  function escapeHTML(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
  function injectAuth(){
    if($("glamAuthModal"))return;
    const style=document.createElement("style");
    style.textContent=".glam-auth-box{max-width:440px}.glam-auth-actions{display:flex;gap:10px;margin-top:12px}.glam-auth-actions button{flex:1}.glam-auth-note{font-size:12px;color:#666;margin:10px 0}";
    document.head.appendChild(style);
    const modal=document.createElement("div");modal.className="modal";modal.id="glamAuthModal";
    modal.innerHTML='<div class="modal-box glam-auth-box"><button class="modal-close" id="glamAuthClose">×</button><h2>Entrar para comprar</h2><p class="notice">Para criar seu pedido com segurança, entre ou crie sua conta.</p><div class="field"><label>E-mail</label><input id="glamAuthEmail" type="email" required autocomplete="email"></div><div class="field"><label>Senha</label><input id="glamAuthPassword" type="password" required minlength="8" autocomplete="current-password"></div><div class="glam-auth-actions"><button class="btn outline" id="glamAuthSignIn">Entrar</button><button class="btn" id="glamAuthSignUp">Criar conta</button></div><div id="glamAuthMsg" class="form-message"></div></div>';
    document.body.appendChild(modal);
    $("glamAuthClose").onclick=()=>modal.classList.remove("show");
    $("glamAuthSignIn").onclick=()=>authAction("signin");
    $("glamAuthSignUp").onclick=()=>authAction("signup");
  }
  async function authAction(kind){
    const email=$("glamAuthEmail").value.trim(),password=$("glamAuthPassword").value;
    if(!email||password.length<8){$("glamAuthMsg").textContent="Informe e-mail e senha (mínimo 8 caracteres).";return;}
    $("glamAuthMsg").textContent="Aguarde...";
    const res=kind==="signin"?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password});
    if(res.error){$("glamAuthMsg").textContent=res.error.message;return;}
    authSession=res.data.session;
    $("glamAuthMsg").textContent=kind==="signup"&&!authSession?"Cadastro criado. Verifique seu e-mail se a confirmação estiver habilitada.":"Login realizado.";
    if(authSession){ $("glamAuthModal").classList.remove("show"); showToast("Você está conectado.");}
  }
  async function getSession(){
    const {data,error}=await db.auth.getSession();
    if(error)throw error;
    authSession=data.session;
    return authSession;
  }
  async function loadCatalog(){
    const {data,error}=await db.rpc("storefront_catalog");
    if(error){console.error("Catalog RPC failed",error);showToast("Não foi possível carregar o catálogo do banco.");return;}
    catalog=(Array.isArray(data)?data:[]).map(r=>({
      id:r.variant_id, productId:r.product_id, name:r.product_name,
      variant:r.variant_name, price:Number(r.price), category:r.category_slug||"todos",
      description:r.description||"", image:r.image_url||"", badge:r.is_featured?"DESTAQUE":"",
      badgeType:r.is_featured?"kit":"", available:true, createdAt:r.created_at||null
    }));
    window.GLAM_CATALOG=catalog;
    const validIds=new Set(catalog.map(p=>p.id));
    cart=cart.filter(item=>validIds.has(item.variant_id||item.id));
    localStorage.setItem("glam_cart",JSON.stringify(cart));
    renderDbProducts();
    updateCartDb();
  }
  function renderDbProducts(list=catalog){
    const grid=$("productGrid");if(!grid)return;
    grid.innerHTML=list.length?list.map(p=>{
      const im=p.image?'<img src="'+escapeHTML(p.image)+'" alt="'+escapeHTML(p.name)+'" loading="lazy">':'<div class="placeholder">G</div>';
      const title=p.variant&&p.variant!=="Padrão"?p.name+" — "+p.variant:p.name;
      return '<article class="card"><div class="product-image">'+(p.badge?'<span class="badge kit">'+escapeHTML(p.badge)+'</span>':'')+im+'</div><h3>'+escapeHTML(title)+'</h3><div class="meta">'+escapeHTML(p.description)+'</div><div class="price">'+moneyFmt(p.price)+'</div><button class="btn outline" onclick="addToCartDb(\''+p.id+'\')">Adicionar à Sacola</button></article>';
    }).join(""):'<div style="grid-column:1/-1;padding:30px 0;color:#666;font-size:13px">Nenhum produto disponível no momento.</div>';
    $("catalogCount").textContent=list.length+" "+(list.length===1?"produto disponível":"produtos disponíveis");
  }
  function filterDb(category,button){
    currentFilter=category;
    document.querySelectorAll(".chip").forEach(x=>x.classList.remove("active"));if(button)button.classList.add("active");
    let list=catalog;
    if(category==="novos"){
      const cutoff=Date.now()-30*24*60*60*1000;
      list=catalog.filter(p=>p.createdAt && Date.parse(p.createdAt)>=cutoff);
    } else if(category==="best"){
      // Sales ranking cannot be claimed without sales data; currently orders are not populated.
      list=[];
      showToast("Mais vendidos será exibido quando houver histórico real de vendas.");
    } else if(category==="presentes")list=catalog.filter(p=>p.category==="kits");
    else if(category!=="todos")list=catalog.filter(p=>p.category===category);
    renderDbProducts(list);
  }
  function addToCartDb(id){
    const p=catalog.find(x=>x.id===id);if(!p)return;
    const item=cart.find(x=>x.id===id);if(item)item.qty++;else cart.push({id,variant_id:id,qty:1});
    saveCartDb();showToast(p.name+" adicionada à sacola.");openCart();
  }
  function cartSubtotalDb(){return cart.reduce((sum,it)=>{const p=catalog.find(x=>x.id===it.id);return sum+(p?p.price*it.qty:0);},0);}
  function updateCartDb(){
    const body=$("cartBody"),count=cart.reduce((s,x)=>s+x.qty,0);$("bagCount").textContent=count;
    body.innerHTML=!cart.length?'<div class="empty"><div style="font-size:38px;margin-bottom:12px">♡</div>Sua sacola está vazia.</div>':cart.map(it=>{
      const p=catalog.find(x=>x.id===it.id);if(!p)return "";
      return '<div class="cart-item"><div class="cart-thumb">'+(p.image?'<img src="'+escapeHTML(p.image)+'" alt="">':'G')+'</div><div><div class="cart-name">'+escapeHTML(p.name+(p.variant?' — '+p.variant:''))+'</div><div class="cart-price">'+moneyFmt(p.price*it.qty)+'</div><div class="qty"><button onclick="changeQtyDb(\''+it.id+'\',-1)">−</button><span>'+it.qty+'</span><button onclick="changeQtyDb(\''+it.id+'\',1)">+</button></div></div><button class="remove" onclick="removeFromCartDb(\''+it.id+'\')">Excluir</button></div>';
    }).join("");
    const sub=cartSubtotalDb(),fee=deliveryValueDb(),total=sub+fee;
    $("subtotal").textContent=moneyFmt(sub);$("delivery").textContent=fee===0 && cart.length && $("checkoutDelivery")?.value!=="retirada"?"Calculado no checkout":moneyFmt(fee);$("cartTotal").textContent=fee===0 && cart.length && $("checkoutDelivery")?.value!=="retirada"?"Subtotal + frete":"Total estimado: "+moneyFmt(total);
    if($("checkoutTotal"))$("checkoutTotal").textContent=moneyFmt(total);
  }
  function saveCartDb(){
    // Any cart edit invalidates the previous checkout request key; a payment retry
    // without cart edits intentionally keeps the key for idempotent order reuse.
    localStorage.removeItem("glam_checkout_request_key");
    localStorage.setItem("glam_cart",JSON.stringify(cart));
    updateCartDb();
  }
  function deliveryValueDb(){const s=$("checkoutDelivery");return s&&s.value==="retirada"?0:0;}
  function removeFromCartDb(id){cart=cart.filter(x=>x.id!==id);saveCartDb();}
  function changeQtyDb(id,delta){const it=cart.find(x=>x.id===id);if(!it)return;it.qty+=delta;if(it.qty<=0)cart=cart.filter(x=>x.id!==id);saveCartDb();}
  function filterSearchDb(term){
    const q=term.trim().toLowerCase(),list=!q?catalog:catalog.filter(p=>[p.name,p.description,p.category,p.variant].join(" ").toLowerCase().includes(q));
    $("searchResults").innerHTML=list.length?list.map(p=>{
      const image=p.image?'<img src="'+escapeHTML(p.image)+'" alt="" loading="lazy">':'<div class="placeholder">G</div>';
      return '<article class="card"><div class="product-image">'+image+'</div><h3>'+escapeHTML(p.name)+'</h3><div class="price">'+moneyFmt(p.price)+'</div><button class="btn outline" onclick="addToCartDb(\''+p.id+'\')">Adicionar à Sacola</button></article>';
    }).join(""):'<p style="color:#666">Nenhum resultado.</p>';
  }
  function addressPayload(delivery){
    if(delivery==="pickup")return null;
    return {recipient_name:$("checkoutName").value.trim(),phone:$("checkoutPhone").value.trim(),postal_code:$("checkoutPostal").value.trim(),street:$("checkoutStreet").value.trim(),number:$("checkoutNumber").value.trim(),complement:$("checkoutComplement").value.trim(),neighborhood:$("checkoutNeighborhood").value.trim()};
  }
  async function finishOrderDb(event){
    event.preventDefault();if(submitting)return;
    if(!cart.length){showToast("Sacola vazia.");return;}
    submitting=true;const btn=event.submitter;if(btn){btn.disabled=true;btn.textContent="Processando...";}
    try{
      const session=await getSession();
      if(!session){injectAuth();$("glamAuthModal").classList.add("show");showBackendMessage("Faça login para continuar.");return;}
      const delivery=$("checkoutDelivery").value==="retirada"?"pickup":"delivery";
      const items=cart.map(x=>({variant_id:x.variant_id||x.id,quantity:Number(x.qty)}));
      let key=localStorage.getItem("glam_checkout_request_key");
      if(!key){key=crypto.randomUUID();localStorage.setItem("glam_checkout_request_key",key);}
      const {data:order,error}=await db.rpc("create_customer_order_idempotent",{p_request_key:key,p_items:items,p_delivery_method:delivery,p_shipping_address:addressPayload(delivery),p_coupon_code:null});
      if(error)throw error;
      const {data:payment,error:paymentError}=await db.functions.invoke("create-payment",{body:{order_id:order.order_id}});
      if(paymentError)throw paymentError;
      if(!payment?.checkout_url)throw new Error("Checkout de pagamento não retornou URL.");
      localStorage.removeItem("glam_checkout_request_key");
      localStorage.removeItem("glam_last_order");
      cart=[];saveCartDb();
      closeModal("checkoutModal");
      window.location.href=payment.checkout_url;
    }catch(e){
      console.error("Checkout backend error",e);
      showBackendMessage(e.message||"Não foi possível concluir. Tente novamente.");
    }finally{
      submitting=false;if(btn){btn.disabled=false;btn.textContent="Enviar pedido";}
    }
  }
  function openCheckoutDb(){
    if(!cart.length){showToast("Adicione pelo menos um produto.");return;}
    const existing=document.getElementById("checkoutModal");if(existing){closeCart();existing.classList.add("show");updateCartDb();}
  }
  function wire(){
    injectAuth();
    // Replace public-storefront behavior with backend data and safe checkout.
    window.addToCart=addToCartDb;window.removeFromCart=removeFromCartDb;window.changeQty=changeQtyDb;
    window.cartSubtotal=cartSubtotalDb;window.deliveryValue=deliveryValueDb;window.updateCart=updateCartDb;window.saveCart=saveCartDb;
    window.finishOrder=finishOrderDb;window.openCheckout=openCheckoutDb;window.filterProducts=filterDb;window.searchProducts=filterSearchDb;
    const delivery=$("checkoutDelivery");if(delivery){delivery.innerHTML='<option value="local">Entrega local</option><option value="retirada">Retirar na Glam</option>';delivery.addEventListener("change",()=>{const pickup=delivery.value==="retirada";["checkoutStreet","checkoutNumber","checkoutNeighborhood","checkoutPostal"].forEach(id=>{const field=$(id);if(field){field.required=!pickup;field.disabled=pickup;}});updateCartDb();});}
    // Convert checkout UI to structured address, and make payment hosted by MP.
    const oldPayment=$("checkoutPayment");if(oldPayment){oldPayment.innerHTML='<option value="mercado_pago">Pix ou cartão via Mercado Pago</option>';oldPayment.required=false;oldPayment.value="mercado_pago";}
    const addr=$("checkoutAddress");if(addr){
      const wrap=addr.parentElement;
      wrap.innerHTML='<label>Endereço de entrega</label><div class="two"><input id="checkoutStreet" required placeholder="Rua"><input id="checkoutNumber" required placeholder="Número"></div><div class="two"><input id="checkoutNeighborhood" required placeholder="Bairro"><input id="checkoutPostal" required placeholder="CEP"></div><input id="checkoutComplement" placeholder="Complemento (opcional)">';
    }
    const form=$("checkoutModal")?.querySelector("form");if(form)form.onsubmit=finishOrderDb;
    const {data}=db.auth.onAuthStateChange((_event,session)=>{authSession=session;});
    loadCatalog().catch(e=>console.error("Catalog load error",e));
  }
  window.addToCartDb=addToCartDb;window.removeFromCartDb=removeFromCartDb;window.changeQtyDb=changeQtyDb;
  window.finishOrderDb=finishOrderDb;window.GlamStorefront={loadCatalog,renderDbProducts,getSession};
  document.addEventListener("DOMContentLoaded",wire);
})();