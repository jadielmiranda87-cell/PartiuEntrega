const variant = process.env.EXPO_PUBLIC_APP_VARIANT || 'client';

const VARIANTS = {
  client: {
    name: 'FastFud',
    slug: 'fastfood',
    scheme: 'fastfood',
    iosBundle: 'com.fastfood.app',
    androidPackage: 'com.fastfood.app',
  },
  business: {
    name: 'FastFood Comércio',
    slug: 'fastfood-comercio',
    scheme: 'fastfood-comercio',
    iosBundle: 'com.fastfood.comercio',
    androidPackage: 'com.fastfood.comercio',
  },
  motoboy: {
    name: 'FastFood Entregador',
    slug: 'fastfood-entregador',
    scheme: 'fastfood-entregador',
    iosBundle: 'com.fastfood.entregador',
    androidPackage: 'com.fastfood.entregador',
  },
};

const v = VARIANTS[variant] || VARIANTS.client;
/** Textos de permissão: nome do app instalado neste build. */
const BRAND = v.name;

module.exports = {
  expo: {
    name: v.name,
    // Deve coincidir com o app no EAS (extra.eas.projectId); variantes usam EXPO_PUBLIC_APP_VARIANT no build.
    slug: 'partiuentrega',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: v.scheme,
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    icon: './assets/images/logo.png',
    ios: {
      supportsTablet: false,
      bundleIdentifier: v.iosBundle,
      infoPlist: {
        NSCameraUsageDescription: `O ${BRAND} usa a câmera para fotografar sua CNH e tirar sua selfie de verificação de identidade, conforme exigido para cadastro de entregadores.`,
        NSPhotoLibraryUsageDescription: `O ${BRAND} acessa sua galeria somente para selecionar fotos da CNH para verificação de identidade.`,
        NSPhotoLibraryAddUsageDescription: `O ${BRAND} salva comprovantes de documentos no seu dispositivo.`,
        NSLocationWhenInUseUsageDescription: `O ${BRAND} usa sua localização para calcular rotas de entrega e encontrar entregadores próximos ao comércio.`,
        NSLocationAlwaysAndWhenInUseUsageDescription: `O ${BRAND} usa sua localização em segundo plano para acompanhar entregas em andamento em tempo real.`,
        NSUserNotificationUsageDescription: `O ${BRAND} envia alertas sobre novos pedidos de entrega e atualizações do status do seu cadastro.`,
        UIBackgroundModes: ['remote-notification', 'fetch'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#EA580C',
      },
      package: v.androidPackage,
      edgeToEdgeEnabled: true,
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.VIBRATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.SCHEDULE_EXACT_ALARM',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        'android.permission.CALL_PHONE',
      ],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/logo.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/logo.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#F8F6F3',
        },
      ],
      'expo-web-browser',
      [
        'expo-image-picker',
        {
          photosPermission: `O ${BRAND} acessa sua galeria para selecionar fotos da CNH para verificação de identidade.`,
          cameraPermission: `O ${BRAND} usa a câmera para fotografar sua CNH e tirar a selfie de verificação de identidade.`,
          microphonePermission: false,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: `O ${BRAND} usa sua localização para calcular rotas de entrega e encontrar entregadores próximos.`,
          locationAlwaysAndWhenInUsePermission: `O ${BRAND} usa sua localização em segundo plano para acompanhar entregas em andamento.`,
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/images/logo.png',
          color: '#EA580C',
          sounds: [],
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: '068be17d-d5db-4cdf-9dc4-686ff6f7699c',
      },
    },
  },
};
