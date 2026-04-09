import Constants from 'expo-constants';

export type AppVariant = 'client' | 'business' | 'motoboy';

const raw = (process.env.EXPO_PUBLIC_APP_VARIANT || 'client').toLowerCase();
export const APP_VARIANT: AppVariant =
  raw === 'business' || raw === 'motoboy' || raw === 'client' ? (raw as AppVariant) : 'client';

/** Nome exibido na loja (vem do app.config por variante de build). */
export const APP_DISPLAY_NAME = Constants.expoConfig?.name ?? 'FastFood';

/** Nome curto em mensagens (WhatsApp, etc.). */
export const APP_SHORT_NAME = 'FastFood';

/** Prefixo AsyncStorage / chaves locais. */
export const STORAGE_PREFIX = '@FastFood:';

export function storageKey(suffix: string): string {
  return `${STORAGE_PREFIX}${suffix}`;
}
