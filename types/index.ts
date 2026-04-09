export type UserType = 'business' | 'motoboy' | 'admin' | 'customer';

export interface UserProfile {
  id: string;
  username?: string;
  email: string;
  user_type: UserType;
  phone?: string;
}

/** Plano de cobrança do comércio (valores exibidos vêm de `billing_config` no admin). */
export type BusinessBillingPlan = 'basic' | 'delivery';

/** Dias da semana (chaves em `opening_hours`). `sun` = domingo. */
export type DayCode = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface DaySchedule {
  closed: boolean;
  /** "HH:mm" */
  open: string;
  /** "HH:mm" */
  close: string;
}

/** Horários cadastrados pelo comércio (JSON em `businesses.opening_hours`). */
export type WeeklyOpeningHours = Partial<Record<DayCode, DaySchedule>>;

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
  /** Plano contratado: entrega própria ou uso dos entregadores da plataforma. */
  billing_plan?: BusinessBillingPlan;
  /**
   * Chave/token API do gateway de pagamento do estabelecimento (ex.: Mercado Pago)
   * para repasses após retenção da plataforma. Tratar como dado sensível no backend.
   */
  payment_api_key?: string | null;
  /** Horário de funcionamento (opcional). Se vazio, o app trata como “sempre aberto”. */
  opening_hours?: WeeklyOpeningHours | null;
}

/** Plano configurável no painel admin (JSON em app_config.billing_config). */
export interface BillingPlanConfig {
  label: string;
  commission_percent: number;
  payment_fee_percent_min: number;
  payment_fee_percent_max: number;
  monthly_revenue_threshold: number;
  monthly_fee_min?: number;
  monthly_fee_max?: number;
  /** Plano entrega: mensalidade fixa quando fatura acima do limiar. */
  monthly_fee_fixed?: number;
}

export interface BillingConfig {
  plan_basic: BillingPlanConfig;
  plan_delivery: BillingPlanConfig;
  service_fee_per_order: number;
  delivery_fee_description: string;
  extra_fees_note: string;
  summary_own_delivery_range: string;
  summary_platform_delivery_range: string;
  payment_flow_description: string;
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

/** Item do pedido (cardápio) — persistido em `deliveries.order_items` (jsonb). */
export interface OrderItemLine {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

/** Pagamento online do pedido (app cliente — Mercado Pago). */
export type DeliveryPaymentStatus =
  | 'n/a'
  | 'awaiting_payment'
  | 'processing'
  | 'paid'
  | 'failed';

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
  /** Total cobrado (itens + taxa de entrega, quando aplicável). */
  price: number;
  status: 'pending' | 'assigned' | 'collected' | 'delivered' | 'cancelled';
  notes?: string;
  created_at: string;
  assigned_at?: string;
  collected_at?: string;
  delivered_at?: string;
  /** Conta do cliente que pediu pelo app (opcional). */
  customer_user_id?: string | null;
  /** Soma dos itens do cardápio antes da entrega. */
  order_subtotal?: number | null;
  order_items?: OrderItemLine[] | null;
  order_source?: 'manual' | 'app';
  payment_status?: DeliveryPaymentStatus | string;
  mp_payment_id?: string | null;
  mp_preference_id?: string | null;
  payment_method_label?: string | null;
  businesses?: Business;
  motoboys?: Motoboy;
}

/** Cartão salvo (referência Mercado Pago — sem dados sensíveis). */
export interface CustomerMpCard {
  id: string;
  user_id: string;
  mercadopago_customer_id?: string | null;
  mercadopago_card_id: string;
  last_four_digits?: string | null;
  payment_method_id?: string | null;
  cardholder_name?: string | null;
  created_at: string;
}

export interface ProductCategory {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface AppConfig {
  subscription_price: string;
  price_per_km: string;
  min_delivery_price: string;
  cashback_per_business_referral: string;
  cashback_per_motoboy_referral: string;
  accept_cooldown_minutes: string;
  refuse_cooldown_rules: string;
  contact_whatsapp_phone: string;
  /** JSON string — planos de cobrança dos comércios (admin). */
  billing_config: string;
}
