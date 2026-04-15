const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = 'flavorDimensions "appvariant"';

function injectFlavors(contents) {
  if (contents.includes(MARK)) return contents;
  return contents.replace(
    /(\n\s*buildTypes\s*\{)/,
    `
    flavorDimensions "appvariant"
    productFlavors {
        client {
            dimension "appvariant"
            applicationId 'com.fastfood.app'
            resValue "string", "app_name", "FastFud"
        }
        business {
            dimension "appvariant"
            applicationId 'com.fastfood.comercio'
            resValue "string", "app_name", "FastFood Comércio"
        }
        motoboy {
            dimension "appvariant"
            applicationId 'com.fastfood.entregador'
            resValue "string", "app_name", "FastFood Entregador"
        }
    }
$1`
  );
}

function injectDebuggableVariants(contents) {
  if (contents.includes('debuggableVariants = ["clientDebug"')) return contents;
  if (/\/\/ debuggableVariants = \["liteDebug", "prodDebug"\]/.test(contents)) {
    return contents.replace(
      /\/\/ debuggableVariants = \["liteDebug", "prodDebug"\]/,
      'debuggableVariants = ["clientDebug", "businessDebug", "motoboyDebug"]'
    );
  }
  return contents.replace(
    /(react \{\s*\n)(\s*entryFile =)/,
    `$1    debuggableVariants = ["clientDebug", "businessDebug", "motoboyDebug"]
$2`
  );
}

function withAndroidAppVariants(config) {
  return withAppBuildGradle(config, (mod) => {
    let c = mod.modResults.contents;
    c = injectDebuggableVariants(c);
    c = injectFlavors(c);
    // Removemos a injeção de environment que causa erro no RN 0.79
    mod.modResults.contents = c;
    return mod;
  });
}

module.exports = withAndroidAppVariants;
