import type { CatalogProduct, CatalogService } from "../types/catalog";

export const products: CatalogProduct[] = [
  { id: "p1", name: "Glow Facial Premium Express", price: 145, category: "skincare", badge: "NEW", badgeType: "new", description: "Experiência facial para devolver viço e luminosidade.", image: null },
  { id: "p2", name: "Glass Skin Coreano", price: 130, category: "skincare", badge: "MAIS VENDIDO", badgeType: "kit", description: "Protocolo de aparência iluminada e pele bem cuidada.", image: null },
  { id: "p3", name: "Glam Deep Hydration", price: 140.9, category: "skincare", badge: "MAIS VENDIDO", badgeType: "kit", description: "Hidratação profunda para cabelos que precisam de cuidado.", image: null },
  { id: "p4", name: "Glam Absolut Repair", price: 159.99, category: "skincare", badge: "NEW", badgeType: "new", description: "Tratamento de reparação e cuidado.", image: null },
  { id: "p5", name: "Glam Hi Repair", price: 179.99, category: "skincare", badge: "NEW", badgeType: "new", description: "Reconstrução e reparação para fios sensibilizados.", image: null },
  { id: "p6", name: "Glam CPR SOS", price: 265, category: "skincare", badge: "AVALIAÇÃO", badgeType: "kit", description: "Protocolo SOS mediante avaliação profissional.", image: null },
  { id: "p7", name: "Glam Platinum Repair", price: 275.9, category: "skincare", badge: "MAIS VENDIDO", badgeType: "kit", description: "Experiência premium de reparação.", image: null },
  { id: "p8", name: "Glam Hair Experience", price: 285.99, category: "skincare", badge: "KIT ANIVER", badgeType: "kit", description: "Experiência completa de cuidado capilar.", image: null },
  { id: "p9", name: "Kit Aniversário Glam", price: 199.9, category: "kits", badge: "KIT ANIVER", badgeType: "kit", description: "Seleção especial para presentear alguém.", image: null },
  { id: "p10", name: "Experiência Glam — Kit Misto", price: 299.9, category: "kits", badge: "KIT ANIVER", badgeType: "kit", description: "Produto + experiência estética em um único presente.", image: null },
  { id: "p11", name: "Kit Dia de Beleza", price: 349.9, category: "kits", badge: "MAIS VENDIDO", badgeType: "kit", description: "Uma experiência de autocuidado para celebrar.", image: null },
  { id: "p12", name: "Perfume Glam", price: 189.9, category: "perfumaria", badge: "NEW", badgeType: "new", description: "Fragrância para acompanhar seus melhores momentos.", image: null },
  { id: "p13", name: "Bolsa Glam", price: 219.9, category: "bolsas", badge: "NEW", badgeType: "new", description: "Modelo selecionado para compor seu look.", image: null },
  { id: "p14", name: "Acessório Glam", price: 59.9, category: "acessorios", badge: "NEW", badgeType: "new", description: "Detalhe delicado para completar sua produção.", image: null },
  { id: "p15", name: "Look Glam", price: 169.9, category: "roupas", badge: "NEW", badgeType: "new", description: "Peça selecionada para um visual sofisticado.", image: null },
  { id: "p16", name: "Kit Presente Skincare", price: 159.9, category: "kits", badge: "KIT ANIVER", badgeType: "kit", description: "Cuidados para uma rotina de beleza especial.", image: null },
];

export const services: CatalogService[] = [
  { id: "s1", name: "Hidratação + Escova", price: 89.9, description: "Cuidado e finalização para um cabelo macio e bonito." },
  { id: "s2", name: "Reconstrução + Escova", price: 139, description: "Reconstrução com finalização. Consulte disponibilidade do brinde promocional." },
  { id: "s3", name: "Glow Facial Premium Express", price: 145, description: "Protocolo facial com foco em luminosidade e viço." },
  { id: "s4", name: "Limpeza de Pele", price: 135, description: "Higienização e cuidado facial conforme avaliação." },
  { id: "s5", name: "Drenagem Linfática", price: 120, description: "Sessão de cuidado corporal." },
  { id: "s6", name: "Massagem Relaxante", price: 120, description: "Momento de relaxamento e bem-estar." },
  { id: "s7", name: "Microagulhamento Facial", price: null, description: "Valor mediante avaliação e indicação profissional." },
  { id: "s8", name: "Protocolo Papada sem Agulhas", price: null, description: "Avaliação necessária para definir protocolo." },
];
