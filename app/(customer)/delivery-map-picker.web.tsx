import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

/**
 * Web: sem react-native-maps (bundle web não importa o pacote nativo).
 */
export default function DeliveryMapPickerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.webFallback} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.backFab} onPress={() => router.back()} hitSlop={12}>
        <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>
      <Text style={styles.webTitle}>Mapa no celular</Text>
      <Text style={styles.webSub}>
        O ajuste fino no mapa funciona no app Android ou iOS. Use os campos de endereço na web.
      </Text>
      <TouchableOpacity style={styles.confirmBtn} onPress={() => router.back()}>
        <Text style={styles.confirmBtnText}>Voltar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  webFallback: { flex: 1, padding: Spacing.lg, justifyContent: 'center', backgroundColor: Colors.background },
  webTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  webSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.white },
  backFab: { position: 'absolute', top: Spacing.lg, left: Spacing.md, zIndex: 2 },
});
