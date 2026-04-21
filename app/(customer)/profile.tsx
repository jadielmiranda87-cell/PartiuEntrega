import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppAuth } from '@/hooks/useAppAuth';
import { getSupabaseClient, useAlert } from '@/template';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CustomerProfileScreen() {
  const { profile, signOut, refreshProfile } = useAppAuth();
  const [uploading, setUploading] = useState(false);
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await signOut();
    router.replace('/login');
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permissão necessária', 'Precisamos de acesso às suas fotos para mudar a imagem de perfil.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets[0].uri) {
      uploadProfileImage(result.assets[0].uri);
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!profile?.id) return;
    setUploading(true);

    try {
      const supabase = getSupabaseClient();
      const fileExt = uri.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: fileName,
        type: `image/${fileExt}`,
      } as any);

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, formData);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      await refreshProfile();
      showAlert('Sucesso', 'Sua foto de perfil foi atualizada!');
    } catch (error: any) {
      showAlert('Erro', error.message || 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.background }}
      contentContainerStyle={{ paddingTop: Spacing.lg, paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 24 }}
    >
      <View style={styles.card}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={Colors.primary} size="large" />
          ) : profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <MaterialIcons name="person" size={40} color={Colors.primary} />
          )}
          <View style={styles.editIcon}>
            <MaterialIcons name="edit" size={14} color={Colors.white} />
          </View>
        </TouchableOpacity>

        <Text style={styles.name}>{profile?.username ?? 'Cliente'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        {profile?.phone ? <Text style={styles.phone}>{profile.phone}</Text> : null}
      </View>

      <TouchableOpacity style={styles.row} onPress={() => router.push('/(customer)/orders')} activeOpacity={0.85}>
        <MaterialIcons name="receipt-long" size={22} color={Colors.text} />
        <Text style={styles.rowText}>Meus pedidos</Text>
        <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => router.push('/(customer)/saved-cards')} activeOpacity={0.85}>
        <MaterialIcons name="credit-card" size={22} color={Colors.text} />
        <Text style={styles.rowText}>Cartões salvos</Text>
        <MaterialIcons name="chevron-right" size={22} color={Colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.85}>
        <MaterialIcons name="logout" size={22} color={Colors.error} />
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl,
    alignItems: 'center', marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  avatarContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm, borderOrigin: 'dashed', borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', position: 'relative',
  },
  avatar: { width: '100%', height: '100%' },
  editIcon: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.primary,
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },
  name: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginTop: Spacing.sm },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  phone: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  rowText: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginTop: Spacing.lg, paddingVertical: Spacing.md,
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.md },
});
