const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { loadAppVariantEnv } = require('./scripts/load-app-variant-env.js');

loadAppVariantEnv(path.resolve(__dirname));

module.exports = getDefaultConfig(__dirname);
