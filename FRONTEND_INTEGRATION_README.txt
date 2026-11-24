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
