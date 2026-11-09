import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// This entry point has no deploy/provisioning branch and never invokes a remote command.
const mode = process.argv[2];
if (!['dev', 'migrate'].includes(mode) || process.argv.length !== 3) throw new Error('Use dev ou migrate; somente execução local.');
const state = fileURLToPath(new URL('../../../.local/cloudflare', import.meta.url));
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };
for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CF_API_TOKEN']) delete env[name];
const args = mode === 'dev'
  ? ['dev', '--local', '--ip', '127.0.0.1', '--port', '8787', '--persist-to', state]
  : ['d1', 'migrations', 'apply', 'agrogest-local', '--local', '--persist-to', state];
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', ...args], { stdio: 'inherit', env });
process.exit(result.status ?? 1);
