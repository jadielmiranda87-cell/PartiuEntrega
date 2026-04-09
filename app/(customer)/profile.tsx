import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomerProfileScreen() {
  const { profile, signOut } = useAppAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ paddingTop: Spacing.lg, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
    >
      <View style={styles.card}>
        <MaterialIcons name="person" size={40} color={Colors.primary} />
        <Text style={styles.name}>{profile?.username ?? 'Cliente'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        {profile?.phone ? <Text style={styles.phone}>{profile.phone}</Text> : null}
      </View>

      <TouchableOpacity style={styles.row} onPress={() => router.push('/(customer)/orders')} activeOpacity={0.85}>
        <MaterialIcons name="receipt-long" size={22} color={Colors.text} />
        <Text style={styles.rowText}>Meus pedidos</Text>
        <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => router.push('/(customer)/saved-cards')} activeOpacity={0.85}>
        <MaterialIcons name="credit-card" size={22} color={Colors.text} />
        <Text style={styles.rowText}>Cartões salvos</Text>
        <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.85}>
        <MaterialIcons name="logout" size={22} color={Colors.error} />
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl,
    alignItems: 'center', marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  name: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginTop: Spacing.sm },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  phone: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  rowText: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.lg, paddingVertical: Spacing.md,
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.md },
});
