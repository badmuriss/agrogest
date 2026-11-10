import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startOcr } from '../agrogest-app/services/extraction/container.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const api = path.join(root, 'agrogest-app/apps/api');
if (!existsSync(path.join(root, 'agrogest-app/apps/mobile/dist/index.html'))) {
  const build = spawnSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const npmCommand = process.env.npm_execpath ? process.execPath : 'npm';
const npmArgs = process.env.npm_execpath ? [process.env.npm_execpath, 'run', 'migrate'] : ['run', 'migrate'];
const migration = spawnSync(npmCommand, npmArgs, { cwd: api, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
if (migration.status !== 0) process.exit(migration.status ?? 1);
const privatePath = path.join(api, '.dev.vars');
const config = existsSync(privatePath) ? Object.fromEntries(readFileSync(privatePath, 'utf8').split('\n').filter((line) => /^[A-Z_]+=/.test(line)).map((line) => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; })) : {};
let ocr, worker, vision, stopping = false;
function killWorker() {
  if (!worker?.pid || worker.exitCode !== null) return;
  if (process.platform === 'win32') worker.kill('SIGINT');
  else { try { process.kill(-worker.pid, 'SIGINT'); } catch {} }
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  killWorker(); vision?.kill('SIGTERM');
  try { await ocr?.stop(); }
  catch (error) { console.error(error.message); code = 1; }
  process.exitCode = code;
}
process.on('SIGINT', () => { void stop(); });
process.on('SIGTERM', () => { void stop(); });
async function startVisionIfConfigured() {
  if (config.INFERENCE_PROVIDER !== 'local-vision') return;
  const base = config.LOCAL_VISION_BASE_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base ?? '')) throw new Error('A IA visual deve usar endereço local.');
  const healthy = async () => { try { return (await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } };
  if (await healthy()) return; // Borrow a server explicitly started by the user.
  if (base !== 'http://127.0.0.1:8092') throw new Error('Inicie seu servidor de IA visual local antes do aplicativo.');
  vision = spawn('python', ['agrogest-app/services/extraction/vision-local.py', 'serve'], { cwd: root, stdio: 'inherit' });
  vision.on('error', (error) => { console.error(error.message); void stop(1); });
  vision.on('exit', (code) => { if (!stopping) { console.error('IA visual local encerrada.'); void stop(code || 1); } });
  for (let i = 0; i < 60 && !stopping; i++) {
    if (await healthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!stopping) throw new Error('IA visual indisponível. Execute npm run setup:vision ou selecione outro provedor no backend.');
}
try {
  ocr = await startOcr();
  if (stopping) await ocr.stop();
  else {
    await startVisionIfConfigured();
    if (!stopping) {
      worker = spawn(process.execPath, ['scripts/local.mjs', 'dev'], { cwd: api, stdio: 'inherit', detached: process.platform !== 'win32' });
      worker.on('error', (error) => { console.error(error.message); void stop(1); });
      worker.on('exit', (code) => { if (!stopping) void stop(code ?? 1); });
      console.log(`AgroGest local: http://127.0.0.1:8787 · OCR: ${ocr.url}${config.INFERENCE_PROVIDER === 'local-vision' ? ` · IA visual: ${config.LOCAL_VISION_BASE_URL}` : ''}`);
    }
  }
} catch (error) {
  console.error(error.message);
  await stop(1);
}
