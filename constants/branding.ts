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

/** Nome exibido na loja (vem do app.config por variante de build). */
export const APP_DISPLAY_NAME = Constants.expoConfig?.name ?? 'FastFood';

/** Nome curto em mensagens (WhatsApp, etc.). */
export const APP_SHORT_NAME = 'FastFood';

/** Prefixo AsyncStorage / chaves locais. */
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
