import type { BillingConfig, Delivery } from '@/types';
import { DEFAULT_BILLING_CONFIG } from '@/constants/billingDefaults';

export { parseBillingConfig } from '@/services/billingConfig';

export interface SalesSettlementRow {
  deliveryId: string;
  businessId: string;
  businessName: string;
  /** Total cobrado do cliente (price). */
  gross: number;
  /** Comissão retida pelo app. */
  commissionAmount: number;
  /** Taxa fixa por pedido (só pedidos via app). */
  serviceFee: number;
  /** Estimativa de taxa do gateway (MP) — só pagamentos online. */
  mpFeeEstimate: number;
  /** Total retido pelo app (comissão + taxa pedido). */
  appShare: number;
  /** Estimativa de líquido do comércio (gross - appShare - mpFeeEstimate). */
  merchantNet: number;
  /** Pedido veio do app e está com pagamento confirmado. */
  paidOnline: boolean;
}

export interface SettlementTotals {
  count: number;
  gross: number;
  commissionAmount: number;
  serviceFee: number;
  mpFeeEstimate: number;
  appShare: number;
  merchantNet: number;
}

/**
 * Calcula o repasse/retenção de uma entrega com base no plano de cobrança do comércio.
 * Retorna `null` para entregas canceladas ou sem valor.
 */
export function settlementForDelivery(
  delivery: Delivery,
  billing: BillingConfig
): SalesSettlementRow | null {
  if (delivery.status === 'cancelled') return null;
  const gross = Number(delivery.price) || 0;
  if (gross <= 0) return null;

  const plan =
    delivery.businesses?.billing_plan === 'delivery'
      ? billing.plan_delivery
      : billing.plan_basic;

  // Base de cálculo da comissão: subtotal do pedido (itens) se disponível, senão o total.
  const commissionBase =
    delivery.order_subtotal != null && delivery.order_subtotal > 0
      ? Number(delivery.order_subtotal)
      : gross;

  const commissionAmount = (commissionBase * plan.commission_percent) / 100;

  // Taxa de serviço por pedido — só pedidos via app
  const isApp = delivery.order_source === 'app';
  const serviceFee = isApp ? (billing.service_fee_per_order ?? 0) : 0;

  const appShare = commissionAmount + serviceFee;

  // Taxa de gateway (MP) estimada — apenas pedidos app com pagamento online confirmado
  const paidOnline = isApp && delivery.payment_status === 'paid';
  const avgFeePercent =
    (plan.payment_fee_percent_min + plan.payment_fee_percent_max) / 2;
  const mpFeeEstimate = paidOnline ? (gross * avgFeePercent) / 100 : 0;

  const merchantNet = Math.max(0, gross - appShare - mpFeeEstimate);

  const businessName = delivery.businesses?.name ?? delivery.business_id;

  return {
    deliveryId: delivery.id,
    businessId: delivery.business_id,
    businessName,
    gross,
    commissionAmount,
    serviceFee,
    mpFeeEstimate,
    appShare,
    merchantNet,
    paidOnline,
  };
}

/** Agrega totais de um array de linhas de liquidação. */
export function sumSettlements(rows: SalesSettlementRow[]): SettlementTotals {
  return rows.reduce<SettlementTotals>(
    (acc, r) => ({
      count: acc.count + 1,
      gross: acc.gross + r.gross,
      commissionAmount: acc.commissionAmount + r.commissionAmount,
      serviceFee: acc.serviceFee + r.serviceFee,
      mpFeeEstimate: acc.mpFeeEstimate + r.mpFeeEstimate,
      appShare: acc.appShare + r.appShare,
      merchantNet: acc.merchantNet + r.merchantNet,
    }),
    {
      count: 0,
      gross: 0,
      commissionAmount: 0,
      serviceFee: 0,
      mpFeeEstimate: 0,
      appShare: 0,
      merchantNet: 0,
    }
  );
}
