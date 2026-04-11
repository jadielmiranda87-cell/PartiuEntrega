import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput,   FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { listBusinessesForExplore } from '@/services/catalogService';
import type { Business } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import { openingStatusLabel } from '@/utils/openingHours';

export default function CustomerHomeScreen() {
  const [list, setList] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listBusinessesForExplore();
    setList(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = q.trim()
    ? list.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase()) || b.city?.toLowerCase().includes(q.trim().toLowerCase()))
    : list;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>O que você quer pedir?</Text>
        <Text style={styles.heroSub}>Escolha um restaurante e monte seu pedido</Text>
        <View style={styles.searchRow}>
          <MaterialIcons name="search" size={22} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar restaurante ou cidade"
            placeholderTextColor={Colors.textMuted}
            value={q}
            onChangeText={setQ}
          />
        </View>
      </View>

      <View style={styles.rowBar}>
        <Text style={styles.sectionLabel}>Restaurantes</Text>
        <TouchableOpacity onPress={() => router.push('/(customer)/cart')} style={styles.cartBadge} activeOpacity={0.85}>
          <MaterialIcons name="shopping-cart" size={22} color={Colors.primary} />
          {itemCount > 0 ? (
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{itemCount > 99 ? '99+' : itemCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(customer)/orders')} style={styles.linkOrders} activeOpacity={0.85}>
          <Text style={styles.linkOrdersText}>Pedidos</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(customer)/profile')} style={styles.linkOrders} activeOpacity={0.85}>
          <MaterialIcons name="person-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24, gap: Spacing.sm }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="storefront" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum restaurante encontrado</Text>
            </View>
          }
          renderItem={({ item }) => {
            const hrs = item.opening_hours;
            const hrsOk = hrs != null && Object.keys(hrs).length > 0;
            const status = hrsOk ? openingStatusLabel(hrs) : null;
            return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(customer)/store/${item.id}`)}
              activeOpacity={0.88}
            >
              <View style={styles.cardIcon}>
                <MaterialIcons name="restaurant" size={32} color={Colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
                  {status ? (
                    <View
                      style={[
                        styles.openBadge,
                        status.open ? styles.openBadgeOn : styles.openBadgeOff,
                      ]}
                    >
                      <Text style={styles.openBadgeText}>
                        {status.open ? 'Aberto' : 'Fechado'}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.neighborhood} · {item.city}
                </Text>
                <Text style={styles.cardAddr} numberOfLines={1}>
                  {item.address}, {item.address_number}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  hero: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, height: 48, borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
  rowBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.sm },
  sectionLabel: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cartBadge: { padding: 6, position: 'relative' },
  cartCount: {
    position: 'absolute', top: 0, right: 0, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.error, alignItems: 'center', justifyContent: 'center',
  },
  cartCountText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  linkOrders: { paddingVertical: 4 },
  linkOrdersText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardIcon: {
    width: 56, height: 56, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  openBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  openBadgeOn: { backgroundColor: Colors.primary + '22' },
  openBadgeOff: { backgroundColor: Colors.textMuted + '33' },
  openBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.text },
  cardMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardAddr: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: Spacing.sm },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md },
});
