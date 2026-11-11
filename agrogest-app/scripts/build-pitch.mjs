// Gera a apresentação offline (HTML único) e o roteiro a partir de docs/gs/pitch/conteudo.json.
// Fontes OFL ficam em docs/gs/pitch/fontes; capturas e marca são lidas sem alterar os originais.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app } from './local-config.mjs';

const folder = path.join(app, 'docs/gs/pitch');
const fonts = path.join(folder, 'fontes');
const deck = JSON.parse(readFileSync(path.join(folder, 'conteudo.json'), 'utf8'));
const styles = readFileSync(path.join(app, 'scripts/pitch.css'), 'utf8');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const png = file => dataUri(path.join(app, file), 'image/png');

const img = {
  logo: png('apps/mobile/assets/branding/v2/logo-dark-v2.png'),
  receipt: png('tests/fixtures/comprovante-gs-004.png'),
  review: png('docs/imagens/revisao-comprovante-laranja.png'),
  indicator: png('docs/imagens/indicador-laranja.png'),
};
const face = (family, file, weight) => `@font-face{font-family:'${family}';src:url(${dataUri(path.join(fonts, file), 'font/woff2')}) format('woff2');font-weight:${weight};font-style:normal;font-display:block}`;
const fontFaces = [
  face('Bricolage Grotesque', 'bricolage-grotesque-latin-600-normal.woff2', 600),
  face('Bricolage Grotesque', 'bricolage-grotesque-latin-800-normal.woff2', 800),
  ...[400, 500, 600, 700].map(w => face('Inter', `inter-latin-${w}-normal.woff2`, w)),
].join('\n');

