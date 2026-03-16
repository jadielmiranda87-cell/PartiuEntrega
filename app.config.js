module.exports = {
  expo: {
    name: 'PartiuEntrega',
    slug: 'partiuentrega',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'motolink',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    icon: './assets/images/logo.png',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.partiuentrega.app',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/logo.png',
        backgroundColor: '#FF6B00',
      },
      package: 'com.partiuentrega.app',
      edgeToEdgeEnabled: true,
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
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
