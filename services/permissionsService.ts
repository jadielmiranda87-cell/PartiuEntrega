/**
 * Serviço centralizado de permissões do app.
 * Solicita permissões com explicações em português antes de qualquer uso.
 * Nenhuma permissão é solicitada em segundo plano sem o consentimento explícito do usuário.
 */

import { Platform, Alert, PermissionsAndroid } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { APP_DISPLAY_NAME } from '@/constants/branding';

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
        `Permissão de câmera negada permanentemente. Acesse as Configurações do dispositivo > ${APP_DISPLAY_NAME} > Câmera para habilitar.`,
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
        `Acesso à galeria negado permanentemente. Acesse Configurações > ${APP_DISPLAY_NAME} > Fotos para habilitar.`,
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
        `Permissão de localização negada permanentemente. Acesse Configurações > ${APP_DISPLAY_NAME} > Localização e escolha "Ao usar o app".`,
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
        `Notificações bloqueadas. Acesse Configurações > ${APP_DISPLAY_NAME} > Notificações para habilitar alertas de novas entregas.`,
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

// ─── Localização em segundo plano ────────────────────────────────────────────

/**
 * Solicita permissão de localização em segundo plano.
 * Usada para rastrear entregas em andamento.
 */
export async function requestBackgroundLocationPermission(): Promise<PermissionResult> {
  if (Platform.OS === 'web') return { granted: false, reason: 'Não aplicável na web.' };

  const existing = await Location.getBackgroundPermissionsAsync();
  if (existing.status === 'granted') return { granted: true };

  if (!existing.canAskAgain) {
    return {
      granted: false,
      reason:
        `Localização em segundo plano negada. Acesse Configurações > ${APP_DISPLAY_NAME} > Localização para habilitar.`,
    };
  }

  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status === 'granted') return { granted: true };

  return {
    granted: false,
    reason: 'Localização em segundo plano necessária para rastrear entregas em tempo real.',
  };
}

// ─── Chamadas (Android) ──────────────────────────────────────────────────────

/**
 * Solicita permissão para realizar chamadas (Android).
 * Usada para contato com clientes e motoboys.
 */
export async function requestPhonePermission(): Promise<PermissionResult> {
  if (Platform.OS !== 'android') return { granted: true }; // iOS usa dialer sem permissão

  const perm = 'android.permission.CALL_PHONE' as const;
  const hasCallPhone = await PermissionsAndroid.check(perm);
  if (hasCallPhone) return { granted: true };

  const result = await PermissionsAndroid.request(perm, {
    title: 'Permissão de chamadas',
    message:
      `O ${APP_DISPLAY_NAME} precisa dessa permissão para ligar para clientes e entregadores durante as entregas.`,
    buttonNeutral: 'Perguntar depois',
    buttonNegative: 'Negar',
    buttonPositive: 'Permitir',
  });

  if (result === 'granted') return { granted: true };

  return {
    granted: false,
    reason: 'Permissão de chamadas necessária para contato durante entregas.',
  };
}

// ─── Solicitação em tempo de execução (ao instalar/primeiro uso) ──────────────

/**
 * Solicita todas as permissões essenciais na primeira abertura do app.
 * Executada em sequência para melhor UX (um diálogo por vez).
 */
export async function requestAllRuntimePermissions(): Promise<void> {
  if (Platform.OS === 'web') return;

  const permissions = [
    { fn: requestLocationPermission, name: 'Localização' },
    { fn: requestNotificationPermission, name: 'Notificações' },
    { fn: requestCameraPermission, name: 'Câmera' },
    { fn: requestMediaLibraryPermission, name: 'Galeria e arquivos' },
    { fn: requestBackgroundLocationPermission, name: 'Localização em segundo plano' },
    { fn: requestPhonePermission, name: 'Chamadas' },
  ];

  for (const { fn } of permissions) {
    try {
      await fn();
    } catch {
      // Ignora erros individuais, continua com as demais
    }
  }
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
