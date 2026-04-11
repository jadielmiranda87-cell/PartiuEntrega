import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getBusinessById, getProductById } from '@/services/catalogService';
import type { Business, Product } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/utils/links';

const NOTES_MAX = 100;

export default function ProductDetailScreen() {
  const { id: businessId, productId } = useLocalSearchParams<{ id: string; productId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addLine } = useCart();

  const [business, setBusiness] = useState<Business | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!businessId || !productId) return;
    setLoading(true);
    const [b, p] = await Promise.all([getBusinessById(businessId), getProductById(productId)]);
    setBusiness(b);
    if (p && p.business_id === businessId && p.is_active) {
      setProduct(p);
    } else {
      setProduct(null);
    }
    setLoading(false);
  }, [businessId, productId]);

  useEffect(() => {
    load();
  }, [load]);

  const unit = product ? Number(product.price) : 0;
  const compare = product?.compare_price != null ? Number(product.compare_price) : null;
  const showPromo = compare != null && compare > unit;
  const discountPct = showPromo ? Math.round((1 - unit / compare) * 100) : 0;
  const maxPerOrder = product?.max_per_order != null ? Math.max(1, Number(product.max_per_order)) : null;
  const maxQty = maxPerOrder != null ? maxPerOrder : 99;

  const decQty = () => setQty((q) => Math.max(1, q - 1));
  const incQty = () => setQty((q) => Math.min(maxQty, q + 1));

  const lineTotal = unit * qty;

  const handleShare = async () => {
    if (!product || !business) return;
    try {
      await Share.share({
        message: `${product.name} — ${formatCurrency(unit)} · ${business.name}`,
      });
    } catch {
      /* ignore */
    }
  };

  const handleAdd = () => {
    if (!business || !product) return;
    addLine({
      productId: product.id,
      businessId: business.id,
      businessName: business.name,
      productName: product.name,
      unitPrice: unit,
      quantity: qty,
      notes: notes.trim() || undefined,
    });
    router.back();
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!business || !product) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: Colors.textSecondary }}>Produto não encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.md }}>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroWrap}>
          {product.image_url ? (
            <Image source={{ uri: product.image_url }} style={styles.heroImg} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.heroImg, styles.heroPlaceholder]}>
              <MaterialIcons name="restaurant" size={64} color={Colors.textMuted} />
            </View>
          )}
          <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.iconCircle} onPress={() => router.back()} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconCircle} onPress={handleShare} hitSlop={12}>
              <MaterialIcons name="share" size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{product.name}</Text>

          <View style={styles.priceBlock}>
            <Text style={styles.priceNow}>{formatCurrency(unit)}</Text>
            {showPromo ? (
              <>
                <Text style={styles.priceWas}>{formatCurrency(compare!)}</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>-{discountPct}%</Text>
                </View>
              </>
            ) : null}
            {maxPerOrder != null ? (
              <Text style={styles.limitHint}>Limite {maxPerOrder}</Text>
            ) : null}
          </View>

          {product.description ? (
            <Text style={styles.desc}>{product.description}</Text>
          ) : null}

          <Text style={styles.obsLabel}>Observações</Text>
          <TextInput
            style={styles.obsInput}
            placeholder="Insira suas observações aqui"
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, NOTES_MAX))}
            multiline
            maxLength={NOTES_MAX}
            textAlignVertical="top"
          />
          <Text style={styles.obsCount}>
            {notes.length}/{NOTES_MAX}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.qtyBox}>
          <TouchableOpacity style={styles.qtyBtn} onPress={decQty} disabled={qty <= 1}>
            <MaterialIcons name="remove" size={22} color={qty <= 1 ? Colors.textMuted : Colors.text} />
          </TouchableOpacity>
          <Text style={styles.qtyNum}>{qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={incQty} disabled={qty >= maxQty}>
            <MaterialIcons name="add" size={22} color={qty >= maxQty ? Colors.textMuted : Colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addCartBtn} onPress={handleAdd} activeOpacity={0.9}>
          <Text style={styles.addCartLabel}>Adicionar</Text>
          <View style={styles.addCartPrices}>
            <Text style={styles.addCartTotal}>{formatCurrency(lineTotal)}</Text>
            {showPromo ? <Text style={styles.addCartWas}>{formatCurrency(compare! * qty)}</Text> : null}
          </View>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const HERO_H = 280;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  heroWrap: { position: 'relative', backgroundColor: Colors.surface },
  heroImg: { width: '100%', height: HERO_H },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceElevated },
  heroTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  body: { paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, lineHeight: 28 },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  priceNow: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.success },
  priceWas: { fontSize: FontSize.md, color: Colors.textMuted, textDecorationLine: 'line-through' },
  badge: {
    backgroundColor: Colors.success + '33',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.success },
  limitHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginLeft: 4 },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.md, lineHeight: 22 },
  obsLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginTop: Spacing.lg },
  obsInput: {
    marginTop: Spacing.sm,
    minHeight: 88,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  obsCount: { alignSelf: 'flex-end', fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qtyBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  qtyNum: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, minWidth: 28, textAlign: 'center' },
  addCartBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
  },
  addCartLabel: { fontSize: FontSize.md, fontWeight: '900', color: Colors.black },
  addCartPrices: { alignItems: 'flex-end' },
  addCartTotal: { fontSize: FontSize.md, fontWeight: '900', color: Colors.black },
  addCartWas: { fontSize: FontSize.xs, color: Colors.textMuted, textDecorationLine: 'line-through' },
});
