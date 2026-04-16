// Web stub — react-native-maps is native-only; full picker only works on iOS/Android.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';

export default function DeliveryMapPickerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.backFab} onPress={() => router.back()} hitSlop={12}>
        <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
      </TouchableOpacity>
      <MaterialIcons name="map" size={56} color={Colors.textMuted} style={{ marginBottom: Spacing.md }} />
      <Text style={styles.title}>Mapa no celular</Text>
      <Text style={styles.sub}>
        O ajuste fino no mapa funciona no app Android ou iOS. Use os campos de endereço na versão web.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.back()} activeOpacity={0.9}>
        <Text style={styles.btnText}>Voltar</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  backFab: { position: 'absolute', top: Spacing.lg, left: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm, textAlign: 'center' },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.lg, textAlign: 'center' },
  btn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  btnText: { fontSize: FontSize.md, fontWeight: '800', color: Colors.white },
});
