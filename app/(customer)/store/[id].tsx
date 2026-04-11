import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getBusinessById, getMenuForBusiness } from '@/services/catalogService';
import type { Business, Product, ProductCategory } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/utils/links';
import { formatDayScheduleLine, listDaysForDisplay, openingStatusLabel } from '@/utils/openingHours';
export default function StoreMenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, Product[]>>({});
  const [loading, setLoading] = useState(true);
  const { addLine, itemCount } = useCart();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const b = await getBusinessById(id);
    setBusiness(b);
    if (b) {
      const menu = await getMenuForBusiness(b.id);
      setCategories(menu.categories);
      setByCategory(menu.byCategory);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = (p: Product) => {
    if (!business) return;
    addLine({
      productId: p.id,
      businessId: business.id,
      businessName: business.name,
      productName: p.name,
      unitPrice: Number(p.price),
    });
  };

  if (loading || !id) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={{ color: Colors.textSecondary }}>Restaurante não encontrado</Text>
      </View>
    );
  }

  const hasMenu = categories.some((c) => (byCategory[c.id] ?? []).length > 0);
  const hours = business.opening_hours;
  const hasHoursConfig = hours != null && Object.keys(hours).length > 0;
  const status = hasHoursConfig ? openingStatusLabel(hours) : null;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 88, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.bizName}>{business.name}</Text>
        <View style={styles.statusRow}>
          {hasHoursConfig && status ? (
            <View style={[styles.statusPill, status.open ? styles.statusOpen : styles.statusClosed]}>
              <Text style={styles.statusPillText}>{status.label}</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, styles.statusNeutral]}>
              <Text style={styles.statusPillText}>Horário não informado</Text>
            </View>
          )}
        </View>
        <Text style={styles.bizAddr}>
          {business.neighborhood}, {business.city} · {business.phone}
        </Text>

        {hasHoursConfig ? (
          <View style={styles.hoursBlock}>
            <Text style={styles.hoursTitle}>Horário de funcionamento</Text>
            {listDaysForDisplay().map(({ key, label }) => (
              <View key={key} style={styles.hoursLine}>
                <Text style={styles.hoursDay}>{label}</Text>
                <Text style={styles.hoursVal}>{formatDayScheduleLine(hours?.[key])}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hoursHint}>Horário de funcionamento não informado pelo restaurante.</Text>
        )}

        {!hasMenu ? (
          <View style={styles.emptyMenu}>
            <MaterialIcons name="restaurant-menu" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyMenuText}>Cardápio ainda não cadastrado neste restaurante.</Text>
          </View>
        ) : (
          categories.map((cat) => {
            const items = byCategory[cat.id] ?? [];
            if (items.length === 0) return null;
            return (
              <View key={cat.id} style={styles.section}>
                <Text style={styles.catTitle}>{cat.name}</Text>
                {items.map((p) => (
                  <View key={p.id} style={styles.productRow}>
                    {p.image_url ? (
                      <Image
                        source={{ uri: p.image_url }}
                        style={styles.pImage}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : (
                      <View style={styles.pImagePlaceholder}>
                        <MaterialIcons name="restaurant" size={28} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pName}>{p.name}</Text>
                      {p.description ? <Text style={styles.pDesc} numberOfLines={2}>{p.description}</Text> : null}
                      <Text style={styles.pPrice}>{formatCurrency(Number(p.price))}</Text>
                    </View>
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(p)} activeOpacity={0.85}>
                      <MaterialIcons name="add" size={22} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {itemCount > 0 ? (
        <View style={[styles.fabBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.fabBtn} onPress={() => router.push('/(customer)/cart')} activeOpacity={0.9}>
            <Text style={styles.fabText}>Ver carrinho ({itemCount})</Text>
            <MaterialIcons name="arrow-forward" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  bizName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.md },
  statusOpen: { backgroundColor: Colors.primary + '22' },
  statusClosed: { backgroundColor: Colors.textMuted + '33' },
  statusNeutral: { backgroundColor: Colors.border },
  statusPillText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.text },
  bizAddr: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  hoursBlock: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hoursTitle: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  hoursLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: Spacing.md },
  hoursDay: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  hoursVal: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  hoursHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  catTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pImage: {
    width: 72, height: 72, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  pImagePlaceholder: {
    width: 72, height: 72, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  pName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  pDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  pPrice: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary, marginTop: 6 },
  addBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.md, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyMenu: { alignItems: 'center', paddingVertical: 40, gap: Spacing.sm },
  emptyMenuText: { color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.lg },
  fabBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: Spacing.md, backgroundColor: Colors.background + 'ee',
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  fabBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary, height: 52, borderRadius: BorderRadius.md,
  },
  fabText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
});
