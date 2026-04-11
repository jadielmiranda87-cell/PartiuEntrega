import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors } from '@/constants/theme';

export default function RootIndex() {
  const { userId, userType, motoboyProfile, loading, sessionKicked, refreshProfile, signOut } = useAppAuth();
  const router = useRouter();

  // Handle session kicked (another device logged in)
  useEffect(() => {
    if (sessionKicked) {
      Alert.alert(
        'Sessão encerrada',
        'Sua conta foi acessada em outro dispositivo. Faça login novamente.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    }
  }, [sessionKicked]);

  useEffect(() => {
    if (loading) return;
    if (sessionKicked) return; // handled above

    if (!userId) {
      router.replace('/login');
      return;
    }

    // userId is known but userType is not. Avoid infinite loading by retrying
    // profile fetch, then falling back to login if still unresolved.
    if (!userType) {
      const t = setTimeout(async () => {
        try {
          await refreshProfile();
        } catch {
          // ignore
        }
      }, 1200);

      const hard = setTimeout(async () => {
        // Still no userType after retry: reset session to avoid stuck spinner
        try {
          await signOut();
        } catch {
          // ignore
        }
        router.replace('/login');
      }, 8000);

      return () => {
        clearTimeout(t);
        clearTimeout(hard);
      };
    }

    if (userType === 'admin') {
      router.replace('/(admin)');
      return;
    }

    if (userType === 'business') {
      router.replace('/(business)');
      return;
    }

    if (userType === 'customer') {
      router.replace('/(customer)');
      return;
    }

    if (userType === 'motoboy') {
      if (!motoboyProfile) {
        router.replace('/login');
        return;
      }
      if (motoboyProfile.status === 'pending_payment') {
        router.replace('/payment');
        return;
      }
      if (motoboyProfile.status === 'pending_approval') {
        router.replace('/pending-approval');
        return;
      }
      const isExpiredByDate =
        motoboyProfile.subscription_expires_at
          ? new Date(motoboyProfile.subscription_expires_at) < new Date()
          : false;
      if (motoboyProfile.status === 'expired' || (motoboyProfile.status === 'active' && isExpiredByDate)) {
        router.replace('/renew-subscription');
        return;
      }
      router.replace('/(motoboy)');
      return;
    }

    router.replace('/login');
  }, [loading, userId, userType, motoboyProfile, sessionKicked, refreshProfile, signOut]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
