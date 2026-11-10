import { readFileSync, mkdirSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { api, workersModel } from './local-config.mjs';
export const cloudMigrations = ['0001_domain.sql', '0003_inference_usage.sql'];
export function validateCloud(settings, environment) {
  const problems = [];
  if (!['staging', 'production'].includes(environment) || settings.environment !== environment) problems.push('environment deve corresponder a staging ou production selecionado.');
  if (!/^[a-f0-9]{32}$/.test(settings.accountId ?? '')) problems.push('accountId: informe o ID da conta que hospedará o app.');
  for (const field of ['workerName', 'databaseName', 'bucketName']) if (!/^[a-z][a-z0-9-]{2,62}$/.test(settings[field] ?? '')) problems.push(`${field}: use de 3 a 63 letras minúsculas, números e hífens.`);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(settings.databaseId ?? '') || /^00000000-/.test(settings.databaseId ?? '')) problems.push('databaseId: informe o UUID do D1 do ambiente futuro, distinto do banco local.');
  try {
    const url = new URL(settings.origin);
    if (url.protocol !== 'https:' || url.origin !== settings.origin || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.hostname.endsWith('.workers.dev') || url.hostname.split('.')[0] !== settings.workerName) throw new Error();
  } catch { problems.push('origin: informe https://<workerName>.<subdomínio-da-conta>.workers.dev, sem caminho/barra final. Domínio personalizado exige configuração própria.'); }
  if (!['binding', 'rest'].includes(settings.inferenceTransport)) problems.push('inferenceTransport deve ser binding ou rest.');
  if (settings.inferenceTransport === 'rest' && !/^[a-f0-9]{32}$/.test(settings.inferenceAccountId ?? '')) problems.push('inferenceAccountId é obrigatório no transporte REST.');
  if (problems.length) throw new Error(problems.join('\n'));
}
export function cloudConfig(settings, directory) {
  validateCloud(settings, settings.environment);
  const local = JSON.parse(readFileSync(path.join(api, 'wrangler.jsonc'), 'utf8'));
  const environment = {
    name: settings.workerName, account_id: settings.accountId, workers_dev: true, preview_urls: false,
    vars: { APP_ENV: settings.environment, FRONTEND_ORIGIN: settings.origin, INFERENCE_PROVIDER: 'workers-ai', INFERENCE_REMOTE_ALLOWED: 'true', WORKERS_AI_MODEL: workersModel, WORKERS_AI_TRANSPORT: settings.inferenceTransport, INFERENCE_TIMEOUT_MS: '45000', INFERENCE_MAX_OUTPUT_TOKENS: '1200', ...(settings.inferenceTransport === 'rest' ? { WORKERS_AI_ACCOUNT_ID: settings.inferenceAccountId } : {}) },
    d1_databases: [{ binding: 'DB', database_name: settings.databaseName, database_id: settings.databaseId, migrations_dir: path.join(directory, 'migrations') }],
    r2_buckets: [{ binding: 'DOCUMENTS', bucket_name: settings.bucketName }],
    assets: { ...local.assets, directory: path.resolve(api, local.assets.directory) },
    ...(settings.inferenceTransport === 'binding' ? { ai: { binding: 'AI' } } : {}),
  };
  return { $schema: path.join(api, 'node_modules/wrangler/config-schema.json'), main: path.resolve(api, local.main), compatibility_date: local.compatibility_date, workers_dev: false, preview_urls: false, send_metrics: false, env: { [settings.environment]: environment } };
}
export function prepareCloud(settings, directory) {
  const config = cloudConfig(settings, directory);
  mkdirSync(path.join(directory, 'migrations'), { recursive: true });
  if (readdirSync(path.join(directory, 'migrations')).some(name => name.endsWith('.sql') && !cloudMigrations.includes(name))) throw new Error('O pacote cloud contém migration não prevista. Revise os arquivos gerados antes de continuar; nenhum arquivo foi apagado.');
  for (const name of cloudMigrations) copyFileSync(path.join(api, 'migrations', name), path.join(directory, 'migrations', name));
  writeFileSync(path.join(directory, 'wrangler.jsonc'), JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  return config;
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
export function bootstrapSql(accounts, environment) {
  if (!['staging', 'production'].includes(environment) || !Array.isArray(accounts) || !accounts.length || accounts.length > 20) throw new Error('Informe de 1 a 20 contas privadas para staging ou production.');
  const seen = new Set(), statements = ['-- PRIVATE: generated offline; account creation only, no public demo data or plaintext password.'];
  for (const account of accounts) {
    const email = String(account.email ?? '').trim().toLowerCase(), name = String(account.name ?? '').trim();
    if (!/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(email) || email.endsWith('@agrogest.local') || email.length > 254 || !name || name.length > 160 || /[\u0000-\u001f]/.test(name) || typeof account.password !== 'string' || account.password.length < 12 || account.password.length > 128 || account.password === 'AgroGest2026!' || seen.has(email)) throw new Error('Conta inválida: use nome, e-mail próprio único e senha privada de 12 a 128 caracteres; não use contas de demonstração.');
    seen.add(email);
    const id = `user-${createHash('sha256').update(`${environment}:${email}`).digest('hex').slice(0, 32)}`;
    const salt = randomBytes(24).toString('hex'), hash = pbkdf2Sync(account.password, salt, 100000, 32, 'sha256').toString('hex');
    statements.push(`INSERT INTO identities(id,email,name,password_hash,password_salt,confirmed) VALUES(${[id, email, name, hash, salt].map(quote).join(',')},1) ON CONFLICT(id) DO NOTHING;`);
    statements.push(`INSERT INTO entities(collection,id,operation_id,data) VALUES('users',${quote(id)},NULL,${quote(JSON.stringify({ id, email, name }))}) ON CONFLICT(collection,id) DO NOTHING;`);
  }
  statements.push('UPDATE revisions SET version=version+1 WHERE id=1;');
  return statements.join('\n') + '\n';
}
