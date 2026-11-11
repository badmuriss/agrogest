// Code-native compositions of the existing white/orange artwork. Source pixels and V1/V2 stay intact.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { app } from './local-config.mjs';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = require('sharp'); // Existing pinned Wrangler dependency, used only to rasterize SVG.
const mobile = path.join(app, 'apps/mobile'), brand = path.join(mobile, 'assets/branding/v2');
const image = file => `data:image/png;base64,${readFileSync(path.join(brand, file)).toString('base64')}`;
const wrap = (size, content) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${size}">${content}</svg>`;
const logo = wrap('0 0 1000 350', `<rect width="1000" height="350" rx="30" fill="#202125"/><image x="55" y="35" width="890" height="280" preserveAspectRatio="xMidYMid meet" xlink:href="${image('logo-dark-v2.png')}"/>`);
writeFileSync(path.join(brand, 'logo-apresentacao.svg'), logo);
const icon = wrap('0 0 1024 1024', `<rect width="1024" height="1024" fill="#202125"/><image x="150" y="130" width="724" height="764" preserveAspectRatio="xMidYMid meet" xlink:href="${image('mark-dark-v2.png')}"/>`);
const output = path.join(mobile, 'assets/images/academic'); mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'icon.svg'), icon);
await sharp(Buffer.from(icon)).resize(1024, 1024).png().toFile(path.join(output, 'icon.png'));
await sharp(Buffer.from(icon)).resize(64, 64).png().toFile(path.join(output, 'favicon.png'));
writeFileSync(path.join(mobile, 'public/favicon.svg'), icon);

// Versão para fundo claro: a arte V2 com o verde trocado por carvão; o laranja e a transparência ficam iguais.
// Par da versão branca/laranja (fundo escuro), que troca o mesmo verde por branco.
const INK = [0x1c, 0x1d, 0x21];
const ink = async (source, target) => {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] && data[i + 1] > data[i]) [data[i], data[i + 1], data[i + 2]] = INK;
  }
  await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(target);
};
const academic = path.join(mobile, 'assets/branding/academic'); mkdirSync(academic, { recursive: true });
for (const name of ['logo', 'mark', 'wordmark']) await ink(path.join(brand, `${name}-light-v2.png`), path.join(academic, `${name}-ink.png`));
await ink(path.join(mobile, 'assets/images/v2/splash-icon-v2.png'), path.join(output, 'splash-icon-ink.png'));
console.log('Composições de marca geradas: branco/laranja sobre carvão e carvão/laranja para fundo claro; originais preservados.');
