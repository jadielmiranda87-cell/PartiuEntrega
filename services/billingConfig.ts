import { DEFAULT_BILLING_CONFIG } from '@/constants/billingDefaults';
import { getAppConfig } from '@/services/configService';
import type { BillingConfig } from '@/types';

export { DEFAULT_BILLING_CONFIG } from '@/constants/billingDefaults';

export function parseBillingConfig(raw: string | undefined | null): BillingConfig {
  if (!raw?.trim()) return { ...DEFAULT_BILLING_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<BillingConfig>;
    return {
      ...DEFAULT_BILLING_CONFIG,
      ...parsed,
      plan_basic: { ...DEFAULT_BILLING_CONFIG.plan_basic, ...parsed.plan_basic },
      plan_delivery: { ...DEFAULT_BILLING_CONFIG.plan_delivery, ...parsed.plan_delivery },
    };
  } catch {
    return { ...DEFAULT_BILLING_CONFIG };
  }
}

export async function getBillingConfig(): Promise<BillingConfig> {
  const c = await getAppConfig();
  return parseBillingConfig(c.billing_config);
}
