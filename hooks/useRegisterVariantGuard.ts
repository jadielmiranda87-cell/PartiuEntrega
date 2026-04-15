import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import type { UserType } from '@/types';

/**
 * Redirects authenticated users away from registration screens.
 * If a user is already logged in, they are sent to their respective home tab.
 */
export function useRegisterVariantGuard(_variant: UserType) {
  const { userId, userType, loading: authLoading } = useAppAuth();
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;
    if (!userId) return;

    // Already authenticated — redirect to the appropriate home
    const dest =
      userType === 'admin' ? '/(admin)' :
      userType === 'motoboy' ? '/(motoboy)' :
      userType === 'business' ? '/(business)' :
      userType === 'customer' ? '/(customer)' :
      '/';

    router.replace(dest as any);
  }, [authLoading, userId, userType, router]);
}
