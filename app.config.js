module.exports = {
  expo: {
    name: 'PartiuEntrega',
    slug: 'partiuentrega',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'PartiuEntrega',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    icon: './assets/images/logo.png',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.partiuentrega.app',
      infoPlist: {
        // Câmera — para CNH e selfie
        NSCameraUsageDescription:
          'O PartiuEntrega usa a câmera para fotografar sua CNH e tirar sua selfie de verificação de identidade, conforme exigido para cadastro de entregadores.',
        // Galeria
        NSPhotoLibraryUsageDescription:
          'O PartiuEntrega acessa sua galeria somente para selecionar fotos da CNH para verificação de identidade.',
        NSPhotoLibraryAddUsageDescription:
          'O PartiuEntrega salva comprovantes de documentos no seu dispositivo.',
        // Localização
        NSLocationWhenInUseUsageDescription:
          'O PartiuEntrega usa sua localização para calcular rotas de entrega e encontrar motoboys próximos ao comércio.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'O PartiuEntrega usa sua localização em segundo plano para acompanhar entregas em andamento em tempo real.',
        // Notificações
        NSUserNotificationUsageDescription:
          'O PartiuEntrega envia alertas sobre novos pedidos de entrega e atualizações do status do seu cadastro.',
        // Background
        UIBackgroundModes: ['remote-notification', 'fetch'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#FF6B00',
      },
      package: 'com.partiuentrega.app',
      edgeToEdgeEnabled: true,
      permissions: [
        // Câmera
        'android.permission.CAMERA',
        // Armazenamento — leitura de arquivos e imagens
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        // Localização
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        // Notificações e alertas
        'android.permission.VIBRATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.SCHEDULE_EXACT_ALARM',
        // Foreground service (rastreamento de rota)
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        // Chamadas — contato com clientes e motoboys
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
          backgroundColor: '#0D0D0D',
        },
      ],
      'expo-web-browser',
      // Câmera e galeria — textos em pt-BR para iOS
      [
        'expo-image-picker',
        {
          photosPermission:
            'O PartiuEntrega acessa sua galeria para selecionar fotos da CNH para verificação de identidade.',
          cameraPermission:
            'O PartiuEntrega usa a câmera para fotografar sua CNH e tirar a selfie de verificação de identidade.',
          microphonePermission: false,
        },
      ],
      // Localização — textos em pt-BR para iOS
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'O PartiuEntrega usa sua localização para calcular rotas de entrega e encontrar motoboys próximos.',
          locationAlwaysAndWhenInUsePermission:
            'O PartiuEntrega usa sua localização em segundo plano para acompanhar entregas em andamento.',
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      // Notificações push
      [
        'expo-notifications',
        {
          icon: './assets/images/logo.png',
          color: '#FF6B00',
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
