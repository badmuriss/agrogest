import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const exec = promisify(execFile);
const app = fileURLToPath(new URL('../../', import.meta.url));
// Do not inherit a remote BuildKit host or load a workspace .env into Compose.
const env = { ...process.env, COMPOSE_BAKE: 'false', COMPOSE_DISABLE_ENV_FILE: 'true', BUILDX_BUILDER: 'default' };
delete env.BUILDKIT_HOST;

export function assertLocalEndpoint(endpoint) {
  if (!/^(unix:\/\/|npipe:\/\/)/.test(endpoint ?? '')) {
    throw new Error('Use um daemon Docker local (unix/npipe). Contextos Docker remotos não são permitidos nesta fase.');
  }
}

async function localDocker() {
  try {
    const { stdout } = await exec('docker', ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], { env });
    assertLocalEndpoint(JSON.parse(stdout.trim()));
    if (process.env.DOCKER_HOST) assertLocalEndpoint(process.env.DOCKER_HOST);
    const info = await exec('docker', ['info', '--format', '{{.OSType}}'], { env });
    if (info.stdout.trim() !== 'linux') throw new Error('Containers Linux necessários.');
  } catch (error) {
    if (error.message?.startsWith('Use um daemon')) throw error;
    throw new Error('Inicie o Docker local com Compose v2+ e containers Linux antes de executar o AgroGest.');
  }
}

function composeArgs(project, args) {
  if (!/^agrogest-[a-z0-9-]+$/.test(project)) throw new Error('Projeto Compose inválido.');
  return ['compose', '--project-name', project, '--file', path.join(app, 'compose.local.yaml'), ...args];
}

async function compose(project, args, { port = 8091, capture = false } = {}) {
  const options = { cwd: app, env: { ...env, AGROGEST_OCR_PUBLISHED_PORT: String(port) } };
  if (capture) return (await exec('docker', composeArgs(project, args), options)).stdout.trim();
  await new Promise((resolve, reject) => {
    const child = spawn('docker', composeArgs(project, args), { ...options, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Docker Compose falhou (${signal ?? code}).`)));
  });
}

export async function buildOcr({ project = 'agrogest-local', service = 'ocr' } = {}) {
  await localDocker();
  await compose(project, ['build', '--builder', 'default', service]);
}

export async function startOcr({ project = 'agrogest-local', port = 8091 } = {}) {
  await localDocker();
  const wasRunning = Boolean(await compose(project, ['ps', '--status', 'running', '--quiet', 'ocr'], { port, capture: true }));
  await buildOcr({ project });
  try {
    await compose(project, ['up', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '45', 'ocr'], { port });
    const address = await compose(project, ['port', 'ocr', '8091'], { port, capture: true });
    if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error('O OCR deve publicar somente em 127.0.0.1.');
    return { url: `http://${address}`, stop: async () => { if (!wasRunning) await stopOcr({ project }); } };
  } catch (error) {
    if (!wasRunning) await stopOcr({ project });
    throw error;
  }
}

export async function stopOcr({ project = 'agrogest-local' } = {}) {
  await localDocker();
  await compose(project, ['down', '--timeout', '5']);
}

async function main() {
  const action = process.argv[2];
  if (action === 'build') return buildOcr();
  if (action === 'start') {
    const ocr = await startOcr();
    console.log(`OCR no container local: ${ocr.url} (CPU). Para encerrar: npm run ocr:stop`);
    return;
  }
  if (action === 'stop') return stopOcr();
  if (action === 'test') {
    const project = `agrogest-ocr-test-${process.pid}`;
    await buildOcr({ project, service: 'ocr-tests' });
    try { await compose(project, ['run', '--rm', '--no-deps', '--pull', 'never', 'ocr-tests']); }
    finally { await stopOcr({ project }); }
    return;
  }
  throw new Error('Use build, start, stop ou test.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
