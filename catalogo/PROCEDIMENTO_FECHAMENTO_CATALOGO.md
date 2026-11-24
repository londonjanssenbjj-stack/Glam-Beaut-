# Glam Beaut — Procedimento de fechamento do catálogo real
Atualizado em 24/11/2026
Branch: glam-product-stock-management-plan

## Regra
As fotos de referência foram extraídas de vídeos e podem mostrar vários produtos, repetidos em tomadas diferentes ou com rótulos ilegíveis. Portanto, este inventário NÃO deve ser importado diretamente para o banco como 49 produtos.

## Política de catálogo
- Criar um produto por item físico/mercadoria distinta identificada.
- Se o mesmo produto aparece em diferentes frames, usar uma única entrada e apontar as referências de imagem como evidência de comparação.
- Produtos sem variantes: manter uma variante padrão única ("Padrão") para compatibilidade com o banco de dados; esconder a escolha de variante na vitrine.
- Variantes só são criadas quando o cliente realmente escolhe entre opções (tamanho, cor, volume, modelo), com estoque por variante.
- Estoque é número físico contado, nunca inferido de imagens.
- Produto esgotado: não pode ser adicionado ao carrinho; permanece visível apenas se a política de catálogo desejar mostrar esgotados.
- SKU interno gerado para controle, mas não substituir SKU original de fabricante quando legível.
- Preço deve ser confirmado antes de ativar a publicação.
- Foto do produto deve corresponder ao item individual; não usar fotos de bandejas/expositores como imagem principal de produto individual.

## Categorias iniciais
- Cosméticos / skincare
- Cuidado capilar
- Maquiagem
- Perfumaria
- Bolsas
- Bijuterias / joias

## Campos mínimos do cadastro
product_name, category, description, manufacturer, volume_or_size, sku, price, image_path, variant_enabled, variant_name, quantity_physical, is_active, photo_reference, validation_status.

## Status recomendados
- IDENTIFICAR: nome/marca/volume ainda não confirmados.
- CONTAR: produto identificado, quantidade física pendente.
- PRECIFICAR: identificação e contagem prontas, preço pendente.
- FOTO: dados comerciais confirmados, imagem individual ainda pendente.
- PRONTO: identificação, preço, estoque e foto conferidos.
- PUBLICADO: ativado na vitrine e sincronizado com o backend.

## Procedimento antes da importação
1. Revisar visualmente cada frame.
2. Agrupar frames que mostram o mesmo produto.
3. Separar cenas com vários itens em produtos individuais.
4. Confirmar marca, nome, volume/variante e SKU, quando legível.
5. Contar unidades fisicamente.
6. Confirmar preço de venda.
7. Selecionar a melhor foto individual.
8. Criar produto e variante padrão ou variantes reais.
9. Importar somente registros com status PRONTO.
10. Fazer validação de vitrine, carrinho e checkout em sandbox.

## Não fazer
- Não cadastrar fotos de grupo como se fossem produtos únicos.
- Não inventar nome de produto, marca, volume, preço ou estoque.
- Não ativar produtos sem quantidade positiva.
- Não aplicar esta migração ao Supabase sem revisão e testes.
- Não publicar/deployar mudanças do branch sem testes de regressão.
