const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { loadAppVariantEnv } = require('./scripts/load-app-variant-env.js');

loadAppVariantEnv(path.resolve(__dirname));

const config = getDefaultConfig(__dirname);

// Stub react-native-maps on web to prevent native-only module bundling errors.
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'react-native-maps' ||
      moduleName.startsWith('react-native-maps/'))
  ) {
    // Return an empty module stub so Metro never touches the native internals.
    return {
      type: 'empty',
    };
  }
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
