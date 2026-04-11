import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  listBusinessesExploreEnriched,
  listExploreHighlightProducts,
  type ExploreBusinessRow,
  type ExploreProductHighlight,
} from '@/services/catalogService';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import { openingStatusLabel, isBusinessOpenNow } from '@/utils/openingHours';
import { formatCurrency } from '@/utils/links';

type SortKey = 'name' | 'city' | 'neighborhood';

const PRODUCT_CARD_W = Math.min(168, Dimensions.get('window').width * 0.42);
const STORE_CARD_W = Math.min(220, Dimensions.get('window').width * 0.58);

export default function CustomerHomeScreen() {
  const [list, setList] = useState<ExploreBusinessRow[]>([]);
  const [highlights, setHighlights] = useState<ExploreProductHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [withMenuOnly, setWithMenuOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();

  const load = useCallback(async () => {
    setLoading(true);
    const [data, hi] = await Promise.all([
      listBusinessesExploreEnriched(),
      listExploreHighlightProducts(14),
    ]);
    setList(data);
    setHighlights(hi);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    list.forEach((b) => b.category_names.forEach((n) => s.add(n)));
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [list]);

  const featuredStores = useMemo(() => {
    return [...list]
      .filter((b) => b.menu_item_count > 0)
      .sort((a, b) => b.menu_item_count - a.menu_item_count)
      .slice(0, 14);
  }, [list]);

  const filtered = useMemo(() => {
    let rows = list;
    const t = q.trim().toLowerCase();
    if (t) {
      rows = rows.filter(
        (b) =>
          b.name.toLowerCase().includes(t) ||
          (b.city ?? '').toLowerCase().includes(t) ||
          (b.neighborhood ?? '').toLowerCase().includes(t)
      );
    }
    if (selectedCategory) {
      rows = rows.filter((b) => b.category_names.includes(selectedCategory));
    }
    if (openOnly) {
      rows = rows.filter((b) => isBusinessOpenNow(b.opening_hours));
    }
    if (withMenuOnly) {
      rows = rows.filter((b) => b.menu_item_count > 0);
    }
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'pt-BR');
      if (sortKey === 'city') return (a.city ?? '').localeCompare(b.city ?? '', 'pt-BR');
      return (a.neighborhood ?? '').localeCompare(b.neighborhood ?? '', 'pt-BR');
    });
    return sorted;
  }, [list, q, selectedCategory, openOnly, withMenuOnly, sortKey]);

  const toggleSort = useCallback(() => {
    setSortKey((k) => (k === 'name' ? 'city' : k === 'city' ? 'neighborhood' : 'name'));
  }, []);

  const renderListHeader = useCallback(
    () => (
      <View>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Cardápios perto de você</Text>
          <Text style={styles.heroSub}>Escolha o restaurante, monte o pedido e pague pelo app</Text>
          <View style={styles.searchRow}>
            <MaterialIcons name="search" size={22} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar nome, bairro ou cidade"
              placeholderTextColor={Colors.textMuted}
              value={q}
              onChangeText={setQ}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          <TouchableOpacity
            style={[styles.chip, openOnly && styles.chipOn]}
            onPress={() => setOpenOnly((v) => !v)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="schedule" size={16} color={openOnly ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.chipText, openOnly && styles.chipTextOn]}>Abertos agora</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, withMenuOnly && styles.chipOn]}
            onPress={() => setWithMenuOnly((v) => !v)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="restaurant-menu" size={16} color={withMenuOnly ? Colors.white : Colors.textSecondary} />
            <Text style={[styles.chipText, withMenuOnly && styles.chipTextOn]}>Com cardápio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chip} onPress={toggleSort} activeOpacity={0.85}>
            <MaterialIcons name="sort" size={16} color={Colors.textSecondary} />
            <Text style={styles.chipText}>
              Ordenar: {sortKey === 'name' ? 'Nome' : sortKey === 'city' ? 'Cidade' : 'Bairro'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.rowBar}>
          <Text style={styles.sectionLabel}>Início</Text>
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

        {categoryOptions.length > 0 ? (
          <View style={styles.carouselBlock}>
            <Text style={styles.carouselTitle}>Categorias do cardápio</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hCarouselPad}>
              <TouchableOpacity
                style={[styles.catChip, selectedCategory === null && styles.catChipOn]}
                onPress={() => setSelectedCategory(null)}
                activeOpacity={0.85}
              >
                <Text style={[styles.catChipText, selectedCategory === null && styles.catChipTextOn]}>Todas</Text>
              </TouchableOpacity>
              {categoryOptions.map((name) => (
                <TouchableOpacity
                  key={name}
                  style={[styles.catChip, selectedCategory === name && styles.catChipOn]}
                  onPress={() => setSelectedCategory((c) => (c === name ? null : name))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.catChipText, selectedCategory === name && styles.catChipTextOn]} numberOfLines={1}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {highlights.length > 0 ? (
          <View style={styles.carouselBlock}>
            <View style={styles.carouselHeadRow}>
              <MaterialIcons name="local-fire-department" size={20} color={Colors.secondary} />
              <Text style={styles.carouselTitleInline}>Em destaque no cardápio</Text>
            </View>
            <FlatList
              horizontal
              data={highlights}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hCarouselPad}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.productCard, { width: PRODUCT_CARD_W }]}
                  onPress={() => router.push(`/(customer)/store/${item.business_id}`)}
                  activeOpacity={0.88}
                >
                  <View style={styles.productImgWrap}>
                    {item.image_url ? (
                      <Image source={{ uri: item.image_url }} style={styles.productImg} contentFit="cover" />
                    ) : (
                      <View style={[styles.productImg, styles.productImgPlaceholder]}>
                        <MaterialIcons name="restaurant" size={40} color={Colors.textMuted} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
                  <Text style={styles.productBiz} numberOfLines={1}>
                    {item.business_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ) : null}

        {featuredStores.length > 0 ? (
          <View style={styles.carouselBlock}>
            <View style={styles.carouselHeadRow}>
              <MaterialIcons name="storefront" size={20} color={Colors.primary} />
              <Text style={styles.carouselTitleInline}>Lojas em destaque</Text>
            </View>
            <FlatList
              horizontal
              data={featuredStores}
              keyExtractor={(item) => `feat-${item.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hCarouselPad}
              renderItem={({ item }) => {
                const hrs = item.opening_hours;
                const hrsOk = hrs != null && Object.keys(hrs).length > 0;
                const status = hrsOk ? openingStatusLabel(hrs) : null;
                return (
                  <TouchableOpacity
                    style={[styles.storeCarouselCard, { width: STORE_CARD_W }]}
                    onPress={() => router.push(`/(customer)/store/${item.id}`)}
                    activeOpacity={0.88}
                  >
                    <View style={styles.storeCarouselIcon}>
                      <MaterialIcons name="restaurant" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.storeCarouselTitle} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.storeCarouselMeta} numberOfLines={1}>
                      {item.neighborhood} · {item.city}
                    </Text>
                    <View style={styles.storeCarouselFooter}>
                      <Text style={styles.storeCarouselCount}>{item.menu_item_count} itens</Text>
                      {status ? (
                        <View style={[styles.miniBadge, status.open ? styles.miniBadgeOn : styles.miniBadgeOff]}>
                          <Text style={styles.miniBadgeText}>{status.open ? 'Aberto' : 'Fechado'}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : null}

        <Text style={styles.listSectionTitle}>Todos os restaurantes</Text>
      </View>
    ),
    [
      q,
      openOnly,
      withMenuOnly,
      sortKey,
      itemCount,
      categoryOptions,
      highlights,
      featuredStores,
      selectedCategory,
      router,
      toggleSort,
    ]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={Colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: Spacing.md }}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="storefront" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum restaurante encontrado</Text>
              <Text style={styles.emptyHint}>Ajuste a busca ou os filtros acima</Text>
            </View>
          }
          renderItem={({ item }) => {
            const hrs = item.opening_hours;
            const hrsOk = hrs != null && Object.keys(hrs).length > 0;
            const status = hrsOk ? openingStatusLabel(hrs) : null;
            const preview =
              item.menu_preview_names.length > 0
                ? item.menu_preview_names.join(' · ')
                : 'Cardápio em montagem';
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
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {status ? (
                      <View style={[styles.openBadge, status.open ? styles.openBadgeOn : styles.openBadgeOff]}>
                        <Text style={styles.openBadgeText}>{status.open ? 'Aberto' : 'Fechado'}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.neighborhood} · {item.city}
                  </Text>
                  <Text style={styles.menuLine} numberOfLines={2}>
                    {item.menu_item_count > 0 ? (
                      <>
                        <Text style={styles.menuCount}>{item.menu_item_count} itens</Text>
                        {' — '}
                        {preview}
                      </>
                    ) : (
                      <Text style={styles.menuEmpty}>Sem itens no cardápio ainda</Text>
                    )}
                  </Text>
                  <Text style={styles.cardAddr} numberOfLines={1}>
                    {item.address}, {item.address_number}
                  </Text>
                  <View style={styles.ctaRow}>
                    <Text style={styles.ctaText}>Ver cardápio</Text>
                    <MaterialIcons name="arrow-forward" size={18} color={Colors.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  hero: { paddingHorizontal: 0, paddingBottom: Spacing.sm },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
  chipsScroll: { maxHeight: 44, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  chipTextOn: { color: Colors.white },
  rowBar: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  sectionLabel: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  cartBadge: { padding: 6, position: 'relative' },
  cartCount: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  linkOrders: { paddingVertical: 4 },
  linkOrdersText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.sm },
  carouselBlock: { marginBottom: Spacing.lg },
  carouselTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
    paddingHorizontal: 0,
  },
  carouselHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  carouselTitleInline: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text, flex: 1 },
  hCarouselPad: { paddingRight: Spacing.md, gap: Spacing.sm, flexDirection: 'row' },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  catChipOn: { backgroundColor: Colors.primary + '33', borderColor: Colors.primary },
  catChipText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, maxWidth: 140 },
  catChipTextOn: { color: Colors.text },
  productCard: {
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productImgWrap: { borderRadius: BorderRadius.md, overflow: 'hidden', marginBottom: 8 },
  productImg: { width: '100%', height: 100, backgroundColor: Colors.surfaceElevated },
  productImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, minHeight: 36 },
  productPrice: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary, marginTop: 2 },
  productBiz: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  storeCarouselCard: {
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeCarouselIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  storeCarouselTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  storeCarouselMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.sm },
  storeCarouselFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storeCarouselCount: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  miniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  miniBadgeOn: { backgroundColor: Colors.primary + '22' },
  miniBadgeOff: { backgroundColor: Colors.textMuted + '33' },
  miniBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.text },
  listSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: 2 },
  cardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  openBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.sm },
  openBadgeOn: { backgroundColor: Colors.primary + '22' },
  openBadgeOff: { backgroundColor: Colors.textMuted + '33' },
  openBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.text },
  cardMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  menuLine: { fontSize: FontSize.xs, color: Colors.text, marginTop: 6, lineHeight: 18 },
  menuCount: { fontWeight: '700', color: Colors.primary },
  menuEmpty: { color: Colors.textMuted, fontStyle: 'italic' },
  cardAddr: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  ctaText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  empty: { alignItems: 'center', paddingVertical: 48, gap: Spacing.sm },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md },
  emptyHint: { color: Colors.textMuted, fontSize: FontSize.sm },
});
