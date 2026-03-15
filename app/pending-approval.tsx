import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function PendingApprovalScreen() {
  const [loading, setLoading] = useState(false);
  const { refreshProfile, signOut } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleRefresh = async () => {
    setLoading(true);
    await refreshProfile();
    setLoading(false);
    router.replace('/');
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout}>
          <MaterialIcons name="logout" size={22} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="hourglass-top" size={64} color={Colors.warning} />
        </View>

        <Text style={styles.title}>Aguardando Aprovação</Text>
        <Text style={styles.subtitle}>
          Seu pagamento foi confirmado! O administrador está verificando seus dados cadastrais.
          Você receberá acesso às corridas em breve.
        </Text>

        <View style={styles.stepsCard}>
          <StepItem icon="check-circle" color={Colors.success} text="Cadastro realizado" done />
          <StepItem icon="check-circle" color={Colors.success} text="Pagamento confirmado" done />
          <StepItem icon="hourglass-top" color={Colors.warning} text="Verificação pelo ADM" active />
          <StepItem icon="radio-button-unchecked" color={Colors.textMuted} text="Acesso liberado" />
        </View>

        <TouchableOpacity
          style={[styles.refreshBtn, loading && styles.btnDisabled]}
          onPress={handleRefresh}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <>
              <MaterialIcons name="refresh" size={20} color={Colors.white} />
              <Text style={styles.refreshBtnText}>Verificar status</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StepItem({ icon, color, text, done, active }: { icon: string; color: string; text: string; done?: boolean; active?: boolean }) {
  return (
    <View style={stepStyles.row}>
      <MaterialIcons name={icon as any} size={22} color={color} />
      <Text style={[stepStyles.text, done ? stepStyles.textDone : active ? stepStyles.textActive : stepStyles.textMuted]}>
        {text}
      </Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  text: { fontSize: FontSize.md },
  textDone: { color: Colors.success },
  textActive: { color: Colors.warning, fontWeight: '600' },
  textMuted: { color: Colors.textMuted },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, alignItems: 'flex-end' },
  content: { flex: 1, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  iconContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.lg },
  stepsCard: {
    width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  refreshBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md, height: 54, alignItems: 'center', justifyContent: 'center',
    width: '100%',
  },
  btnDisabled: { opacity: 0.6 },
  refreshBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
