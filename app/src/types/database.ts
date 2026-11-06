export type AppRole = "admin" | "staff" | "customer";

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

export interface DbCategory {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export interface DbProduct {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string | null;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
}

export interface DbService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
}
