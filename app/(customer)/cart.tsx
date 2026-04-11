import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '@/contexts/CartContext';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';

export default function CustomerCartScreen() {
  const { lines, subtotal, setQuantity, removeLine, clearCart } = useCart();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: Spacing.md }]}>
      {lines.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="shopping-cart" size={56} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Carrinho vazio</Text>
          <Text style={styles.emptySub}>Adicione itens em um restaurante</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.replace('/(customer)')} activeOpacity={0.9}>
            <Text style={styles.exploreBtnText}>Explorar restaurantes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={lines}
            keyExtractor={(l) => l.productId}
            contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: 120 }}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pName}>{item.productName}</Text>
                  <Text style={styles.pPrice}>{formatCurrency(item.unitPrice)} cada</Text>
                </View>
                <View style={styles.qtyRow}>
                  <TouchableOpacity onPress={() => setQuantity(item.productId, item.quantity - 1)} hitSlop={8}>
                    <MaterialIcons name="remove-circle-outline" size={28} color={Colors.primary} />
                  </TouchableOpacity>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <TouchableOpacity onPress={() => setQuantity(item.productId, item.quantity + 1)} hitSlop={8}>
                    <MaterialIcons name="add-circle-outline" size={28} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeLine(item.productId)} hitSlop={8}>
                  <MaterialIcons name="delete-outline" size={22} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}
          />
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <Text style={styles.hint}>Taxa de entrega calculada no próximo passo</Text>
            <TouchableOpacity style={styles.checkoutBtn} onPress={() => router.push('/(customer)/checkout')} activeOpacity={0.9}>
              <Text style={styles.checkoutText}>Continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearBtn} onPress={clearCart}>
              <Text style={styles.clearText}>Esvaziar carrinho</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  emptySub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  exploreBtn: { marginTop: Spacing.md, backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: BorderRadius.md },
  exploreBtnText: { color: Colors.white, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.sm },
  pName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  pPrice: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qty: { fontSize: FontSize.lg, fontWeight: '800', minWidth: 28, textAlign: 'center', color: Colors.text },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md },
  checkoutBtn: {
    backgroundColor: Colors.primary, height: 52, borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  checkoutText: { color: Colors.white, fontWeight: '800', fontSize: FontSize.md },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  clearText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
});
