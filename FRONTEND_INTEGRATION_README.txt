GLAM BEAUT - INTEGRACAO SUPABASE FRONTEND

Arquivos desta etapa (branch glam-supabase-checkout-integration):
- glam-supabase-integration.js: modulo isolado com auth, catalogo, pedido e chamada create-payment.
- glam-supabase-config.example.js: modelo de configuracao frontend (sem segredo).
- index.html: nao alterado nesta etapa.
- main: nao alterada.

Como conectar quando for autorizado o teste frontend:
1. Copiar glam-supabase-config.example.js para glam-supabase-config.js e preencher somente URL e publishable key publica.
2. Incluir Supabase JS v2 por CDN oficial antes dos dois arquivos de configuracao/modulo.
3. Carregar glam-supabase-config.js antes glam-supabase-integration.js.
4. O modulo fica disponivel em window.GlamSupabase.
5. Fazer o fluxo de auth, catalogo e pedido usando IDs UUID de variants.
6. Antes de ligar ao index.html, revisar o HTML e realizar testes no branch.

Seguranca:
- Nao incluir service_role, secret key, Mercado Pago Access Token, webhook secret, credenciais de cliente ou senhas.
- Este scaffold nao cria admin, usuario, produto, variante, estoque, bairro ou pedido.
- O catalogo so retorna produtos ativos com variantes ativas.
- A RPC e a Edge Function exigem sessao autenticada.
- Consulta de status do pedido ainda precisa de endpoint/RPC seguro.
- Nenhum arquivo existente foi sobrescrito e o site publicado nao foi alterado.


PROGRESSO ADICIONAL - 24/11/2026
- ensureCustomerRecords(user, metadata): verifica/cria perfil e papel customer apos signup com sessao ou login.
- loadActiveCategories(): consulta categorias ativas ordenadas.
- loadActiveDeliveryRegions(): consulta apenas regioes ativas e campos publicos de entrega.
- Estas alteracoes foram feitas apenas no arquivo glam-supabase-integration.js na branch isolada.
- index.html e main permanecem inalterados.
- Nao foram criados usuarios, pedidos, produtos, variantes, estoque, bairros ou settings.
- Consulta de status do pedido continua sem endpoint seguro; nao implementar leitura direta de orders sem validar policy/RLS.

CHECKPOINT 24/11/2026 - VALIDACAO CLIENTE E CHECKOUT
- Modulo agora inclui ensureCustomerRecords(user, metadata), garantindo profile e role customer apos auth quando ha sessao.
- Inclui loadActiveCategories e loadActiveDeliveryRegions (somente registros ativos).
- createCustomerOrder valida metodo, UUID de variant, quantidade integer 1..99 e campos obrigatorios de endereco antes de RPC.
- O backend permanece autoridade de precos/estoque/regras.
- Ainda nao foi ligado ao index.html. Nao executar fluxo checkout ate admin/catalogo/estoque/entrega configurados.
- Consulta de status do pedido ainda pendente de endpoint seguro.

CHECKPOINT 24/11/2026 - ORDER STATUS SECURE ENDPOINT
- Supabase Edge Function order-status deployed ACTIVE v1 with verify_jwt=true.
- Endpoint validates token through auth.getUser(), validates UUID order_id, and uses service-role server-side only to query order constrained by customer_id=user.id. No secrets in frontend.
- Returns order status, payment_status and safe payment summary; does not return checkout URL or sensitive address.
- Frontend module getOrderStatus() now invokes order-status Edge Function; change committed on integration branch.
- index.html/main untouched. No RLS/policy/table/schema changes made. No test orders created.

CHECKPOINT - CONTINUACAO DO FLUXO FRONTEND (SEM ALTERAR SITE)
- Helpers adicionais no glam-supabase-integration.js:
  - getVariantPrice(product, variant): calcula preco exibido considerando price_override, fallback no preco base. Apenas UI; RPC recalcula no servidor.
  - normalizeCartItems(items): valida UUID/quantidade e agrega itens repetidos pela variante.
  - parsePaymentReturn(search): classifica query de retorno em success/pending/failure/unknown. O retorno URL nao e fonte confiavel; getOrderStatus deve consultar backend.
- Helpers foram exportados no objeto window.GlamSupabase.
- Nao conectados ao index.html. Nenhum arquivo existente fora do modulo/readme foi alterado.

CONTINUACAO - AJUSTE RETORNO MERCADO PAGO
- Investigacao confirmou create-payment configura URLs com query payment=success/pending e order=<order_number>, nao UUID.
- Order number gerado pelo backend segue GL-YYYYMMDDHH24MISS-6HEX.
- order-status Edge Function v2 ACTIVE, verify_jwt=true, agora aceita UUID ou order_number (formato restrito), sempre filtra pelo customer_id autenticado. Mantem uso service role apenas no backend, sem expor token.
- Frontend parsePaymentReturn atualizado para ler payment e order, verifyPaymentReturn consulta backend e ignora status de URL como prova.
- getOrderStatus aceita UUID ou numero GL- validado, envia identificador apropriado.
- Correcoes feitas apos inspecao para alinhar retorno real da Edge Function. Nenhuma mudanca de schema, RLS, main ou index.html.

CHECKPOINT FINAL DESTA SESSAO - 24/11/2026
- Lista de Edge Functions verificada: create-payment ACTIVE v4 verify_jwt=true; mercadopago-webhook ACTIVE v6 verify_jwt=false; order-status ACTIVE v2 verify_jwt=true.
- Confirmado create-payment retorna checkout_url e URLs success/pending usam payment= e order_number (GL-...).
- order-status v2 recebe order_id UUID ou order_number GL-..., valida usuario via Auth, restringe consulta por customer_id, e usa service role somente server-side.
- Frontend verifyPaymentReturn consulta backend para confirmar, sem confiar no querystring.
- normalizeCartItems agregador recebeu limite adicional de 99 por variante após agregacao.
- O modulo foi mantido isolado. index.html ainda nao carrega o modulo.
- Proxima etapa de integracao visual ainda bloqueada por dados/operacao reais: nenhum admin, produtos ativos/variantes/inventario/regioes/settings ausentes. Evitar pedido real ou falso.
- Teste Sandbox end-to-end precisa conta autenticada de teste e configuracao comercial valida; nao simular sucesso de pagamento.


CHECKPOINT 24/11/2026 - CARREGAMENTO DO SDK E CONFIG PUBLICA (BRANCH DE INTEGRACAO)
- Arquivo glam-supabase-config.js criado com URL do projeto e publishable key publica.
- index.html da branch de integracao agora inclui Supabase JS v2 via CDN, config publica e modulo glam-supabase-integration.js, com scripts defer.
- Esta inclusao apenas carrega o scaffold e expõe window.GlamSupabase; ainda nao conectou os controles da loja, catalogo, carrinho ou checkout à UI.
- main continua intocada e o site publicado permanece inalterado.
- RLS, schemas, tabelas, politicas, RPCs e secrets nao foram modificados.
- Antes da conexao funcional da UI, seguem bloqueios: usuarios/admin ainda inexistentes, catalogo ativo/variantes/estoque vazio, delivery_regions e store_settings sem configuração comercial.
- Config JS usa apenas chave publishable; nenhum segredo privado foi colocado no frontend.
