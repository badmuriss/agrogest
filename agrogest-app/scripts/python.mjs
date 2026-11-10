import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { app, python } from './local-config.mjs';
const [service, mode, ...extra] = process.argv.slice(2);
if (!['vision', 'ocr'].includes(service) || !['setup', 'serve'].includes(mode) || extra.length) throw new Error('Use vision|ocr setup|serve.');
const file = service === 'vision' ? 'vision-local.py' : mode === 'setup' ? 'setup.py' : 'server.py';
const result = spawnSync(python(), [path.join(app, 'services/extraction', file), ...(service === 'vision' ? [mode] : [])], { stdio: 'inherit' });
if (result.error) console.error('Python não encontrado. Instale a versão indicada no guia ou configure AGROGEST_PYTHON.');
process.exitCode = result.status ?? (result.signal === 'SIGINT' ? 0 : 1);
