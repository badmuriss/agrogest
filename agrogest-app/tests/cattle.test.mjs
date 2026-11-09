import assert from 'node:assert/strict';
import { test } from 'node:test';

import { breakEvenPerArrobaCents, estimatedArrobas, saleGrossCents } from '../apps/mobile/src/domain/cattle.ts';

test('live weight becomes carcass arrobas with the reference yield (300 kg vivos = 10 @)', () => {
  assert.equal(estimatedArrobas(300), 10);
  assert.equal(estimatedArrobas(300, 0.54), 10.8);
});

test('break-even price per arroba divides the remaining cost by the estimated arrobas', () => {
  // 40 cab. × 300 kg × 50% ÷ 15 = 400 @; R$ 127.135,11 ÷ 400 = R$ 317,84/@
  assert.equal(breakEvenPerArrobaCents(12_713_511, 40, 300), 31_784);
  // Vendendo a esse preço, a receita bruta cobre o custo (diferença só de arredondamento).
  const revenue = saleGrossCents(40 * 300 * 0.5, 31_784);
  assert.ok(Math.abs(revenue - 12_713_511) < 400);
});

test('no heads, no weight or no cost gives no break-even', () => {
  assert.equal(breakEvenPerArrobaCents(10_000, 0, 300), null);
  assert.equal(breakEvenPerArrobaCents(10_000, 10, 0), null);
  assert.equal(breakEvenPerArrobaCents(0, 10, 300), null);
});
