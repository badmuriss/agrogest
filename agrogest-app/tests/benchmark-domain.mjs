// Synthetic Node benchmark, not mobile/production performance. No network or database writes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { workspaceFixture, entry, today } from './fixtures/workspace.mjs';

const ref = process.argv[2] ?? '698aa64';
const cwd = fileURLToPath(new URL('../../', import.meta.url));
const prefix = 'agrogest-app/apps/mobile/src/domain/';
const directory = await mkdtemp(join(tmpdir(), 'agrogest-benchmark-'));
const baselineUrl = pathToFileURL(directory).href + '/';
const hook = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(baselineUrl) && specifier.startsWith('./') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
});

try {
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', prefix], { cwd, encoding: 'utf8' }).trim().split('\n');
  await mkdir(join(directory, 'domain'));
  await Promise.all(paths.filter((p) => p.endsWith('.ts')).map(async (path) => {
    const source = execFileSync('git', ['show', `${ref}:${path}`], { cwd, encoding: 'utf8' });
    await writeFile(join(directory, 'domain', path.slice(prefix.length)), source);
  }));
  const load = async (base) => Object.fromEntries(await Promise.all(['finance', 'stock', 'lot-metrics', 'format', 'reports', 'bank-import', 'export'].map(async (name) => [name, await import(new URL(`domain/${name}.ts`, base))])));
  const before = await load(baselineUrl);
  const after = await load(new URL('../apps/mobile/src/', import.meta.url));
  const snapshot = workspaceFixture(200, 30);
  const { lots, entries, payments, farms, supplies } = snapshot;
  const periodLots = lots.map((lot) => ({ ...lot, purchasedAt: '2026-07-01' }));
  const periodEntries = [...entries, ...periodLots.flatMap((lot) => [
    entry(`death-${lot.id}`, 'mortalidade', { lotId: lot.id, heads: 2 }, { occurredAt: '2026-08-15' }),
    entry(`sale-${lot.id}`, 'venda', { lotId: lot.id, heads: 5, carcassKg: 1000, pricePerArrobaCents: 30000, deductionsCents: 0 }, { occurredAt: '2026-09-20' }),
  ])];
  const reportSnapshot = workspaceFixture(2000, 0);
  const reportViews = after.finance.installmentViews(reportSnapshot.entries, reportSnapshot.payments, today);
  const reportBook = {
    ...reportSnapshot, categories: after.finance.DEFAULT_CATEGORIES,
    farmIds: new Set(['f1', 'f2']), operationIds: new Set(['o1']),
    lotSummaries: [], views: reportViews, invoices: [], occurrences: [], today,
  };
  const bankViews = reportViews.map((view, i) => ({ ...view, cents: 10000 + i, openCents: 10000 + i }));
  const bankLines = bankViews.slice(0, 1000).map((view, i) => ({ id: `line${i}`, date: today, cents: -view.openCents, description: `Extrato ${i}` }));
  const period = { from: '2026-10-01', to: '2026-10-31' };
  const names = { user: (id) => id, account: (id) => id ?? '', farm: (id) => id };
  const scenarios = [
    ['installments',
      () => before.finance.installmentViews(entries, payments, today),
      () => after.finance.installmentViews(entries, payments, today)],
    ['stock costs', () => before.stock.costEntries(entries), () => after.stock.costEntries(entries)],
    ['stock positions',
      () => before.stock.stockPositions(supplies, entries, ['f1', 'f2'], today),
      () => after.stock.stockPositions(supplies, entries, ['f1', 'f2'], today)],
    ['consumption allocation (92 days)',
      () => before.stock.consumptionTargets(periodLots, periodEntries, 'peso', today, '2026-07-23', {}),
      () => after.stock.consumptionTargets(periodLots, periodEntries, 'peso', today, '2026-07-23', {})],
    ['cash lines (2000 payments)',
      () => before.reports.cashLines(reportBook, period),
      () => after.reports.cashLines(reportBook, period)],
    ['accountant package (2000 payments)',
      () => before.export.accountantPackage(reportBook, period, names),
      () => after.export.accountantPackage(reportBook, period, names)],
    ['bank matches (1000 lines)',
      () => before['bank-import'].suggestMatches(bankLines, bankViews, reportSnapshot.payments),
      () => after['bank-import'].suggestMatches(bankLines, bankViews, reportSnapshot.payments)],
    ['lot summaries (3 reads)',
      () => Array.from({ length: 3 }, () => lots.map((lot) => before['lot-metrics'].summarizeLot(lot, entries, farms.find((f) => f.id === lot.farmId).pastureRentCents, today))),
      () => {
        const summarize = after['lot-metrics'].createLotSummarizer(lots, entries, farms, today);
        return Array.from({ length: 3 }, () => lots.map((lot) => summarize(lot.id)));
      }],
    ['format 1000 numbers',
      () => Array.from({ length: 1000 }, (_, i) => before.format.formatNumber(i * 123.456, i % 4)),
      () => Array.from({ length: 1000 }, (_, i) => after.format.formatNumber(i * 123.456, i % 4))],
  ];
  function medianMs(run) {
    for (let i = 0; i < 3; i++) run();
    const samples = Array.from({ length: 9 }, () => {
      const start = performance.now();
      run();
      return performance.now() - start;
    }).sort((a, b) => a - b);
    return samples[4];
  }
  console.log(`Baseline: ${ref}; ${lots.length} lots; ${supplies.length} supplies; ${entries.length} entries; ${payments.length} payments.`);
  console.log(`Period allocation: ${periodLots.length} lots / ${periodEntries.length} entries; reports: ${reportSnapshot.payments.length} payments / ${reportViews.length} installments; bank: ${bankLines.length} lines.`);
  const rows = scenarios.map(([scenario, previous, current]) => {
    assert.deepEqual(current(), previous(), scenario);
    const beforeMs = medianMs(previous);
    const afterMs = medianMs(current);
    return { scenario, beforeMs: beforeMs.toFixed(3), afterMs: afterMs.toFixed(3), reduction: `${((1 - afterMs / beforeMs) * 100).toFixed(1)}%` };
  });
  console.table(rows);
} finally {
  hook.deregister();
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
  assert.ok(basename(directory).startsWith('agrogest-benchmark-'));
  await rm(directory, { recursive: true, force: true });
}
