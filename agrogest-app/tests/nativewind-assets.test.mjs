import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('NativeWind keeps styled components and forwards the real RN asset registry', () => {
  const assets = [];
  const AssetRegistry = {
    registerAsset(asset) { assets.push(asset); return assets.length; },
    getAssetByID(id) { return assets[id - 1]; },
  };
  const styled = { View: () => 'styled-view', Text: () => 'styled-text' };
  const module = { exports: {} };
  const source = readFileSync(new URL('../apps/mobile/src/compat/react-native-css.cjs', import.meta.url), 'utf8');
  runInNewContext(source, { module, require(name) {
    if (name === 'react-native-css/components') return styled;
    if (name === 'react-native') return { AssetRegistry, View: () => 'unstyled-view' };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  const facade = module.exports;
  assert.equal(facade.View, styled.View);
  assert.equal(facade.Text, styled.Text);
  assert.ok(Object.keys(facade).includes('View'), 'namespace imports must retain styled exports');
  assert.equal(facade.AssetRegistry, AssetRegistry);
  const font = { name: 'Inter', type: 'ttf' };
  const id = AssetRegistry.registerAsset(font);
  assert.equal(facade.AssetRegistry.getAssetByID(id), font, 'font IDs resolve through the same registry as Metro assets');
});
