// O expo-sqlite na web usa WebAssembly e SharedArrayBuffer: o Metro precisa servir .wasm
// e o servidor de desenvolvimento precisa dos headers COOP/COEP.
// O withNativewind compila as classes Tailwind (NativeWind v5) para o React Native.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

const nativewindConfig = withNativewind(config, { inlineRem: 16 });
const nativewindResolve = nativewindConfig.resolver.resolveRequest;
const nativeEntry = require.resolve('react-native');
const cssCompatEntry = require.resolve('./src/compat/react-native-css.cjs');

// Preserve NativeWind's component mapping while exposing RN 0.88's asset API.
nativewindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web' && context.originModulePath === cssCompatEntry && moduleName === 'react-native') {
    return { type: 'sourceFile', filePath: nativeEntry };
  }
  const resolved = nativewindResolve
    ? nativewindResolve(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  if (platform !== 'web' && moduleName === 'react-native' && resolved.type === 'sourceFile'
    && /react-native-css[/\\].*components[/\\]index\.(?:cts|cjs|js)$/.test(resolved.filePath)) {
    return { type: 'sourceFile', filePath: cssCompatEntry };
  }
  return resolved;
};

module.exports = nativewindConfig;
