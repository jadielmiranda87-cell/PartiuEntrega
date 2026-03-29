import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors } from '@/constants/theme';

export default function RootIndex() {
  const { userId, userType, motoboyProfile, loading, sessionKicked } = useAppAuth();
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

    // Wait until userType is resolved
    if (!userType) return;

    if (userType === 'admin') {
      router.replace('/(admin)');
      return;
    }

    if (userType === 'business') {
      router.replace('/(business)');
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
  }, [loading, userId, userType, motoboyProfile, sessionKicked]);

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
