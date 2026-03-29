import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWhatsApp } from '@/utils/links';
import { useRouter } from 'expo-router';

export default function BusinessProfileScreen() {
  const { businessProfile, profile, signOut, loading: authLoading, refreshProfile } = useAppAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  if (authLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12 }}>Carregando perfil...</Text>
      </View>
    );
  }

  if (!businessProfile) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg }}>
        <MaterialIcons name="store" size={48} color={Colors.textMuted} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12, fontSize: FontSize.md, textAlign: 'center' }}>Perfil do comércio não encontrado</Text>
        <Text style={{ color: Colors.textMuted, marginTop: 6, fontSize: FontSize.sm, textAlign: 'center' }}>Tente recarregar ou sair e entrar novamente.</Text>
        <TouchableOpacity
          onPress={() => refreshProfile()}
          style={{ marginTop: 20, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingHorizontal: 24, paddingVertical: 12 }}
        >
          <Text style={{ color: Colors.white, fontWeight: '600' }}>Recarregar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.error, fontSize: FontSize.sm }}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Perfil</Text>

      <View style={styles.avatarCard}>
        <View style={styles.avatar}>
          <MaterialIcons name="store" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.bizName}>{businessProfile.name}</Text>
        <Text style={styles.bizEmail}>{profile?.email}</Text>
      </View>

      <View style={styles.section}>
        <InfoRow label="Telefone" value={businessProfile.phone} />
        {businessProfile.cnpj ? <InfoRow label="CNPJ" value={businessProfile.cnpj} /> : null}
        <InfoRow label="Endereço" value={`${businessProfile.address}, ${businessProfile.address_number}`} />
        {businessProfile.complement ? <InfoRow label="Complemento" value={businessProfile.complement} /> : null}
        <InfoRow label="Bairro" value={businessProfile.neighborhood} />
        <InfoRow label="Cidade" value={`${businessProfile.city} - ${businessProfile.state}`} />
        <InfoRow label="CEP" value={businessProfile.cep} />
      </View>

      <TouchableOpacity
        style={styles.whatsappBtn}
        onPress={() => openWhatsApp(businessProfile.phone, 'Olá, sou do PartiuEntrega!')}
        activeOpacity={0.8}
      >
        <MaterialIcons name="chat" size={20} color={Colors.white} />
        <Text style={styles.whatsappBtnText}>Abrir WhatsApp</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <MaterialIcons name="logout" size={20} color={Colors.error} />
        <Text style={styles.logoutBtnText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  value: { fontSize: FontSize.sm, color: Colors.text, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  avatarCard: { alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, marginBottom: Spacing.md },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  bizName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  bizEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  whatsappBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  whatsappBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  logoutBtn: {
    flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  logoutBtnText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.md },
});
