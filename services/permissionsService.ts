/**
 * Serviço centralizado de permissões do app.
 * Solicita permissões com explicações em português antes de qualquer uso.
 * Nenhuma permissão é solicitada em segundo plano sem o consentimento explícito do usuário.
 */

import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PermissionResult =
  | { granted: true }
  | { granted: false; reason: string };

// ─── Câmera ───────────────────────────────────────────────────────────────────

/**
 * Solicita permissão de câmera com explicação ao usuário.
 * Usada para captura de fotos da CNH e selfie.
 */
export async function requestCameraPermission(): Promise<PermissionResult> {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();

  if (status === 'granted') return { granted: true };

  if (!canAskAgain) {
    return {
      granted: false,
      reason:
        'Permissão de câmera negada permanentemente. Acesse as Configurações do dispositivo > PartiuEntrega > Câmera para habilitar.',
    };
  }

  return {
    granted: false,
    reason: 'Permissão de câmera necessária para fotografar a CNH e tirar a selfie de verificação.',
  };
}

// ─── Galeria / Armazenamento ──────────────────────────────────────────────────

/**
 * Solicita permissão de galeria de fotos.
 * Usada para selecionar imagens da CNH do rolo de câmera.
 */
export async function requestMediaLibraryPermission(): Promise<PermissionResult> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (status === 'granted') return { granted: true };

  if (!canAskAgain) {
    return {
      granted: false,
      reason:
        'Acesso à galeria negado permanentemente. Acesse Configurações > PartiuEntrega > Fotos para habilitar.',
    };
  }

  return {
    granted: false,
    reason: 'Acesso à galeria necessário para selecionar fotos da CNH.',
  };
}

// ─── Localização ──────────────────────────────────────────────────────────────

/**
 * Solicita permissão de localização (apenas durante o uso).
 * Usada para calcular rotas e encontrar motoboys próximos.
 * Não solicita localização em segundo plano — respeita a privacidade do usuário.
 */
export async function requestLocationPermission(): Promise<PermissionResult> {
  // Verifica status atual sem solicitar ainda
  const existing = await Location.getForegroundPermissionsAsync();

  if (existing.status === 'granted') return { granted: true };

  if (!existing.canAskAgain) {
    return {
      granted: false,
      reason:
        'Permissão de localização negada permanentemente. Acesse Configurações > PartiuEntrega > Localização e escolha "Ao usar o app".',
    };
  }

  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status === 'granted') return { granted: true };

  return {
    granted: false,
    reason:
      'Localização necessária para calcular rotas de entrega. Você pode conceder a permissão nas configurações do dispositivo.',
  };
}

// ─── Notificações ────────────────────────────────────────────────────────────

/**
 * Solicita permissão de notificações.
 * Usada para alertar motoboys sobre novos pedidos de entrega.
 * Apenas em dispositivos físicos — simuladores/emuladores não suportam notificações push.
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (Platform.OS === 'web') {
    return { granted: false, reason: 'Notificações não suportadas na versão web.' };
  }

  const existing = await Notifications.getPermissionsAsync();

  if (existing.status === 'granted') return { granted: true };

  if (!existing.canAskAgain) {
    return {
      granted: false,
      reason:
        'Notificações bloqueadas. Acesse Configurações > PartiuEntrega > Notificações para habilitar alertas de novas entregas.',
    };
  }

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  if (status === 'granted') return { granted: true };

  return {
    granted: false,
    reason:
      'Sem permissão de notificações. Você não receberá alertas sobre novos pedidos de entrega.',
  };
}

// ─── Solicitação em lote — para motoboys ─────────────────────────────────────

export interface MotoboyPermissionsStatus {
  camera: boolean;
  mediaLibrary: boolean;
  location: boolean;
  notifications: boolean;
}

/**
 * Solicita todas as permissões necessárias para o motoboy usar o app.
 * Cada permissão é solicitada individualmente com sua justificativa.
 * Retorna o status de cada permissão — nunca lança exceção.
 */
export async function requestAllMotoboyPermissions(): Promise<MotoboyPermissionsStatus> {
  const [camera, media, location, notifications] = await Promise.allSettled([
    requestCameraPermission(),
    requestMediaLibraryPermission(),
    requestLocationPermission(),
    requestNotificationPermission(),
  ]);

  return {
    camera:
      camera.status === 'fulfilled' && camera.value.granted,
    mediaLibrary:
      media.status === 'fulfilled' && media.value.granted,
    location:
      location.status === 'fulfilled' && location.value.granted,
    notifications:
      notifications.status === 'fulfilled' && notifications.value.granted,
  };
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

/**
 * Mostra um diálogo nativo explicando por que a permissão é necessária
 * antes de solicitá-la ao sistema — boa prática para evitar rejeição na Play Store.
 */
export function showPermissionRationale(
  title: string,
  message: string,
  onConfirm: () => void
): void {
  Alert.alert(title, message, [
    { text: 'Agora não', style: 'cancel' },
    { text: 'Continuar', onPress: onConfirm },
  ]);
}
