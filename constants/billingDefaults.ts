import type { BillingConfig } from '@/types';

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  plan_basic: {
    label: 'Plano Básico (Entrega própria)',
    commission_percent: 12,
    payment_fee_percent_min: 3.2,
    payment_fee_percent_max: 3.5,
    monthly_revenue_threshold: 1800,
    monthly_fee_min: 110,
    monthly_fee_max: 130,
  },
  plan_delivery: {
    label: 'Plano Entrega (Motoboys da plataforma)',
    commission_percent: 23,
    payment_fee_percent_min: 3.2,
    payment_fee_percent_max: 3.5,
    monthly_revenue_threshold: 1800,
    monthly_fee_fixed: 150,
  },
  service_fee_per_order: 0.99,
  delivery_fee_description:
    'Valor variável conforme distância; pode ser pago pelo cliente ou repassado ao estabelecimento.',
  extra_fees_note: 'Podem existir taxas para antecipação de recebíveis, campanhas de marketing, etc.',
  summary_own_delivery_range: '15–16',
  summary_platform_delivery_range: '26–27',
  payment_flow_description:
    'Os pagamentos dos pedidos são creditados primeiro na conta da plataforma FastFood. A plataforma retém comissões e taxas configuradas; o saldo restante é repassado ao comércio conforme o cronograma acordado. Cada comércio informa a própria chave API do gateway para habilitar repasses.',
};

export const DEFAULT_BILLING_JSON = JSON.stringify(DEFAULT_BILLING_CONFIG);
