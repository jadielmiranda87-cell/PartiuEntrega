import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAppAuth } from '@/hooks/useAppAuth';
import { useAlert } from '@/template';
import {
  getCategoriesForBusiness,
  getAllProductsForBusiness,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  updateProduct,
} from '@/services/catalogService';
import { pickImageFromGallery } from '@/services/documentService';
import { uploadProductImage } from '@/services/productImageService';
import type { Product, ProductCategory } from '@/types';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCurrency } from '@/utils/links';

export default function BusinessCatalogScreen() {
  const { businessProfile, loading: authLoading } = useAppAuth();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCat, setNewCat] = useState('');
  const [adding, setAdding] = useState(false);
  const [pName, setPName] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [expandCatId, setExpandCatId] = useState<string | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessProfile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [c, p] = await Promise.all([
      getCategoriesForBusiness(businessProfile.id),
      getAllProductsForBusiness(businessProfile.id),
    ]);
    setCategories(c);
    setProducts(p);
    setLoading(false);
  }, [businessProfile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAddCategory = async () => {
    if (!businessProfile || !newCat.trim()) return;
    setAdding(true);
    const { error } = await createCategory(businessProfile.id, newCat.trim());
    setAdding(false);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    setNewCat('');
    load();
  };

  const handleProductImage = async (p: Product) => {
    if (!businessProfile) return;
    const picked = await pickImageFromGallery();
    if (!picked) return;
    setUploadingProductId(p.id);
    const { url, error: upErr } = await uploadProductImage(
      businessProfile.id,
      p.id,
      picked.uri,
      picked.type
    );
    if (upErr || !url) {
      setUploadingProductId(null);
      showAlert('Imagem', upErr ?? 'Não foi possível enviar a foto.');
      return;
    }
    const { error } = await updateProduct(p.id, { image_url: url });
    setUploadingProductId(null);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    load();
  };

  const handleAddProduct = async (categoryId: string) => {
    if (!businessProfile || !pName.trim()) {
      showAlert('Produto', 'Informe o nome do produto.');
      return;
    }
    const price = parseFloat(pPrice.replace(',', '.'));
    if (Number.isNaN(price) || price < 0) {
      showAlert('Preço', 'Informe um preço válido.');
      return;
    }
    setAdding(true);
    const { error } = await createProduct({
      business_id: businessProfile.id,
      category_id: categoryId,
      name: pName.trim(),
      description: null,
      price,
      image_url: null,
      is_active: true,
      sort_order: 0,
    });
    setAdding(false);
    if (error) {
      showAlert('Erro', error);
      return;
    }
    setPName('');
    setPPrice('');
    setExpandCatId(null);
    load();
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!businessProfile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: Colors.textSecondary }}>Comércio não encontrado</Text>
      </View>
    );
  }

  const productsByCat = (cid: string) => products.filter((p) => p.category_id === cid);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Cardápio</Text>
        <Text style={styles.sub}>Categorias e produtos visíveis para o cliente no app</Text>

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Nova categoria (ex.: Pizzas)"
            placeholderTextColor={Colors.textMuted}
            value={newCat}
            onChangeText={setNewCat}
          />
          <TouchableOpacity style={[styles.addCatBtn, adding && { opacity: 0.6 }]} onPress={handleAddCategory} disabled={adding}>
            <MaterialIcons name="add" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>

        {categories.length === 0 ? (
          <Text style={styles.hint}>Crie uma categoria para começar.</Text>
        ) : null}

        {categories.map((cat) => (
          <View key={cat.id} style={styles.card}>
            <View style={styles.catHeader}>
              <Text style={styles.catTitle}>{cat.name}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (expandCatId === cat.id) {
                      setExpandCatId(null);
                    } else {
                      setPName('');
                      setPPrice('');
                      setExpandCatId(cat.id);
                    }
                  }}
                >
                  <MaterialIcons name="add-circle" size={26} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    showAlert('Excluir categoria?', 'Produtos desta categoria serão removidos.', [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: async () => {
                          const { error } = await deleteCategory(cat.id);
                          if (error) showAlert('Erro', error);
                          else load();
                        },
                      },
                    ])
                  }
                >
                  <MaterialIcons name="delete-outline" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>

            {expandCatId === cat.id ? (
              <View style={styles.inlineAdd}>
                <TextInput
                  style={styles.smallInput}
                  placeholder="Nome do produto"
                  placeholderTextColor={Colors.textMuted}
                  value={expandCatId === cat.id ? pName : ''}
                  onChangeText={setPName}
                />
                <TextInput
                  style={styles.smallInput}
                  placeholder="Preço"
                  placeholderTextColor={Colors.textMuted}
                  value={expandCatId === cat.id ? pPrice : ''}
                  onChangeText={setPPrice}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.savePbtn} onPress={() => handleAddProduct(cat.id)} disabled={adding}>
                  <Text style={styles.savePbtnText}>Salvar produto</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {productsByCat(cat.id).map((p) => (
              <View key={p.id} style={styles.productRow}>
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={styles.pThumb} />
                ) : (
                  <View style={styles.pThumbPlaceholder}>
                    <MaterialIcons name="fastfood" size={22} color={Colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.pName}>{p.name}</Text>
                  <Text style={styles.pPrice}>{formatCurrency(Number(p.price))}</Text>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleProductImage(p)}
                  disabled={uploadingProductId === p.id}
                  accessibilityLabel="Foto do produto"
                >
                  {uploadingProductId === p.id ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <MaterialIcons name="add-a-photo" size={22} color={Colors.primary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    showAlert('Remover', `Remover ${p.name}?`, [
                      { text: 'Não', style: 'cancel' },
                      {
                        text: 'Sim',
                        style: 'destructive',
                        onPress: async () => {
                          const { error } = await deleteProduct(p.id);
                          if (error) showAlert('Erro', error);
                          else load();
                        },
                      },
                    ])
                  }
                >
                  <MaterialIcons name="close" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg },
  addRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  input: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 48, color: Colors.text,
  },
  addCatBtn: {
    width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  catTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, flex: 1 },
  inlineAdd: { gap: Spacing.sm, marginBottom: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  smallInput: {
    backgroundColor: Colors.surfaceElevated, borderRadius: BorderRadius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, height: 44, color: Colors.text,
  },
  savePbtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  savePbtnText: { color: Colors.white, fontWeight: '800' },
  productRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm,
  },
  pThumb: {
    width: 48, height: 48, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
  },
  pThumbPlaceholder: {
    width: 48, height: 48, borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  iconBtn: { padding: 4, minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  pName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  pPrice: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700', marginTop: 2 },
});
