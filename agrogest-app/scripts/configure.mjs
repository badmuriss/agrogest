import { configure } from './local-config.mjs';
try {
  if (process.argv.length !== 4 || process.argv[2] !== '--provider') throw new Error('Use npm run configure -- --provider local|local-vision|workers-ai.');
  const config = configure(process.argv[3]);
  console.log(`Provedor selecionado: ${config.INFERENCE_PROVIDER}. Reinicie npm start. Dados e fila offline preservados.`);
  if (config.INFERENCE_PROVIDER === 'workers-ai') console.log('Edite WORKERS_AI_ACCOUNT_ID e WORKERS_AI_API_TOKEN em agrogest-app/apps/api/.dev.vars. Nenhuma inferência ou publicação foi executada.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
