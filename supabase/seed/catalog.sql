-- Catálogo extraído do HTML aprovado da Glam Beaut (16 produtos e 8 serviços).
-- Importante: todos entram inativos; publicar/ativar exige conferência administrativa,
-- imagens reais, estoque e configuração de preço no painel antes de disponibilizar.
insert into public.categories (name, slug, sort_order, is_active) values
  ('Skincare','skincare',1,false),
  ('Kits','kits',2,false),
  ('Perfumaria','perfumaria',3,false),
  ('Bolsas','bolsas',4,false),
  ('Acessórios','acessorios',5,false),
  ('Roupas','roupas',6,false)
on conflict (slug) do nothing;

insert into public.products (category_id,name,slug,description,price,is_active,is_featured)
select c.id, v.name, v.slug, v.description, v.price, false, v.featured
from (values
 ('skincare','Glow Facial Premium Express','glow-facial-premium-express','Experiência facial para devolver viço e luminosidade.',145.00,false),
 ('skincare','Glass Skin Coreano','glass-skin-coreano','Protocolo de aparência iluminada e pele bem cuidada.',130.00,true),
 ('skincare','Glam Deep Hydration','glam-deep-hydration','Hidratação profunda para cabelos que precisam de cuidado.',140.90,true),
 ('skincare','Glam Absolut Repair','glam-absolut-repair','Tratamento de reparação e cuidado.',159.99,false),
 ('skincare','Glam Hi Repair','glam-hi-repair','Reconstrução e reparação para fios sensibilizados.',179.99,false),
 ('skincare','Glam CPR SOS','glam-cpr-sos','Protocolo SOS mediante avaliação profissional.',265.00,false),
 ('skincare','Glam Platinum Repair','glam-platinum-repair','Experiência premium de reparação.',275.90,true),
 ('skincare','Glam Hair Experience','glam-hair-experience','Experiência completa de cuidado capilar.',285.99,false),
 ('kits','Kit Aniversário Glam','kit-aniversario-glam','Seleção especial para presentear alguém.',199.90,false),
 ('kits','Experiência Glam — Kit Misto','experiencia-glam-kit-misto','Produto + experiência estética em um único presente.',299.90,false),
 ('kits','Kit Dia de Beleza','kit-dia-de-beleza','Uma experiência de autocuidado para celebrar.',349.90,true),
 ('perfumaria','Perfume Glam','perfume-glam','Fragrância para acompanhar seus melhores momentos.',189.90,false),
 ('bolsas','Bolsa Glam','bolsa-glam','Modelo selecionado para compor seu look.',219.90,false),
 ('acessorios','Acessório Glam','acessorio-glam','Detalhe delicado para completar sua produção.',59.90,false),
 ('roupas','Look Glam','look-glam','Peça selecionada para um visual sofisticado.',169.90,false),
 ('kits','Kit Presente Skincare','kit-presente-skincare','Cuidados para uma rotina de beleza especial.',159.90,false)
) as v(category_slug,name,slug,description,price,featured)
join public.categories c on c.slug=v.category_slug
on conflict (slug) do nothing;

insert into public.services (name,slug,description,price,duration_minutes,is_active) values
 ('Hidratação + Escova','hidratacao-escova','Cuidado e finalização para um cabelo macio e bonito.',89.90,null,false),
 ('Reconstrução + Escova','reconstrucao-escova','Reconstrução com finalização. Consulte disponibilidade do brinde promocional.',139.00,null,false),
 ('Glow Facial Premium Express','glow-facial-premium-express','Protocolo facial com foco em luminosidade e viço.',145.00,null,false),
 ('Limpeza de Pele','limpeza-de-pele','Higienização e cuidado facial conforme avaliação.',135.00,null,false),
 ('Drenagem Linfática','drenagem-linfatica','Sessão de cuidado corporal.',120.00,null,false),
 ('Massagem Relaxante','massagem-relaxante','Momento de relaxamento e bem-estar.',120.00,null,false),
 ('Microagulhamento Facial','microagulhamento-facial','Valor mediante avaliação e indicação profissional.',null,null,false),
 ('Protocolo Papada sem Agulhas','protocolo-papada-sem-agulhas','Avaliação necessária para definir protocolo.',null,null,false)
on conflict (slug) do nothing;
