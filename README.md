# Glam Beaut

Nova estrutura da plataforma Glam Beaut, mantendo o site atualmente publicado intacto durante o desenvolvimento.

## Decisões da Fase 2

- Repositório: `londonjanssenbjj-stack/Glam-Beaut-`
- Branch de trabalho: `fase-2-estrutura`
- Hospedagem escolhida: GitHub Pages
- Aplicação: React + TypeScript + Vite
- Backend planejado: projeto Supabase exclusivo da Glam Beaut
- Aplicação em `app/`; saída de produção em `dist/`
- Base pública: `/Glam-Beaut-/`

## Preservação do site atual

O `index.html` da raiz, utilizado pelo site publicado, não foi alterado. A nova aplicação fica isolada em `app/` nesta branch de desenvolvimento. Não publicar sobre o site atual até que implementação, integração e testes sejam concluídos e aprovados.

## Requisitos locais

Node.js compatível com Vite 8 e npm.

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run preview
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` na fase de integração Supabase. Preencha somente URL do projeto e chave publicável. Nunca coloque chave secreta ou service_role no frontend.

## Estrutura planejada

```text
app/
  index.html
  public/
  src/
    components/
    features/
      catalog/
      cart/
      checkout/
      account/
      services/
      admin/
    lib/
    styles/
    App.tsx
    main.tsx
    styles.css
```

Tabelas, políticas RLS, pagamentos, integrações e publicação final serão implementados e verificados nas fases seguintes.
