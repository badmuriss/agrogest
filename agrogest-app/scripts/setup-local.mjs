import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { app, configure, npm, privateFile, providers, python, readConfig } from './local-config.mjs';
import { buildOcr } from '../services/extraction/container.mjs';
try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--provider' || !providers.includes(args[1]))) throw new Error('Use setup:local [--provider local|local-vision|workers-ai].');
  if (args.length || !existsSync(privateFile)) configure(args[1] ?? 'local');
  const config = readConfig();
  if (!providers.includes(config.INFERENCE_PROVIDER)) throw new Error('Selecione um provedor com npm run configure.');
  for (const directory of [app, path.join(app, 'apps/mobile'), path.join(app, 'apps/api')]) npm(['ci', '--no-audit', '--no-fund'], directory);
  if (config.INFERENCE_PROVIDER === 'local') await buildOcr();
  if (config.INFERENCE_PROVIDER === 'local-vision') {
    const result = spawnSync(python(), [path.join(app, 'services/extraction/vision-local.py'), 'setup'], { stdio: 'inherit' });
    if (result.error || result.status !== 0) throw new Error('Prepare a IA visual conforme o guia; launcher validado em Linux x86_64 com Python 3.12+.');
  }
  console.log(`Dependências instaladas. Modo ${config.INFERENCE_PROVIDER}. Execute npm run doctor, npm run build:web e npm start.`);
  if (config.INFERENCE_PROVIDER === 'workers-ai') console.log('Docker e GPU dispensados. Configure conta/token privados antes da primeira leitura.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
