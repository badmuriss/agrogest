import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startOcr } from '../services/extraction/container.mjs';
import { api, root, configure, configurationProblems, npm, privateFile, providers, python, readConfig } from './local-config.mjs';
if (!existsSync(privateFile)) configure('local');
const config = readConfig();
if (!providers.includes(config.INFERENCE_PROVIDER) || config.APP_ENV !== 'local') throw new Error('Configure um provedor suportado e APP_ENV=local; use npm run configure.');
const problems = configurationProblems(config);
if (config.INFERENCE_PROVIDER !== 'workers-ai' && problems.length) throw new Error(problems.join('\n'));
for (const problem of problems) console.warn(problem);
if (!existsSync(path.join(root, 'agrogest-app/apps/mobile/dist/index.html'))) {
  const build = spawnSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
npm(['run', 'migrate'], api, { WRANGLER_SEND_METRICS: 'false' });
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
  vision = spawn(python(), ['agrogest-app/services/extraction/vision-local.py', 'serve'], { cwd: root, stdio: 'inherit' });
  vision.on('error', (error) => { console.error(error.message); void stop(1); });
  vision.on('exit', (code) => { if (!stopping) { console.error('IA visual local encerrada.'); void stop(code || 1); } });
  for (let i = 0; i < 60 && !stopping; i++) {
    if (await healthy()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!stopping) throw new Error('IA visual indisponível. Execute npm run setup:vision ou selecione outro provedor no backend.');
}
try {
  if (config.INFERENCE_PROVIDER === 'local') {
    if (config.LOCAL_OCR_BASE_URL !== 'http://127.0.0.1:8091') {
      const response = await fetch(`${config.LOCAL_OCR_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error('Inicie seu OCR local na porta configurada.');
    } else ocr = await startOcr();
  }
  if (stopping) await ocr?.stop();
  else {
    await startVisionIfConfigured();
    if (!stopping) {
      worker = spawn(process.execPath, ['scripts/local.mjs', 'dev'], { cwd: api, stdio: 'inherit', detached: process.platform !== 'win32' });
      worker.on('error', (error) => { console.error(error.message); void stop(1); });
      worker.on('exit', (code) => { if (!stopping) void stop(code ?? 1); });
      console.log(`AgroGest: http://127.0.0.1:${process.env.AGROGEST_PORT ?? '8787'} · análise ${config.INFERENCE_PROVIDER}. App/D1/R2 locais; Ctrl+C encerra os serviços iniciados aqui.`);
    }
  }
} catch (error) {
  console.error(error.message);
  await stop(1);
}
