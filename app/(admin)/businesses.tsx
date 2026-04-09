import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { getAllBusinesses } from '@/services/businessService';
import { Business } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openWhatsApp, formatDate } from '@/utils/links';

export default function AdminBusinessesScreen() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const loadData = useCallback(async () => {
    const data = await getAllBusinesses();
    setBusinesses(data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.pageTitle}>Comércios ({businesses.length})</Text>

      <FlatList
        data={businesses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 16, gap: Spacing.sm }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="store" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum comércio cadastrado</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = expanded === item.id;
          return (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => setExpanded(isExpanded ? null : item.id)} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bizName}>{item.name}</Text>
                    <Text style={styles.bizDetails}>{item.address}, {item.address_number} — {item.neighborhood}</Text>
                    <Text style={styles.bizDetails}>{item.city} - {item.state}</Text>
                  </View>
                  <MaterialIcons name={isExpanded ? 'expand-less' : 'expand-more'} size={24} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.expandedSection}>
                  {item.cnpj ? <InfoRow label="CNPJ" value={item.cnpj} /> : null}
                  <InfoRow label="Telefone" value={item.phone} />
                  <InfoRow label="CEP" value={item.cep} />
                  {item.complement ? <InfoRow label="Complemento" value={item.complement} /> : null}
                  <InfoRow label="Cadastro" value={formatDate(item.created_at)} />

                  <TouchableOpacity
                    style={styles.whatsappBtn}
                    onPress={() => openWhatsApp(item.phone, 'Olá! Entrando em contato pelo FastFood ADM.')}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="chat" size={16} color={Colors.white} />
                    <Text style={styles.whatsappBtnText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  value: { fontSize: FontSize.sm, color: Colors.text, flex: 1, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  bizName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  bizDetails: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  expandedSection: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, gap: 0 },
  whatsappBtn: {
    flexDirection: 'row', gap: 6, backgroundColor: '#25D366',
    borderRadius: BorderRadius.md, height: 40, alignItems: 'center', justifyContent: 'center',
    marginTop: Spacing.md,
  },
  whatsappBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  empty: { alignItems: 'center', paddingVertical: 64, gap: Spacing.sm },
  emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
});
