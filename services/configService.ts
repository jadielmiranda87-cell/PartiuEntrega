import { getSupabaseClient } from '@/template';
import { AppConfig } from '@/types';

export async function getAppConfig(): Promise<AppConfig> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.from('app_config').select('key, value');
  const config: AppConfig = {
    subscription_price: '99.90',
    price_per_km: '2.50',
    min_delivery_price: '8.00',
    cashback_per_business_referral: '20.00',
    cashback_per_motoboy_referral: '30.00',
    accept_cooldown_minutes: '30',
    refuse_cooldown_rules: '[{"count":1,"minutes":15},{"count":2,"minutes":60},{"count":3,"minutes":360}]',
    contact_whatsapp_phone: '',
  };
  if (data) {
    data.forEach((row: { key: string; value: string }) => {
      if (row.key in config) {
        (config as Record<string, string>)[row.key] = row.value;
      }
    });
  }
  return config;
}

export async function updateAppConfig(key: string, value: string): Promise<{ error: string | null }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('app_config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return { error: error ? error.message : null };
}
