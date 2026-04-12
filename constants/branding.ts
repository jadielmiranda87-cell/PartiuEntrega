import Constants from 'expo-constants';

export type AppVariant = 'client' | 'business' | 'motoboy';

const raw = (process.env.EXPO_PUBLIC_APP_VARIANT || 'client').toLowerCase();
export const APP_VARIANT: AppVariant =
  raw === 'business' || raw === 'motoboy' || raw === 'client' ? (raw as AppVariant) : 'client';

/**
 * Nome do app neste build (vem do `app.config.js` por variante).
 * Cliente: FastFud · Comércio: FastFood Comércio · Entregador: FastFood Entregador
 */
export const APP_DISPLAY_NAME = Constants.expoConfig?.name ?? 'FastFud';

/**
 * Nome curto em mensagens (WhatsApp, compartilhar, etc.).
 * No app entregador usamos "FastFood" em frases como "sou entregador do FastFood".
 */
export function getAppShortName(): string {
  if (APP_VARIANT === 'business') return 'FastFood Comércio';
  if (APP_VARIANT === 'motoboy') return 'FastFood';
  return 'FastFud';
}

export const APP_SHORT_NAME = getAppShortName();

/** Prefixo AsyncStorage / chaves locais (inalterado para não invalidar sessões). */
export const STORAGE_PREFIX = '@FastFood:';

export function storageKey(suffix: string): string {
  return `${STORAGE_PREFIX}${suffix}`;
}