const total = deck.slides.length;
const pad2 = n => String(n).padStart(2, '0');
const arrow = (w = 120) => `<svg width="${w}" height="28" viewBox="0 0 ${w} 28" fill="none" aria-hidden="true"><path d="M2 14H${w - 6}M${w - 18} 3l13 11-13 11" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const title = (s, cls = 'rise d1') => `<h1 class="${cls}">${esc(s.title)}</h1>`;
// Recorte de captura real: mostra uma região da imagem ampliada por `scale`, sem distorcer.
const crop = ({ src, alt, natW, sx, sy, sw, sh, scale, left, top }) =>
  `<figure class="crop" style="left:${left}px;top:${top}px;width:${Math.round(sw * scale)}px;height:${Math.round(sh * scale)}px"><img src="${src}" alt="${esc(alt)}" style="width:${Math.round(natW * scale)}px;left:${Math.round(-sx * scale)}px;top:${Math.round(-sy * scale)}px"></figure>`;
// Posição, no palco, de um ponto (x, y) da imagem recortada.
const at = (c, x, y) => ({ x: Math.round(c.left + (x - c.sx) * c.scale), y: Math.round(c.top + (y - c.sy) * c.scale) });
const cap = (text, left, top, cls = 'rise d2') => `<span class="cap ${cls}" style="left:${left}px;top:${top}px">${esc(text)}</span>`;

const layouts = {
  capa: s => `<div class="stage dark cover">
    <img class="logo rise" src="${img.logo}" alt="AgroGest">
    <div class="copy"><h1 class="rise d1">Do comprovante ao <em>custo do lote.</em></h1><p class="lede rise d2">${esc(s.lede)}</p><p class="meta rise d3">${esc(s.meta)}</p></div>
    <figure class="paper rise d2"><img src="${img.receipt}" alt="Recibo sintético GS-004: mineral para bovinos, total de R$ 42,50"><span class="hl"></span></figure>
    <span class="cap paper-cap rise d3">${esc(s.receiptLabel)}</span>
  </div>`,

  problema: s => `<div class="stage problem">${title(s)}
    <div class="route rise d2">
      <div class="end from"><b>${esc(s.from[0])}</b><span>${esc(s.from[1])}</span></div>
      <div class="gap"></div>
      <div class="drops">${s.failures.map(f => `<div class="drop"><span>${esc(f)}</span></div>`).join('')}</div>
      <div class="end to"><b>${esc(s.to[0])}</b><span>${esc(s.to[1])}</span></div>
    </div>
    <div class="src rise d3"><p>${esc(s.evidence)}</p><p class="limit">${esc(s.limit)}</p></div></div>`,

  publico: s => `<div class="stage audience">${title(s)}
    <div class="roles rise d2">${s.roles.map(([who, what]) => `<div class="role"><b>${esc(who)}</b><span>${esc(what)}</span></div>`).join('')}</div>
    <p class="access rise d3">${esc(s.access)}</p>
    <aside class="panel rise d2"><div class="big">${esc(s.statValue)}</div><p>${esc(s.statText)}</p><p class="src">${esc(s.statSource)}</p><p class="lim">${esc(s.statLimit)}</p><p class="entry">${esc(s.entry)}</p></aside></div>`,

  leitura: s => {
    const r = { left: 150, top: 320, w: 740 }, k = r.w / 1200;
    const rp = (x, y) => ({ x: Math.round(r.left + x * k), y: Math.round(r.top + y * k) });
    const c = { src: img.review, alt: 'Tela de revisão do AgroGest com R$ 42,50, Mineral para bovinos e 10/11/2026', natW: 420, sx: 0, sy: 288, sw: 420, sh: 372, scale: 1.42, left: 1144, top: 290 };
    // Campos no recibo (pixels do arquivo 1200×740) e na captura (420×1000).
    const fields = [
      { n: 1, receipt: [52, 478, 335, 56], app: [112, 356, 196, 52] },
      { n: 2, receipt: [52, 222, 556, 46], app: [20, 455, 380, 50] },
      { n: 3, receipt: [52, 297, 310, 46], app: [20, 543, 380, 53] },
    ];
    const marks = fields.map(f => {
      const a = rp(f.receipt[0], f.receipt[1]);
      const b = at(c, f.app[0], f.app[1]);
      const rw = Math.round(f.receipt[2] * k), rh = Math.round(f.receipt[3] * k);
      const aw = Math.round(f.app[2] * c.scale), ah = Math.round(f.app[3] * c.scale);
      return `<span class="hl" style="left:${a.x}px;top:${a.y}px;width:${rw}px;height:${rh}px"></span>
        <span class="pin" style="left:${a.x + rw + 14}px;top:${a.y + Math.round(rh / 2) - 22}px">${f.n}</span>
        <span class="ring" style="left:${b.x - 8}px;top:${b.y - 6}px;width:${aw + 16}px;height:${ah + 12}px"></span>
        <span class="pin" style="left:${b.x - (f.n === 1 ? 58 : 30)}px;top:${b.y + Math.round(ah / 2) - 22}px">${f.n}</span>`;
    }).join('');
    return `<div class="stage reading">${title(s)}
      ${cap(s.receiptLabel, r.left, r.top - 38)}
      <figure class="receipt rise d2" style="left:${r.left}px;top:${r.top}px;width:${r.w}px"><img src="${img.receipt}" alt="Recibo sintético GS-004"></figure>
      <div class="arrow rise d3" style="left:966px;top:500px">${arrow(130)}<span>${esc(s.readLabel)}</span></div>
      ${cap(s.appLabel, c.left, c.top - 38)}
      <div class="rise d3">${crop(c)}</div>
      <div class="rise d4">${marks}</div>
      <div class="rules rise d4">${s.rules.map(([a, b]) => `<div class="rule"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>
    </div>`;
  },

  aprovacao: s => {
    const c = { src: img.indicator, alt: 'Tela do lote no AgroGest: custo acumulado R$ 11.620,40 e R$ 1.162,04 por cabeça', natW: 420, sx: 14, sy: 262, sw: 392, sh: 300, scale: 1.6, left: 1143, top: 170 };
    const p = at(c, 34, 330), q = at(c, 280, 368);
    return `<div class="stage dark approval">${title(s)}
      <div class="steps rise d2">${s.timeline.map(([a, b], n) => `<div class="step ${n ? 'ok' : ''}"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>
      <div class="numbers rise d3"><div class="before">${esc(s.before)}</div><div class="after">${esc(s.after)}</div><div class="delta">${esc(s.delta)}<span>${esc(s.perHead)}</span></div></div>
      ${cap(s.appLabel, c.left, c.top - 38)}
      <div class="rise d2">${crop(c)}</div>
      <span class="ring rise d4" style="left:${p.x - 10}px;top:${p.y - 8}px;width:${Math.round(150 * c.scale)}px;height:${Math.round(30 * c.scale)}px"></span>
      <span class="ring rise d4" style="left:${q.x - 10}px;top:${q.y - 8}px;width:${Math.round(118 * c.scale)}px;height:${Math.round(26 * c.scale)}px"></span>
      <p class="evidence rise d4" style="left:${c.left}px;top:${c.top + Math.round(c.sh * c.scale) + 44}px">${esc(s.evidence)}</p></div>`;
  },

  tecnologia: s => `<div class="stage tech">${title(s)}
    <div class="line rise d2"></div>
    <div class="stations">${s.stations.map(([name, what, how], n) => `<div class="st rise d${Math.min(n + 1, 4)}"><h2>${esc(name)}</h2><span class="dot"></span><p>${esc(what)}</p><span class="how">${esc(how)}</span></div>`).join('')}</div>
    <p class="device rise d3"><b>Sem sinal:</b> ${esc(s.device)}</p>
    <div class="status rise d4"><div><i class="on"></i><span><b>Local:</b> ${esc(deck.cloud.local)}</span></div><div><i class="${deck.cloud.executed ? 'on' : ''}"></i><span><b>Nuvem:</b> ${esc(deck.cloud.hosted)}</span></div></div></div>`,

  diferencial: s => {
    const c = { src: img.review, alt: 'Aviso do AgroGest: este comprovante já tem uma despesa; botão Abrir despesa existente', natW: 420, sx: 14, sy: 726, sw: 392, sh: 106, scale: 1.38, left: 1229, top: 820 };
    return `<div class="stage diff">${title(s)}
      <table class="rise d2"><thead><tr><th>${esc(s.columns[0])}</th><th></th><th>${esc(s.columns[1])}</th></tr></thead><tbody>${s.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${arrow(70)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
      <p class="honest rise d3">${esc(s.honesty)}</p>
      ${cap(s.dupeLabel, c.left, c.top - 36, 'rise d4')}
      <div class="rise d4">${crop(c)}</div></div>`;
  },

  piloto: s => `<div class="stage pilot">${title(s)}
    <div class="scope rise d1">${s.scope.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
    <span class="status rise d2">${esc(s.status)}</span>
    <div class="rows">${s.metrics.map(([v, h, p], n) => `<div class="row rise d${n + 2}"><div class="v"><small>meta</small>${esc(v)}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}</div>
    <p class="also rise d4">${esc(s.also)}</p></div>`,

  continuidade: s => `<div class="stage cont">${title(s)}
    <div class="phases rise d2">${s.phases.map(([a, b], n) => `<div class="ph"><b><em>${n + 1}</em>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>
    <p class="next rise d3">${esc(s.next)}</p>
    <aside class="ods rise d3"><span class="badge">ODS 2 <small>Fome zero e<br>agricultura sustentável</small></span><h3>${esc(s.odsTarget)}</h3><p>${esc(s.odsText)}</p><p class="contrib">${esc(s.odsContribution)}</p></aside></div>`,

  fechamento: s => `<div class="stage dark closing">
    <img class="logo rise" src="${img.logo}" alt="AgroGest">
    <h1 class="rise d1">Do comprovante à <em>decisão no campo.</em></h1>
    <p class="credits rise d2">${esc(s.credits)}</p>
    <p class="sources rise d3">Fontes: ${deck.sources.filter(x => x.url.startsWith('http')).map(x => esc(x.label)).join(' · ')}</p></div>`,
};

// Roteiro com tempos acumulados e ritmo de fala.
const clock = sec => `${Math.floor(sec / 60)}:${pad2(sec % 60)}`;
const words = text => text.trim().split(/\s+/).length;
let elapsed = 0;
const blocks = deck.slides.map((s, i) => {
  const start = elapsed; elapsed += s.seconds;
  const w = words(s.notes);
  return `${pad2(i + 1)} · ${s.title}\n${clock(start)}–${clock(elapsed)} · ${s.seconds} s · ${w} palavras · ${s.criterion}\n\n${s.notes}\n${s.cue ? `\nDireção de gravação: ${s.cue}\n` : ''}`;
});
const totalWords = deck.slides.reduce((n, s) => n + words(s.notes), 0);
if (elapsed > deck.limitSeconds) throw new Error(`Roteiro com ${clock(elapsed)} passa do limite de ${clock(deck.limitSeconds)}.`);
const fast = deck.slides.filter(s => words(s.notes) / s.seconds > 2.4).map(s => s.id);
if (fast.length) console.warn(`Atenção: fala acima de 2,4 palavras/s em ${fast.join(', ')}.`);

writeFileSync(path.join(folder, 'roteiro.txt'), `AGROGEST · PITCH TÉCNICO GS2 · roteiro de fala
Atualizado em ${deck.updated}. Tempo-alvo: ${clock(elapsed)}; limite do enunciado: ${clock(deck.limitSeconds)}.
${totalWords} palavras (${(totalWords / elapsed * 60).toFixed(0)} por minuto). Ensaiar com a demonstração e as transições.

${blocks.join('\n\n')}

NUVEM NO VÍDEO
${deck.cloud.local}
${deck.cloud.hosted}
${deck.cloud.executed ? 'Na gravação, mostre a URL publicada e uma leitura real feita pelo Workers AI. Emulação local não comprova nuvem.' : 'Só diga que a nuvem está em uso depois de publicar e gravar uma leitura real com Workers AI. Então mude "cloud.executed" para true em conteudo.json e regenere.'}

APRESENTAR
Abra agrogest-pitch.html com dois cliques; funciona sem servidor nem internet.
Setas, espaço ou Page Down: avançar. F: tela cheia. N: falas do slide. T: cronômetro. Home/End: início e fim.
O PDF tem ${total} páginas em 16:9 e serve para apresentar ou enviar.

EDITAR
Textos, falas, tempos e fontes ficam em conteudo.json; o visual em agrogest-app/scripts/pitch.css.
Na raiz do repositório: npm run pitch:build (gera o HTML e este roteiro).
Para o PDF, abra o HTML no Chrome, Imprimir > Salvar como PDF, margens nenhuma, gráficos de fundo ligados.

ENTREGA
Gravar e publicar o vídeo no YouTube como NÃO LISTADO, com até 5 minutos. Abrir o link sem estar logado e conferir áudio e duração. Enviar o link real em TXT ou ZIP à FIAP ON até 19/11/2026. HTML e PDF não substituem o vídeo obrigatório. O pitch Startup-One de até três minutos é opcional.

FONTES E BASE
${deck.sources.map(x => `${x.label}\n${x.url}`).join('\n\n')}

Tipografia: Bricolage Grotesque e Inter (SIL Open Font License 1.1), embutidas no HTML. Licenças em font-license.txt.
`);

const license = ['bricolage-grotesque', 'inter'].map(f => readFileSync(path.join(fonts, `OFL-${f}.txt`), 'utf8').replace(/[\t ]+$/gm, '').trim()).join('\n\n----------------------------------------\n\n');
writeFileSync(path.join(folder, 'font-license.txt'), `Fontes embutidas em agrogest-pitch.html (subconjunto latino, via Fontsource 5.3.0).\n\n${license}\n`);

const sections = deck.slides.map((s, i) => `<section class="slide${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Slide ${i + 1} de ${total}: ${esc(s.title)}">${layouts[s.id](s)}</section>`).join('\n');
const notesData = JSON.stringify(deck.slides.map(s => ({ title: s.title, notes: s.notes, cue: s.cue ?? '', seconds: s.seconds }))).replaceAll('<', '\\u003c');

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgroGest · Pitch técnico GS2</title>
<meta name="description" content="AgroGest: do comprovante ao custo do lote. Pitch técnico da Global Solution 2026, CitizenTech.">
<style>
${fontFaces}
${styles}
</style></head>
<body>
<main class="deck" aria-label="Apresentação AgroGest">
${sections}
</main>
<nav class="nav" aria-label="Navegação"><button id="prev" aria-label="Slide anterior">‹</button>${deck.slides.map((s, i) => `<button class="dot${i === 0 ? ' on' : ''}" data-go="${i}" aria-label="Ir para o slide ${i + 1}"></button>`).join('')}<button id="next" aria-label="Próximo slide">›</button><span class="count">1/${total}</span><button id="notes-btn" aria-label="Mostrar falas (N)">N</button><span class="timer" hidden>0:00</span></nav>
<aside class="notes" hidden aria-live="polite"></aside>
<script>
const NOTES = ${notesData};
const slides = [...document.querySelectorAll('.slide')];
const dots = [...document.querySelectorAll('.dot')];
const notes = document.querySelector('.notes');
const timer = document.querySelector('.timer');
let index = 0, lastWheel = 0, ticking = null, started = 0;
function fit() { document.documentElement.style.setProperty('--scale', Math.min(innerWidth / 1920, innerHeight / 1080)); }
function renderNotes() {
  const n = NOTES[index];
  notes.replaceChildren();
  const h = document.createElement('h2'); h.textContent = (index + 1) + ' · ' + n.title + ' · ' + n.seconds + ' s';
  const p = document.createElement('p'); p.textContent = n.notes;
  notes.append(h, p);
  if (n.cue) { const c = document.createElement('p'); c.className = 'cue'; c.textContent = 'Gravação: ' + n.cue; notes.append(c); }
}
function go(i) {
  index = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((s, n) => s.classList.toggle('active', n === index));
  dots.forEach((d, n) => { d.classList.toggle('on', n === index); d.setAttribute('aria-current', n === index ? 'step' : 'false'); });
  document.querySelector('.count').textContent = (index + 1) + '/' + slides.length;
  renderNotes();
  history.replaceState(null, '', '#' + (index + 1));
}
function toggleTimer() {
  if (ticking) { clearInterval(ticking); ticking = null; timer.hidden = true; return; }
  started = Date.now(); timer.hidden = false;
  const tick = () => { const s = Math.floor((Date.now() - started) / 1000); timer.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  tick(); ticking = setInterval(tick, 500);
}
addEventListener('resize', fit);
addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); go(index + 1); }
  else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(index - 1); }
  else if (k === 'Home') go(0);
  else if (k === 'End') go(slides.length - 1);
  else if (k.toLowerCase() === 'n') notes.hidden = !notes.hidden;
  else if (k.toLowerCase() === 't') toggleTimer();
  else if (k.toLowerCase() === 'f') { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); }
});
addEventListener('wheel', e => { if (notes.contains(e.target)) return; const now = Date.now(); if (now - lastWheel < 600 || Math.abs(e.deltaY) < 10) return; lastWheel = now; go(index + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
let touchX = 0;
addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
addEventListener('touchend', e => { const d = e.changedTouches[0].clientX - touchX; if (Math.abs(d) > 60) go(index + (d < 0 ? 1 : -1)); }, { passive: true });
document.getElementById('prev').onclick = () => go(index - 1);
document.getElementById('next').onclick = () => go(index + 1);
document.getElementById('notes-btn').onclick = () => { notes.hidden = !notes.hidden; };
dots.forEach(d => d.onclick = () => go(Number(d.dataset.go)));
let idle = null;
addEventListener('mousemove', () => { document.body.classList.add('pointer'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.remove('pointer'), 1800); });
fit();
const start = parseInt(location.hash.slice(1), 10);
go(Number.isInteger(start) ? start - 1 : 0);
</script>
</body></html>
`;
writeFileSync(path.join(folder, 'agrogest-pitch.html'), html);
console.log(`Pitch gerado: ${total} slides, ${clock(elapsed)}, ${totalWords} palavras. HTML offline e roteiro em docs/gs/pitch/.`);
