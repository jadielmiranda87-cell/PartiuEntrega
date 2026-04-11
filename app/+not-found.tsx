/*
 * @Description:
 */

// Powered by OnSpace.AI
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, BorderRadius, Shadows } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={[Colors.background, Colors.surfaceMuted]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.content}>
        <MaterialIcons name="search-off" size={80} color={Colors.primary} />
        <Text style={styles.title}>Página não encontrada</Text>
        <Text style={styles.message}>
          O endereço que você abriu não existe neste app. Volte ao início e tente de novo.
        </Text>

        <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/')} activeOpacity={0.85}>
          <Text style={styles.homeButtonText}>Ir para o início</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  homeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: BorderRadius.lg,
    ...Shadows.button,
  },
  homeButtonText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
