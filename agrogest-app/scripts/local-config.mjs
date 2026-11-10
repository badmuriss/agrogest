import { existsSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
export const app = fileURLToPath(new URL('../', import.meta.url));
export const root = path.dirname(app.replace(/[\\/]$/, ''));
export const api = path.join(app, 'apps/api');
export const privateFile = path.join(api, '.dev.vars');
export const workersModel = '@cf/meta/llama-4-scout-17b-16e-instruct';
export const providers = ['local', 'local-vision', 'workers-ai'];
export function parseVars(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) { try { value = JSON.parse(value); } catch { throw new Error(`Valor inválido em ${match[1]}; confira as aspas no arquivo privado.`); } }
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    values[match[1]] = value;
  }
  return values;
}
export const readConfig = (file = privateFile) => ({ ...JSON.parse(readFileSync(path.join(api, 'wrangler.jsonc'), 'utf8')).vars, ...(existsSync(file) ? parseVars(readFileSync(file, 'utf8')) : {}) });
export function configure(provider, file = privateFile) {
  if (!providers.includes(provider)) throw new Error('Use --provider local, local-vision ou workers-ai.');
  const previous = existsSync(file) ? readFileSync(file, 'utf8') : readFileSync(path.join(api, '.dev.vars.example'), 'utf8');
  const existing = parseVars(previous);
  const updates = { APP_ENV: 'local', INFERENCE_PROVIDER: provider, INFERENCE_REMOTE_ALLOWED: provider === 'workers-ai' ? 'true' : 'false', WORKERS_AI_TRANSPORT: 'rest' };
  if (!existing.WORKERS_AI_MODEL) updates.WORKERS_AI_MODEL = workersModel;
  if (!existing.LOCAL_VISION_BASE_URL) updates.LOCAL_VISION_BASE_URL = 'http://127.0.0.1:8092';
  if (!existing.LOCAL_VISION_MODEL) updates.LOCAL_VISION_MODEL = 'agrogest-vision';
  const keys = new Set();
  const lines = previous.split(/\r?\n/).filter(line => !/^\s*OPENROUTER_[A-Z0-9_]*\s*=/.test(line)).map(line => {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (!match || !(match[1] in updates)) return line;
    if (keys.has(match[1])) return null;
    keys.add(match[1]); return `${match[1]}=${JSON.stringify(updates[match[1]])}`;
  }).filter(line => line !== null);
  for (const [key, value] of Object.entries(updates)) if (!keys.has(key)) lines.push(`${key}=${JSON.stringify(value)}`);
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${lines.join('\n').trim()}\n`, { mode: 0o600 });
  renameSync(temporary, file); chmodSync(file, 0o600);
  return readConfig(file);
}
export function configurationProblems(config) {
  const errors = [];
  if (config.APP_ENV !== 'local') errors.push('APP_ENV deve ser local no desenvolvimento.');
  if (!providers.includes(config.INFERENCE_PROVIDER)) errors.push('Provedor inválido: use npm run configure -- --provider local|local-vision|workers-ai.');
  if (config.INFERENCE_PROVIDER === 'local' && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(config.LOCAL_OCR_BASE_URL ?? '')) errors.push('LOCAL_OCR_BASE_URL deve apontar para loopback.');
  if (config.INFERENCE_PROVIDER === 'local-vision') {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(config.LOCAL_VISION_BASE_URL ?? '')) errors.push('LOCAL_VISION_BASE_URL deve apontar para loopback.');
    for (const name of ['LOCAL_VISION_MODEL', 'LOCAL_VISION_API_KEY']) if (!config[name]) errors.push(`Falta ${name}; execute npm run setup:vision ou configure seu servidor local.`);
  }
  if (config.INFERENCE_PROVIDER === 'workers-ai') {
    if (config.INFERENCE_REMOTE_ALLOWED !== 'true') errors.push('INFERENCE_REMOTE_ALLOWED deve ser true para Workers AI.');
    if (config.WORKERS_AI_TRANSPORT !== 'rest') errors.push('Use WORKERS_AI_TRANSPORT=rest localmente, sem binding AI remoto.');
    if (!/^[a-f0-9]{32}$/.test(config.WORKERS_AI_ACCOUNT_ID ?? '')) errors.push('Configure WORKERS_AI_ACCOUNT_ID na configuração privada do backend.');
    if (!config.WORKERS_AI_API_TOKEN) errors.push('Configure WORKERS_AI_API_TOKEN na configuração privada do backend.');
    if (config.WORKERS_AI_MODEL !== workersModel) errors.push('WORKERS_AI_MODEL deve selecionar o modelo visual Scout documentado.');
  }
  return errors;
}
export function npm(args, cwd, extraEnv = {}) {
  const command = process.env.npm_execpath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const argv = process.env.npm_execpath ? [process.env.npm_execpath, ...args] : args;
  const result = spawnSync(command, argv, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  if (result.error) throw new Error(`Não foi possível iniciar npm: ${result.error.code}.`);
  if (result.status !== 0) throw new Error(`npm ${args[0]} falhou (${result.status}).`);
}
export const python = () => process.env.AGROGEST_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
