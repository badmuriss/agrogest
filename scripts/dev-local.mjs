import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const api = path.join(root, 'agrogest-app/apps/api');
if (!existsSync(path.join(root, 'agrogest-app/apps/mobile/dist/index.html'))) {
  const build = spawnSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root, stdio: 'inherit' }); if (build.status) process.exit(build.status);
}
for (const [command, args, cwd] of [['python', ['setup.py'], path.join(root, 'agrogest-app/services/extraction')], ['npm', ['run', 'migrate'], api]]) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } }); if (result.status) process.exit(result.status);
}
const children = [spawn('python', ['server.py'], { cwd: path.join(root, 'agrogest-app/services/extraction'), stdio: 'inherit' }), spawn('npm', ['run', 'dev'], { cwd: api, stdio: 'inherit' })];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGINT'); process.exitCode = code; }
for (const child of children) { child.on('error', () => stop(1)); child.on('exit', (code) => { if (!stopping) stop(code ?? 1); }); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
console.log('AgroGest local: http://127.0.0.1:8787 · OCR: http://127.0.0.1:8091');
