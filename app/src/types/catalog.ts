export type ProductCategory =
  | "skincare"
  | "kits"
  | "perfumaria"
  | "bolsas"
  | "acessorios"
  | "roupas";

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  category: ProductCategory;
  badge: string;
  badgeType: "new" | "kit";
  description: string;
  image: string | null;
}

export interface CatalogService {
  id: string;
  name: string;
  price: number | null;
  description: string;
}
