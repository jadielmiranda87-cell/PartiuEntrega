import type { BillingConfig, BusinessBillingPlan, Delivery } from '@/types';
import { DEFAULT_BILLING_CONFIG } from '@/constants/billingDefaults';

export type SalesSettlementRow = {
  deliveryId: string;
  businessName: string;
  billingPlan: BusinessBillingPlan;
  planLabel: string;
  orderSource: 'manual' | 'app';
  paidOnline: boolean;
  status: Delivery['status'];
  gross: number;
  /** Base da comissão % (subtotal itens no app, ou valor total). */
  commissionBase: number;
  commissionPct: number;
  commissionAmount: number;
  serviceFee: number;
  /** Estimativa gateway (Mercado Pago) — só pedidos app pagos online. */
  mpFeeEstimate: number;
  /** Retenção da plataforma: comissão + taxa fixa por pedido app. */
  appShare: number;
  /** Estimativa do que sobra para o comércio após app e taxa gateway. */
  merchantNet: number;
  createdAt: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseBillingConfig(json: string | null | undefined): BillingConfig {
  if (!json?.trim()) return DEFAULT_BILLING_CONFIG;
  try {
    const p = JSON.parse(json) as Partial<BillingConfig>;
    if (p?.plan_basic && p?.plan_delivery) {
      return {
        ...DEFAULT_BILLING_CONFIG,
        ...p,
        plan_basic: { ...DEFAULT_BILLING_CONFIG.plan_basic, ...p.plan_basic },
        plan_delivery: { ...DEFAULT_BILLING_CONFIG.plan_delivery, ...p.plan_delivery },
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_BILLING_CONFIG;
}

/**
 * Calcula bruto, retenção do app, taxa gateway estimada e líquido do comércio
 * conforme `billing_plan` do comércio e `billing_config` global (admin).
 */
export function settlementForDelivery(d: Delivery, billing: BillingConfig): SalesSettlementRow | null {
  if (d.status === 'cancelled') return null;

  const gross = Number(d.price);
  if (!Number.isFinite(gross) || gross <= 0) return null;

  const biz = d.businesses as { name?: string; billing_plan?: BusinessBillingPlan } | undefined;
  const billingPlan: BusinessBillingPlan = biz?.billing_plan === 'delivery' ? 'delivery' : 'basic';
  const plan = billingPlan === 'delivery' ? billing.plan_delivery : billing.plan_basic;

  const paidOnline = d.order_source === 'app' && d.payment_status === 'paid';
  const sub = d.order_subtotal != null ? Number(d.order_subtotal) : 0;
  const commissionBase =
    d.order_source === 'app' && Number.isFinite(sub) && sub > 0 ? sub : gross;

  const commissionAmount = round2((commissionBase * plan.commission_percent) / 100);
  const feeAvg = (plan.payment_fee_percent_min + plan.payment_fee_percent_max) / 2;
  const mpFeeEstimate =
    paidOnline && Number.isFinite(feeAvg) ? round2((gross * feeAvg) / 100) : 0;
  const serviceFee =
    d.order_source === 'app' ? round2(Number(billing.service_fee_per_order) || 0) : 0;
  const appShare = round2(commissionAmount + serviceFee);
  const merchantNet = round2(gross - appShare - mpFeeEstimate);

  return {
    deliveryId: d.id,
    businessName: biz?.name ?? '—',
    billingPlan,
    planLabel: plan.label,
    orderSource: d.order_source ?? 'manual',
    paidOnline,
    status: d.status,
    gross,
    commissionBase,
    commissionPct: plan.commission_percent,
    commissionAmount,
    serviceFee,
    mpFeeEstimate,
    appShare,
    merchantNet,
    createdAt: d.created_at,
  };
}

export type SalesTotals = {
  count: number;
  gross: number;
  merchantNet: number;
  appShare: number;
  mpFeeEstimate: number;
  commissionAmount: number;
  serviceFee: number;
};

export function sumSettlements(rows: SalesSettlementRow[]): SalesTotals {
  return rows.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      gross: round2(acc.gross + r.gross),
      merchantNet: round2(acc.merchantNet + r.merchantNet),
      appShare: round2(acc.appShare + r.appShare),
      mpFeeEstimate: round2(acc.mpFeeEstimate + r.mpFeeEstimate),
      commissionAmount: round2(acc.commissionAmount + r.commissionAmount),
      serviceFee: round2(acc.serviceFee + r.serviceFee),
    }),
    {
      count: 0,
      gross: 0,
      merchantNet: 0,
      appShare: 0,
      mpFeeEstimate: 0,
      commissionAmount: 0,
      serviceFee: 0,
    }
  );
}
