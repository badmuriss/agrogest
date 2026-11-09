import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startOcr } from '../agrogest-app/services/extraction/container.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const api = path.join(root, 'agrogest-app/apps/api');
if (!existsSync(path.join(root, 'agrogest-app/apps/mobile/dist/index.html'))) {
  const build = spawnSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root, stdio: 'inherit' }); if (build.status) process.exit(build.status);
}
const migration = spawnSync('npm', ['run', 'migrate'], { cwd: api, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
if (migration.status !== 0) process.exit(migration.status ?? 1);
let ocr, worker, stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  worker?.kill('SIGINT');
  try { await ocr?.stop(); }
  catch (error) { console.error(error.message); code = 1; }
  process.exitCode = code;
}
try {
  ocr = await startOcr();
  worker = spawn(process.execPath, ['scripts/local.mjs', 'dev'], { cwd: api, stdio: 'inherit', detached: process.platform !== 'win32' });
  // Forward shutdown to the complete local Wrangler process group on Unix.
  const killWorker = () => {
    if (worker.exitCode !== null) return;
    if (process.platform === 'win32') worker.kill('SIGINT');
    else { try { process.kill(-worker.pid, 'SIGINT'); } catch {} }
  };
  process.on('SIGINT', () => { killWorker(); void stop(); });
  process.on('SIGTERM', () => { killWorker(); void stop(); });
  worker.on('error', (error) => { console.error(error.message); void stop(1); });
  worker.on('exit', (code) => { if (!stopping) void stop(code ?? 1); });
  console.log(`AgroGest local: http://127.0.0.1:8787 · OCR em Docker/CPU: ${ocr.url}`);
} catch (error) {
  console.error(error.message);
  await stop(1);
}
