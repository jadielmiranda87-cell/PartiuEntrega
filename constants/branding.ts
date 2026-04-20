import Constants from 'expo-constants';
import type { UserType } from '@/types';

export type AppVariant = 'client' | 'business' | 'motoboy';

const raw = (process.env.EXPO_PUBLIC_APP_VARIANT || 'client').toLowerCase();
export const APP_VARIANT: AppVariant =
  raw === 'business' || raw === 'motoboy' || raw === 'client' ? (raw as AppVariant) : 'client';

/**
 * Nome do app neste build (vem do `app.config.js` por variante).
 * Cliente: fass · Comércio: FastFood Comércio · Entregador: FastFood Entregador
 */
export const APP_DISPLAY_NAME = Constants.expoConfig?.name ?? 'fass';

/**
 * Nome curto em mensagens (WhatsApp, compartilhar, etc.).
 * No app entregador usamos "FastFood" em frases como "sou entregador do FastFood".
 */
export function getAppShortName(): string {
  if (APP_VARIANT === 'business') return 'FastFood Comércio';
  if (APP_VARIANT === 'motoboy') return 'FastFood';
  return 'fass';
}

export const APP_SHORT_NAME = getAppShortName();

/**
 * Perfil da conta permitido neste APK (EXPO_PUBLIC_APP_VARIANT).
 * `userType` ausente = ainda carregando perfil → true (evita travar antes do retry em app/index).
 */
export function isUserTypeAllowedInAppVariant(userType: UserType | null | undefined): boolean {
  if (userType == null) return true;
  if (userType === 'admin') return true;
  if (APP_VARIANT === 'client') return userType === 'customer';
  if (APP_VARIANT === 'business') return userType === 'business';
  if (APP_VARIANT === 'motoboy') return userType === 'motoboy';
  return true;
}

/** Prefixo AsyncStorage / chaves locais (inalterado para não invalidar sessões). */
export const STORAGE_PREFIX = '@FastFood:';

export function storageKey(suffix: string): string {
  return `${STORAGE_PREFIX}${suffix}`;
}
