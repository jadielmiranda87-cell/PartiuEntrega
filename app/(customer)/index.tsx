import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getCustomerExploreHome,
  matchesExploreProductSearch,
  getBusinessIdsMatchingName,
  getExploreProductsForBusinessIds,
  sortExploreProductSearchByProximity,
  type ExploreProductRow,
} from '@/services/catalogService';
import type { Business } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import { openingStatusLabel } from '@/utils/openingHours';
import { formatCurrency } from '@/utils/links';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = Spacing.md * 2;
const GRID_GAP = Spacing.sm;
const COL_W = (SCREEN_W - H_PAD - GRID_GAP) / 2;

export default function CustomerHomeScreen() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<ExploreProductRow[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [storeMenuProducts, setStoreMenuProducts] = useState<ExploreProductRow[] | null>(null);
  const [storeMenuLoading, setStoreMenuLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 380);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    const home = await getCustomerExploreHome();
    setBusinesses(home.businesses);
    setProducts(home.products);
    setFeedError(home.error);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        if (status !== 'granted') {
          setUserLocation(null);
          return;
        }
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!alive) return;
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
          if (alive) setUserLocation(null);
        }
      })();
      return () => {
        alive = false;
      };
    }, [])
  );

  const matchingBusinessIds = useMemo(
    () => getBusinessIdsMatchingName(businesses, debouncedQ),
    [businesses, debouncedQ]
  );
  const isStoreNameSearch = debouncedQ.length > 0 && matchingBusinessIds.length > 0;

  useEffect(() => {
    if (!debouncedQ) {
      setStoreMenuProducts(null);
      setStoreMenuLoading(false);
      return;
    }
    const ids = getBusinessIdsMatchingName(businesses, debouncedQ);
    if (ids.length === 0) {
      setStoreMenuProducts(null);
      setStoreMenuLoading(false);
      return;
    }
    let cancelled = false;
    setStoreMenuLoading(true);
    setStoreMenuProducts(null);
    getExploreProductsForBusinessIds(ids, businesses).then((rows: ExploreProductRow[]) => {
      if (!cancelled) {
        setStoreMenuProducts(rows);
        setStoreMenuLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, businesses]);

  const displayProducts = useMemo(() => {
    if (!debouncedQ) return products;
    if (matchingBusinessIds.length > 0) {
      const base = storeMenuProducts ?? [];
      return sortExploreProductSearchByProximity(base, userLocation?.lat ?? null, userLocation?.lng ?? null);
    }
    const matched = products.filter((p) => matchesExploreProductSearch(p, debouncedQ));
    return sortExploreProductSearchByProximity(matched, userLocation?.lat ?? null, userLocation?.lng ?? null);
  }, [debouncedQ, products, matchingBusinessIds, storeMenuProducts, userLocation]);

  const isProductTextSearch = debouncedQ.length > 0 && matchingBusinessIds.length === 0;
  const showProximityHint = isProductTextSearch && !userLocation;

  const matchedStoreNames = useMemo(() => {
    if (!isStoreNameSearch) return [];
    const set = new Set(matchingBusinessIds);
    return businesses.filter((b) => set.has(b.id)).map((b) => b.name);
  }, [isStoreNameSearch, matchingBusinessIds, businesses]);

  const openProduct = (row: ExploreProductRow) => {
    router.push({
      pathname: '/(customer)/store/[id]/product/[productId]',
      params: { id: row.store.id, productId: row.id },
    });
  };

  const openStore = (businessId: string) => {
    router.push(`/(customer)/store/${businessId}`);
  };

  const renderProduct = ({ item }: { item: ExploreProductRow }) => {
    const unit = Number(item.price);
    const cmp = item.compare_price != null ? Number(item.compare_price) : null;
    const showPromo = cmp != null && cmp > unit;
    const hrs = item.store.opening_hours;
    const hrsOk = hrs != null && Object.keys(hrs).length > 0;
    const status = hrsOk ? openingStatusLabel(hrs) : null;

    return (
      <TouchableOpacity
        style={styles.productCell}
        onPress={() => openProduct(item)}
        activeOpacity={0.88}
      >
        <View style={styles.productImageWrap}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} contentFit="cover" />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <MaterialIcons name="restaurant" size={36} color={Colors.textMuted} />
            </View>
          )}
          {showPromo ? (
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>Oferta</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.storeLine} numberOfLines={1}>
          {item.store.name}
        </Text>
        <View style={styles.priceRow}>
          {showPromo ? (
            <Text style={styles.comparePrice}>{formatCurrency(cmp!)}</Text>
          ) : null}
          <Text style={styles.productPrice}>{formatCurrency(unit)}</Text>
        </View>
        {status ? (
          <View style={[styles.miniOpen, status.open ? styles.miniOpenOn : styles.miniOpenOff]}>
            <Text style={styles.miniOpenText}>{status.open ? 'Aberto' : 'Fechado'}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>O que você quer pedir?</Text>
        <Text style={styles.heroSub}>
          Itens do cardápio de cada restaurante — toque para ver e adicionar ao carrinho
        </Text>
        <View style={styles.searchRow}>
          <MaterialIcons name="search" size={22} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nome do restaurante ou do prato"
            placeholderTextColor={Colors.textMuted}
            value={q}
            onChangeText={setQ}
          />
          {q.length > 0 ? (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {showProximityHint ? (
          <Text style={styles.locationHint}>
            Ative a localização do aparelho para listar pratos dos comércios mais próximos primeiro.
          </Text>
        ) : null}
      </View>

      <View style={styles.rowBar}>
        <Text style={styles.sectionLabelFlex}>Explorar</Text>
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

      {feedError ? (
        <View style={styles.errorBox}>
          <MaterialIcons name="cloud-off" size={36} color={Colors.error} />
          <Text style={styles.errorTitle}>Não foi possível carregar tudo</Text>
          <Text style={styles.errorDetail}>
            {feedError}
            {'\n\n'}
            Se os restaurantes já cadastraram itens, confira leitura pública em products e businesses (script supabase/scripts/apply_public_catalog_read.sql).
          </Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />
      ) : storeMenuLoading && isStoreNameSearch ? (
        <View style={styles.storeSearchLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.storeSearchLoadingText}>Carregando cardápio…</Text>
        </View>
      ) : (
        <FlatList
          data={displayProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.gridContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {businesses.length > 0 ? (
                <View style={styles.storesBlock}>
                  <Text style={styles.blockTitle}>Restaurantes — ver cardápio completo</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.storesScroll}
                  >
                    {businesses.map((b) => {
                      const hrs = b.opening_hours;
                      const hrsOk = hrs != null && Object.keys(hrs).length > 0;
                      const status = hrsOk ? openingStatusLabel(hrs) : null;
                      return (
                        <TouchableOpacity
                          key={b.id}
                          style={styles.storeChip}
                          onPress={() => openStore(b.id)}
                          activeOpacity={0.88}
                        >
                          <View style={styles.storeChipIcon}>
                            <MaterialIcons name="storefront" size={26} color={Colors.primary} />
                          </View>
                          <Text style={styles.storeChipName} numberOfLines={2}>
                            {b.name}
                          </Text>
                          {status ? (
                            <View style={[styles.chipOpen, status.open ? styles.chipOpenOn : styles.chipOpenOff]}>
                              <Text style={styles.chipOpenText}>{status.open ? 'Aberto' : 'Fechado'}</Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}

              <Text style={styles.blockTitleGrid}>
                {isStoreNameSearch ? 'Cardápio do restaurante' : 'No cardápio agora'}
              </Text>
              {debouncedQ && userLocation ? (
                <Text style={styles.proximityBanner}>Comércios mais próximos de você primeiro</Text>
              ) : null}
              {isStoreNameSearch && matchedStoreNames.length > 0 ? (
                <Text style={styles.storeSearchBanner}>
                  Mostrando só: {matchedStoreNames.join(' · ')}
                </Text>
              ) : (
                <Text style={styles.blockHint}>
                  Ofertas e novidades primeiro; misturamos lojas para você descobrir opções. Busque pelo nome da loja para ver só aquele cardápio.
                </Text>
              )}
            </>
          }
          renderItem={renderProduct}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="fastfood" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {debouncedQ
                  ? isStoreNameSearch
                    ? 'Este restaurante ainda não tem itens públicos no cardápio.'
                    : 'Nenhum prato encontrado com essa busca'
                  : 'Ainda não há itens públicos no cardápio. Quando os restaurantes cadastrarem produtos, eles aparecem aqui.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  hero: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  heroTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  heroSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.sm },
  locationHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md, paddingVertical: 10 },
  rowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  sectionLabelFlex: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
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
  errorBox: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.error + '14',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.error + '55',
    gap: Spacing.sm,
  },
  errorTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.text },
  errorDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  storesBlock: { marginBottom: Spacing.md },
  blockTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  blockTitleGrid: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    marginBottom: 4,
  },
  proximityBanner: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  blockHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  storesScroll: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: 4 },
  storeChip: {
    width: 132,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeChipIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  storeChipName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, minHeight: 36 },
  chipOpen: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  chipOpenOn: { backgroundColor: Colors.primary + '22' },
  chipOpenOff: { backgroundColor: Colors.textMuted + '33' },
  chipOpenText: { fontSize: 10, fontWeight: '800', color: Colors.text },
  gridRow: {
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-between',
    marginBottom: GRID_GAP,
    gap: GRID_GAP,
  },
  gridContent: { paddingTop: 0, flexGrow: 1 },
  productCell: {
    width: COL_W,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  productImageWrap: { width: '100%', aspectRatio: 1.1, backgroundColor: Colors.surfaceElevated },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  promoBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  promoBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '800' },
  productName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    minHeight: 36,
  },
  storeLine: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.sm,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  comparePrice: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  productPrice: { fontSize: FontSize.md, fontWeight: '800', color: Colors.primary },
  miniOpen: { alignSelf: 'flex-start', marginLeft: Spacing.sm, marginTop: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.sm },
  miniOpenOn: { backgroundColor: Colors.primary + '18' },
  miniOpenOff: { backgroundColor: Colors.textMuted + '28' },
  miniOpenText: { fontSize: 9, fontWeight: '800', color: Colors.text },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: Spacing.lg, marginHorizontal: Spacing.md },
  emptyText: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', marginTop: Spacing.sm },
  storeSearchLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 48, gap: Spacing.md },
  storeSearchLoadingText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  storeSearchBanner: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
});
