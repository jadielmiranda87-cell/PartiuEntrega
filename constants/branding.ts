import Constants from 'expo-constants';

export type AppVariant = 'client' | 'business' | 'motoboy';

const raw = (process.env.EXPO_PUBLIC_APP_VARIANT || 'client').toLowerCase();

/** `all` = modo desenvolvimento: um único build mostra os 3 cadastros (não use em loja). */
export const APP_VARIANT_ALL_MODE = raw === 'all';

export const APP_VARIANT: AppVariant | 'all' = APP_VARIANT_ALL_MODE
  ? 'all'
  : raw === 'business' || raw === 'motoboy' || raw === 'client'
    ? (raw as AppVariant)
    : 'client';

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

/** Conta permitida neste APK (cada loja: app só cliente, só comércio ou só entregador). Admin continua liberado em qualquer build. */
export function isUserTypeAllowedInAppVariant(userType: string | null | undefined): boolean {
  if (!userType) return true;
  if (APP_VARIANT === 'all') return true;
  if (userType === 'admin') return true;
  if (APP_VARIANT === 'client') return userType === 'customer';
  if (APP_VARIANT === 'business') return userType === 'business';
  if (APP_VARIANT === 'motoboy') return userType === 'motoboy';
  return true;
}

export const LOGIN_TAGLINE: Record<AppVariant | 'all', string> = {
  client: 'Peça em comércios cadastrados — entrega na porta',
  business: 'Receba pedidos e gerencie entregas no seu estabelecimento',
  motoboy: 'Corridas pagas — aceite entregas perto de você',
  all: 'Pedidos rápidos entre comércios e entregadores',
};
