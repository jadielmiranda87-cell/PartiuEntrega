export type UserType = 'business' | 'motoboy' | 'admin';

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  user_type: UserType;
  phone?: string;
}

export interface Business {
  id: string;
  user_id: string;
  name: string;
  cnpj?: string;
  phone: string;
  address: string;
  address_number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  created_at: string;
}

export type VerificationStatus =
  | 'pending_documents'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface Motoboy {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string;
  cpf: string;
  cnh_number: string;
  cnh_category: string;
  cnh_type?: 'physical' | 'digital';
  cnh_front_url?: string;
  cnh_back_url?: string;
  cnh_pdf_url?: string;
  selfie_url?: string;
  verification_status?: VerificationStatus;
  rejection_reason?: string;
  lgpd_consent?: boolean;
  lgpd_consent_at?: string;
  delete_requested?: boolean;
  delete_requested_at?: string;
  moto_brand: string;
  moto_model: string;
  moto_plate: string;
  moto_year: string;
  city: string;
  state: string;
  status: 'pending_payment' | 'pending_approval' | 'active' | 'suspended';
  subscription_expires_at?: string;
  is_first_subscription: boolean;
  referral_code?: string;
  cashback_balance: number;
  referred_by_motoboy_id?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  motoboy_id: string;
  payment_id?: string;
  payment_status: 'pending' | 'approved' | 'rejected';
  amount: number;
  expires_at?: string;
  is_first_subscription: boolean;
  admin_approved: boolean;
  created_at: string;
}

export interface Delivery {
  id: string;
  business_id: string;
  motoboy_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_address_number: string;
  customer_complement?: string;
  customer_neighborhood: string;
  customer_city: string;
  customer_state: string;
  customer_cep: string;
  distance_km: number;
  price: number;
  status: 'pending' | 'assigned' | 'collected' | 'delivered' | 'cancelled';
  notes?: string;
  created_at: string;
  assigned_at?: string;
  collected_at?: string;
  delivered_at?: string;
  businesses?: Business;
  motoboys?: Motoboy;
}

export interface AppConfig {
  subscription_price: string;
  price_per_km: string;
  min_delivery_price: string;
  cashback_per_business_referral: string;
  cashback_per_motoboy_referral: string;
  accept_cooldown_minutes: string;
  refuse_cooldown_rules: string;
}
