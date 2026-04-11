import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { APP_VARIANT, type AppVariant } from '@/constants/branding';

/** Só permite a tela de cadastro se o build for da mesma variante (ou modo `all`). */
export function useRegisterVariantGuard(expected: AppVariant) {
  const router = useRouter();

  useEffect(() => {
    if (APP_VARIANT === 'all') return;
    if (APP_VARIANT !== expected) {
      router.replace('/login');
    }
  }, [expected, router]);
}
