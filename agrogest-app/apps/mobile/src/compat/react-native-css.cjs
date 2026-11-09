// NativeWind 5 RC's React Native facade predates RN 0.88's public AssetRegistry.
// Keep its styled components and forward the registry from the real RN entry.
const styled = require('react-native-css/components');
const native = require('react-native');

module.exports = Object.defineProperties({}, {
  ...Object.getOwnPropertyDescriptors(styled),
  AssetRegistry: { enumerable: true, get: () => native.AssetRegistry },
});
