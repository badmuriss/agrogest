import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { app, configurationProblems, readConfig, python } from './local-config.mjs';
import { assertLocalEndpoint } from '../services/extraction/container.mjs';
const problems = [];
const version = process.versions.node.split('.').map(Number);
if (version[0] !== 24 || version[1] < 10) problems.push('Use Node 24.10+ da linha 24.');
for (const directory of ['', 'apps/mobile', 'apps/api']) if (!existsSync(path.join(app, directory, 'node_modules'))) problems.push(`Dependências ausentes em agrogest-app/${directory}; execute npm run setup:local.`);
const config = readConfig();
console.log(`AgroGest · Node ${process.versions.node} · provedor ${config.INFERENCE_PROVIDER} · app/D1/R2 locais`);
problems.push(...configurationProblems(config));
if (config.INFERENCE_PROVIDER === 'local') {
  const check = spawnSync('docker', ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], { encoding: 'utf8' });
  try {
    if (check.status !== 0) throw new Error('Docker local indisponível.');
    assertLocalEndpoint(JSON.parse(check.stdout.trim()));
    if (process.env.DOCKER_HOST) assertLocalEndpoint(process.env.DOCKER_HOST);
    const info = spawnSync('docker', ['info', '--format', '{{.OSType}}'], { encoding: 'utf8' });
    const compose = spawnSync('docker', ['compose', 'version', '--short'], { encoding: 'utf8' });
    if (info.status !== 0 || info.stdout.trim() !== 'linux' || compose.status !== 0) throw new Error('Inicie Docker local com containers Linux e Compose v2+.');
  } catch (error) { problems.push(error.message); }
} else if (config.INFERENCE_PROVIDER === 'local-vision' && config.LOCAL_VISION_BASE_URL === 'http://127.0.0.1:8092') {
  const check = spawnSync(python(), ['--version'], { encoding: 'utf8' });
  if (check.status !== 0) problems.push('Python ausente; configure AGROGEST_PYTHON e prepare a IA visual.');
  if (!existsSync(path.join(app, '.local/vision/api-key'))) problems.push('Runtime visual ainda não preparado; execute npm run setup:vision.');
}
if (!existsSync(path.join(app, 'apps/mobile/dist/index.html'))) console.log('Frontend ainda sem build; npm start o construirá ou execute npm run build:web.');
for (const problem of problems) console.error(`• ${problem}`);
console.log(problems.length ? `${problems.length} pendência(s). Nenhum segredo foi exibido e nenhum teste de inferência foi feito.` : 'Configuração pronta para iniciar. Este diagnóstico não executa inferência nem provisiona recursos.');
process.exitCode = problems.length ? 1 : 0;
