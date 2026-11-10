import { existsSync, readFileSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { api, app, npm, root } from './local-config.mjs';
import { prepareCloud, validateCloud, bootstrapSql } from './cloud-config.mjs';
try {
  const [mode, flag, environment = 'staging', ...extra] = process.argv.slice(2);
  if (!['prepare', 'check', 'bootstrap'].includes(mode) || extra.length || flag && flag !== '--env' || !['staging', 'production'].includes(environment)) throw new Error('Use cloud:prepare|cloud:check|cloud:bootstrap [--env staging|production]. Nenhum desses comandos publica recursos.');
  const directory = path.join(app, '.local/cloud', environment), settingsFile = path.join(directory, 'settings.json');
  mkdirSync(directory, { recursive: true });
  if (mode === 'check') {
    // Deliberately synthetic IDs. Only offline packaging; never uses account credentials or inference.
    const checkDir = path.join(app, '.local/cloud', 'check', environment);
    const settings = { environment, accountId: 'a'.repeat(32), workerName: `agrogest-check-${environment}`, origin: `https://agrogest-check-${environment}.offline-test.workers.dev`, databaseName: `agrogest-check-${environment}`, databaseId: '11111111-1111-4111-8111-111111111111', bucketName: `agrogest-check-${environment}`, inferenceTransport: 'binding' };
    prepareCloud(settings, checkDir);
    npm(['run', 'build:web', '--', '--target', 'cloud'], root);
    const env = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true', CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false' };
    for (const key of Object.keys(env)) if (/^(CLOUDFLARE_|CF_|WORKERS_AI_|OPENROUTER_)/.test(key)) delete env[key];
    env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false';
    const result = spawnSync(process.execPath, [path.join(api, 'node_modules/wrangler/bin/wrangler.js'), 'deploy', '--dry-run', '--config', path.join(checkDir, 'wrangler.jsonc'), '--env', environment, '--outdir', path.join(checkDir, 'bundle')], { cwd: checkDir, stdio: 'inherit', env });
    if (result.error || result.status !== 0) throw new Error('Falha no empacotamento offline do Worker.');
    console.log('Bundle Cloudflare verificado por dry-run com IDs sintéticos. Nenhum deploy, provisionamento, migration remota ou inferência executados.');
  } else if (mode === 'prepare') {
    if (!existsSync(settingsFile)) {
      const example = JSON.parse(readFileSync(path.join(api, 'cloud.example.json'), 'utf8'));
      Object.assign(example, { environment, workerName: `agrogest-${environment}`, databaseName: `agrogest-${environment}`, bucketName: `agrogest-documents-${environment}` });
      writeFileSync(settingsFile, JSON.stringify(example, null, 2) + '\n', { mode: 0o600 });
      console.log(`Modelo privado criado em ${settingsFile}. Preencha os IDs/origem da conta futura e execute novamente. Nenhum recurso foi criado.`);
    } else {
      const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
      validateCloud(settings, environment);
      const otherFile = path.join(app, '.local/cloud', environment === 'staging' ? 'production' : 'staging', 'settings.json');
      if (existsSync(otherFile)) {
        const other = JSON.parse(readFileSync(otherFile, 'utf8'));
        if (other.accountId === settings.accountId && ['workerName', 'databaseId', 'bucketName'].some(key => other[key] === settings[key])) throw new Error('Staging e produção devem usar Workers, bancos e buckets distintos.');
      }
      prepareCloud(settings, directory);
      console.log(`Configuração privada gerada em ${directory}. Migrations incluem somente schema e limite de inferência; nenhuma conta/senha pública de demonstração. Veja o guia antes de qualquer publicação futura.`);
    }
  } else {
    const input = path.join(directory, 'accounts.json');
    if (!existsSync(input)) {
      writeFileSync(input, JSON.stringify([{ name: '', email: '', password: '' }], null, 2) + '\n', { mode: 0o600 });
      console.log(`Preencha as contas privadas em ${input} e execute novamente. Este arquivo contém senhas; fica ignorado no Git.`);
    } else {
      chmodSync(input, 0o600);
      writeFileSync(path.join(directory, 'bootstrap.sql'), bootstrapSql(JSON.parse(readFileSync(input, 'utf8')), environment), { mode: 0o600 });
      console.log('bootstrap.sql privado gerado somente com hashes PBKDF2 e identidades próprias. Nenhuma conta foi criada em banco local ou remoto. Remova accounts.json com segurança após guardar as senhas no gerenciador do responsável.');
    }
  }
} catch (error) { console.error(error instanceof SyntaxError ? 'JSON de configuração inválido. Confira o arquivo privado, sem compartilhar seu conteúdo.' : error.message); process.exitCode = 1; }
