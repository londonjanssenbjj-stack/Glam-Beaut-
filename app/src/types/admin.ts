export interface AdminProduct {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
}

export interface AdminService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
}

export interface AdminOrder {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number;
  delivery_method: string;
  created_at: string;
}

export interface AdminAppointment {
  id: string;
  service_name: string;
  starts_at: string;
  status: string;
  customer_id: string;
}

export interface AdminProfile {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}
export interface AdminInventoryItem {
  variant_id: string;
  quantity: number;
  updated_at: string;
  product_variants: { id: string; name: string; sku: string | null; product_id: string; products: { name: string } | null } | null;
}
