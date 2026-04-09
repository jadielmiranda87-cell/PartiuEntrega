import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { listCustomerMpCards, deleteCustomerMpCard } from '@/services/customerMpCardsService';
import type { CustomerMpCard } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlert } from '@/template';

function brandLabel(methodId: string | null | undefined): string {
  if (!methodId) return 'Cartão';
  const m = methodId.toLowerCase();
  if (m.includes('visa')) return 'Visa';
  if (m.includes('master')) return 'Mastercard';
  if (m.includes('elo')) return 'Elo';
  return methodId.toUpperCase();
}

export default function SavedCardsScreen() {
  const [list, setList] = useState<CustomerMpCard[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listCustomerMpCards();
    setList(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = (item: CustomerMpCard) => {
    showAlert('Remover cartão?', 'Ele deixará de aparecer para pagamento rápido neste app.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const { error } = await deleteCustomerMpCard(item.id);
          if (error) showAlert('Erro', error);
          else load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Spacing.md, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.sub}>
        Cartões vinculados à sua conta após pagamentos aprovados pelo Mercado Pago. Não armazenamos número completo do cartão.
      </Text>
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: Spacing.sm, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="credit-card" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum cartão salvo ainda</Text>
            <Text style={styles.emptyHint}>Pague um pedido com cartão no Mercado Pago para poder salvar aqui.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <MaterialIcons name="credit-card" size={28} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>
                {brandLabel(item.payment_method_id)} ·••• {item.last_four_digits ?? '****'}
              </Text>
              {item.cardholder_name ? <Text style={styles.cardSub}>{item.cardholder_name}</Text> : null}
            </View>
            <TouchableOpacity onPress={() => remove(item)} hitSlop={12}>
              <MaterialIcons name="delete-outline" size={24} color={Colors.error} />
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, paddingHorizontal: Spacing.md, marginBottom: Spacing.md, lineHeight: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cardSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  emptyHint: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
});
