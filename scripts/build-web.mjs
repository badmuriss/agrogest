import { spawnSync } from 'node:child_process';
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'agrogest-app/apps/mobile');
await mkdir(path.join(app, 'public'), { recursive: true });
await copyFile(path.join(app, 'node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm'), path.join(app, 'public/dotlottie-player.wasm'));
await copyFile(path.join(app, 'node_modules/@lottiefiles/dotlottie-web/LICENSE'), path.join(app, 'public/dotlottie-LICENSE.txt'));
const result = spawnSync('npm', ['exec', '--', 'expo', 'export', '--platform', 'web', '--output-dir', 'dist'], { cwd: app, stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1', CI: '1' } });
if (result.status !== 0) process.exit(result.status ?? 1);
const dist = path.join(app, 'dist');
async function paths(dir, prefix = '') {
  const items = [];
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const name = `${prefix}${f.name}`;
    if (f.isDirectory()) items.push(...await paths(path.join(dir, f.name), `${name}/`)); else items.push(`/${name}`);
  }
  return items;
}
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
html = html.replace('<html lang="en">', '<html lang="pt-BR">').replace('</body>', '<script>if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(()=>{});}</script></body>');
await writeFile(path.join(dist, 'index.html'), html);
const assets = (await paths(dist)).filter((f) => f !== '/sw.js');
const version = createHash('sha256').update(assets.join('\n') + html).digest('hex').slice(0, 16);
// Cache only the public static shell. API responses and documents are never cached here.
const script = `const CACHE='agrogest-shell-${version}';
const ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('agrogest-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/cdn-cgi/'))return;
const isolate=response=>{if(!response)return new Response('Abra o AgroGest uma vez com o serviço local disponível.',{status:503});const headers=new Headers(response.headers);headers.set('Cross-Origin-Opener-Policy','same-origin');headers.set('Cross-Origin-Embedder-Policy','credentialless');headers.delete('Content-Encoding');headers.delete('Content-Length');return new Response(response.body,{status:response.status,headers});};
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html')).then(isolate)));return;}
if(url.pathname.startsWith('/_expo/')||url.pathname.startsWith('/assets/')||ASSETS.includes(decodeURI(url.pathname))){event.respondWith(caches.match(event.request).then(async hit=>hit||await caches.match(decodeURI(url.pathname))||fetch(event.request)));}});

`;
await writeFile(path.join(dist, 'sw.js'), script);
console.log(`Web exportado com shell offline ${version}. Reinicie o servidor local após recompilar.`);
