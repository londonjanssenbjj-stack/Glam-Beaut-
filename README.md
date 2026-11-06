# Glam Beaut

Aplicação React + TypeScript + Vite da Glam Beaut. O site público original continua preservado na raiz e não será substituído antes da conclusão e autorização da publicação.

## Estrutura atual

- Frontend React em `app/`.
- Supabase/Postgres para catálogo, clientes, pedidos, estoque, agendamentos, cupons e regiões.
- Edge Functions previstas para Checkout Pro e notificações de pagamento.
- Branch de desenvolvimento: `fase-2-estrutura`.
- Hospedagem planejada: GitHub Pages, base `/Glam-Beaut-/`.

## Desenvolvimento local

Requer Node.js compatível com Vite 8.

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

## Frontend: variáveis

Copie `.env.example` para `.env.local` e configure somente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (ou chave publishable)

Nunca inclua `service_role`, chave secreta ou token do Mercado Pago em variáveis `VITE_*`.

## Supabase: Edge Functions

As funções estão versionadas em:

- `supabase/functions/create-payment/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`

Antes de implantá-las, configure os segredos no projeto Supabase **Glam Beaut** (não no projeto Primary):

| Segredo | Uso |
|---|---|
| `MERCADO_PAGO_ACCESS_TOKEN` | Token privado de acesso do Mercado Pago |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Segredo de assinatura dos Webhooks |
| `SUPABASE_SERVICE_ROLE_KEY` | Acesso privilegiado apenas no servidor |
| `APP_SITE_URL` | URL HTTPS da aplicação React publicada |
| `MERCADO_PAGO_WEBHOOK_URL` | URL HTTPS da função `mercadopago-webhook` |
| `APP_ORIGIN` | Opcional; origem permitida no CORS, se diferente de APP_SITE_URL |

Configure os valores em Supabase Dashboard > Edge Functions > Secrets. Não os envie pelo chat, não os grave no Git e não os exponha no frontend.

### Implantação (somente após configurar os segredos)

```bash
supabase functions deploy create-payment --project-ref hxheluremudcdhtopdlv
supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref hxheluremudcdhtopdlv
```

A função `create-payment` exige JWT de usuário. O webhook não exige JWT Supabase porque a origem é autenticada pela assinatura HMAC do Mercado Pago.

### Configuração do Mercado Pago

1. Criar/selecionar a aplicação no painel de desenvolvedores.
2. Usar credenciais de teste inicialmente.
3. Configurar Webhooks para o evento **Payments** e copiar o segredo de assinatura para `MERCADO_PAGO_WEBHOOK_SECRET`.
4. Configurar a URL HTTPS da função `mercadopago-webhook`.
5. Testar notificações e pagamentos com credenciais de teste.
6. Só depois de validar, trocar para credenciais de produção.

O sistema não considera a URL de retorno como prova de pagamento. O webhook consulta o pagamento na API do Mercado Pago, valida assinatura, pedido, valor e moeda antes de atualizar o status.

## Estado de implementação

- [x] Checkout calcula subtotal, entrega, desconto e total no banco.
- [x] Cupom validado no servidor e utilização registrada transacionalmente.
- [x] Função de criação de preferência Checkout Pro versionada.
- [x] Webhook com validação HMAC, consulta do pagamento e conferência de valor/moeda versionado.
- [x] Cliente pode retomar pagamento pendente na área da conta.
- [ ] Configurar segredos do Supabase e credenciais Mercado Pago.
- [ ] Implantar Edge Functions no Supabase.
- [ ] Executar testes E2E com conta de teste e credenciais de teste.
- [ ] Configurar WhatsApp Business e regras comerciais definitivas.
- [ ] Publicação final autorizada.

## Preservação

Não alterar o `index.html` da raiz nem publicar sobre o site antigo durante o desenvolvimento.
