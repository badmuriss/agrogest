import { cattleSvg } from '@/components/cattle-icon';

/**
 * Página do mapa: Leaflet 1.9.4 (MIT) com o satélite World Imagery da Esri. A mesma página roda
 * no WebView (Android/iOS) e num iframe (web); o app conversa com ela por mensagens.
 *
 * Entrada  (app → mapa): { type: 'state', boundary, pins, mode, accent, areas, outline }, { type: 'undo' | 'clear' | 'fit' },
 *                       { type: 'center', position, zoom }, { type: 'focus', position, bounds }.
 * Saída    (mapa → app): { type: 'ready' }, { type: 'draft', points, closed }, { type: 'tap', position },
 *                       { type: 'pin', id }, { type: 'area', id }.
 */

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';
// Integridade dos arquivos publicados pelo Leaflet 1.9.4.
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

/**
 * Sem chave, usa o endpoint público da Esri (bom para o protótipo). Com a chave do ArcGIS Location
 * Platform (plano grátis), usa o endpoint licenciado para uso comercial.
 */
export function satelliteUrl(apiKey: string | undefined): string {
  return apiKey
    ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${encodeURIComponent(apiKey)}`
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
}

const LABELS_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

export function farmMapHtml(apiKey?: string): string {
  if (!MAP_NETWORK_ENABLED) return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><body style="background:#10140f;color:#e3e8e1;font:16px sans-serif;padding:24px">Mapas de satélite estão desativados nesta versão local. Os contornos existentes permanecem preservados.</body></html>';

  const config = JSON.stringify({
    satellite: satelliteUrl(apiKey),
    labels: LABELS_URL,
    icons: { boi: cattleSvg('boi', 26), vaca: cattleSvg('vaca', 26) },
  });
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" integrity="${LEAFLET_CSS_SRI}" crossorigin="">
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #10140f; }
  .leaflet-container { font: 12px system-ui, sans-serif; }
  .vertex { width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; background: #fff; border: 3px solid var(--accent); box-sizing: border-box; }
  .vertex.first { width: 26px; height: 26px; margin: -13px 0 0 -13px; background: var(--accent); border-color: #fff; }
  .pin { display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); }
  .pin .bubble { width: 40px; height: 40px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,.45); border: 3px solid #fff; }
  .pin.selected .bubble { border-color: var(--accent); }
  .pin .label { margin-top: 2px; padding: 1px 6px; border-radius: 8px; background: rgba(16,20,15,.85); color: #fff; font-weight: 700; font-size: 11px; white-space: nowrap; }
  .pin .tail { width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #fff; margin-top: -2px; }
  .area-label { background: rgba(16,20,15,.82); border: 0; border-radius: 8px; box-shadow: none; color: #fff; padding: 3px 7px; text-align: center; font-weight: 700; font-size: 12px; line-height: 1.25; }
  .area-label::before { display: none; }
  .area-label small { display: block; font-weight: 600; font-size: 11px; opacity: .85; }
  .offline { position: absolute; z-index: 1000; left: 12px; right: 12px; top: 12px; padding: 10px 12px; border-radius: 12px; background: rgba(16,20,15,.9); color: #fff; display: none; }
</style>
</head><body>
<div id="map"></div>
<div class="offline" id="offline">Sem internet: o satélite não carrega, mas a área e os pinos continuam salvos.</div>
<script src="${LEAFLET}/leaflet.js" integrity="${LEAFLET_JS_SRI}" crossorigin=""></script>
<script>
(function () {
  var CONFIG = ${config};
  function send(message) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
    else if (window.parent !== window) window.parent.postMessage({ agrogestMap: message }, '*');
  }
  if (!window.L) {
    document.getElementById('offline').style.display = 'block';
    send({ type: 'error', message: 'leaflet' });
    return;
  }
  var map = L.map('map', { zoomControl: false, attributionControl: true, maxZoom: 20 }).setView([-15.8, -52], 4);
  var tiles = L.tileLayer(CONFIG.satellite, { maxNativeZoom: 19, maxZoom: 20, attribution: 'Imagens: Esri, Maxar, Earthstar Geographics' }).addTo(map);
  L.tileLayer(CONFIG.labels, { maxNativeZoom: 19, maxZoom: 20, opacity: 0.85 }).addTo(map);
  var tileErrors = 0;
  tiles.on('tileerror', function () { tileErrors++; if (tileErrors > 4) document.getElementById('offline').style.display = 'block'; });
  tiles.on('tileload', function () { tileErrors = 0; document.getElementById('offline').style.display = 'none'; });

  var state = { mode: 'view', boundary: null, pins: [], accent: '#3ecf8e', areas: [], outline: null };
  var draft = [];
  var closed = false;
  var areaLayer = L.layerGroup().addTo(map);
  var layers = L.layerGroup().addTo(map);
  var pinLayer = L.layerGroup().addTo(map);
  var fitted = false;
  var shape = null;
  var found = null;

  function latlng(p) { return [p[1], p[0]]; }
  function position(ll) { return [Math.round(ll.lng * 1e7) / 1e7, Math.round(ll.lat * 1e7) / 1e7]; }
  function openRing(ring) {
    if (!ring || ring.length < 2) return ring || [];
    var a = ring[0], b = ring[ring.length - 1];
    return a[0] === b[0] && a[1] === b[1] ? ring.slice(0, -1) : ring.slice();
  }
  function emitDraft() { send({ type: 'draft', points: draft.slice(), closed: closed }); }

  // Imã do pasto: com a fazenda de referência, o ponto nunca fica fora dela (vai para a borda
  // mais próxima) e gruda em cantos e cercas próximos (da fazenda ou de outro pasto), para
  // pastos vizinhos dividirem a mesma linha. Distâncias em pixels de tela.
  var SNAP_VERTEX_PX = 16, SNAP_EDGE_PX = 12;
  function screen(ring) { return openRing(ring).map(function (q) { return map.latLngToLayerPoint(latlng(q)); }); }
  function inside(pt, pts) {
    var hit = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      if ((pts[i].y > pt.y) !== (pts[j].y > pt.y) && pt.x < (pts[j].x - pts[i].x) * (pt.y - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x) hit = !hit;
    }
    return hit;
  }
  function nearestEdge(pt, rings) {
    var best = null;
    rings.forEach(function (pts) {
      for (var i = 0; i < pts.length; i++) {
        var q = L.LineUtil.closestPointOnSegment(pt, pts[i], pts[(i + 1) % pts.length]);
        var d = q.distanceTo(pt);
        if (!best || d < best.d) best = { point: q, d: d };
      }
    });
    return best;
  }
  function snap(ll) {
    var farm = screen(state.outline);
    if (state.mode !== 'draw' || farm.length < 3) return ll;
    var pt = map.latLngToLayerPoint(ll);
    var rings = [farm].concat(state.areas.map(function (a) { return screen(a.ring); }).filter(function (r) { return r.length >= 3; }));
    var vertex = null, vd = SNAP_VERTEX_PX;
    rings.forEach(function (pts) { pts.forEach(function (v) { var d = v.distanceTo(pt); if (d < vd) { vd = d; vertex = v; } }); });
    if (vertex) return map.layerPointToLatLng(vertex);
    var edge = nearestEdge(pt, rings);
    if (edge && edge.d < SNAP_EDGE_PX) return map.layerPointToLatLng(edge.point);
    if (!inside(pt, farm)) return map.layerPointToLatLng(nearestEdge(pt, [farm]).point);
    return ll;
  }

  function drawBoundary() {
    layers.clearLayers();
    var accent = state.accent;
    if (state.mode === 'draw') {
      shape = null;
      if (draft.length > 0) {
        shape = closed
          ? L.polygon(draft.map(latlng), { color: accent, weight: 3, fillColor: accent, fillOpacity: 0.2 })
          : L.polyline(draft.map(latlng), { color: accent, weight: 3, dashArray: '6 6' });
        shape.addTo(layers);
      }
      draft.forEach(function (p, i) {
        var marker = L.marker(latlng(p), {
          draggable: true,
          icon: L.divIcon({ className: '', html: '<div class="vertex' + (i === 0 ? ' first' : '') + '"></div>', iconSize: [0, 0] }),
        });
        marker.on('drag', function (e) {
          var ll = snap(e.target.getLatLng());
          e.target.setLatLng(ll);
          draft[i] = position(ll);
          drawShapeOnly();
        });
        marker.on('dragend', function () { drawBoundary(); emitDraft(); });
        marker.on('click', function () {
          if (i === 0 && !closed && draft.length >= 3) { closed = true; drawBoundary(); emitDraft(); }
        });
        marker.addTo(layers);
      });
      return;
    }
    var ring = openRing(state.boundary);
    if (ring.length >= 3) {
      L.polygon(ring.map(latlng), { color: accent, weight: 3, fillColor: accent, fillOpacity: state.mode === 'place' ? 0.08 : 0.15, interactive: false }).addTo(layers);
    }
  }
  // Durante o arraste, só move a linha: recriar os marcadores soltaria o que está sendo arrastado.
  function drawShapeOnly() {
    if (shape) shape.setLatLngs(draft.map(latlng));
  }

  // Pastos: coloridos e tocáveis na visualização; apagados (só referência) ao desenhar.
  function drawAreas() {
    areaLayer.clearLayers();
    var drawing = state.mode === 'draw';
    var outline = openRing(state.outline);
    if (outline.length >= 3) {
      // A fazenda continua com a mesma marcação de sempre: o pasto é desenhado dentro dela.
      var farmColor = state.outlineColor || state.accent;
      L.polygon(outline.map(latlng), { color: farmColor, weight: 3, fillColor: farmColor, fillOpacity: 0.15, interactive: false }).addTo(areaLayer);
    }
    state.areas.forEach(function (area) {
      var ring = openRing(area.ring);
      if (ring.length < 3) return;
      var polygon = L.polygon(ring.map(latlng), {
        color: area.selected ? '#ffffff' : area.color,
        weight: area.selected ? 4 : 2,
        fillColor: area.color,
        fillOpacity: drawing ? 0.08 : area.selected ? 0.42 : 0.26,
        opacity: drawing ? 0.6 : 1,
        interactive: state.mode === 'view',
      });
      if (!drawing) {
        var tip = document.createElement('div');
        tip.textContent = area.label;
        if (area.detail) { var small = document.createElement('small'); small.textContent = area.detail; tip.appendChild(small); }
        polygon.bindTooltip(tip, { permanent: true, direction: 'center', className: 'area-label', interactive: false });
      }
      polygon.on('click', function (e) { L.DomEvent.stopPropagation(e); send({ type: 'area', id: area.id }); });
      polygon.addTo(areaLayer);
    });
  }

  function drawPins() {
    pinLayer.clearLayers();
    state.pins.forEach(function (pin) {
      var html = '<div class="pin' + (pin.selected ? ' selected' : '') + '"><div class="bubble">' + CONFIG.icons[pin.kind] +
        '</div><div class="tail"></div><div class="label"></div></div>';
      var marker = L.marker(latlng(pin.position), { icon: L.divIcon({ className: '', html: html, iconSize: [0, 0] }), keyboard: false });
      marker.on('add', function () {
        var el = marker.getElement();
        if (el) el.querySelector('.label').textContent = pin.label;
      });
      marker.on('click', function (e) { L.DomEvent.stopPropagation(e); send({ type: 'pin', id: pin.id }); });
      marker.addTo(pinLayer);
    });
  }

  function fit() {
    var points = openRing(state.boundary).map(latlng).concat(state.pins.map(function (p) { return latlng(p.position); }))
      .concat(openRing(state.outline).map(latlng));
    state.areas.forEach(function (area) { points = points.concat(openRing(area.ring).map(latlng)); });
    if (state.mode === 'draw') points = points.concat(draft.map(latlng));
    if (points.length === 1) map.setView(points[0], 16);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 18 });
    return points.length > 0;
  }

  map.on('click', function (e) {
    if (state.mode === 'draw' && !closed) {
      draft.push(position(snap(e.latlng)));
      drawBoundary();
      emitDraft();
    } else if (state.mode === 'place') {
      send({ type: 'tap', position: position(e.latlng) });
    }
  });

  function handle(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'state') {
      var enteringDraw = message.mode === 'draw' && (state.mode !== 'draw' || message.drawKey !== state.drawKey);
      state.drawKey = message.drawKey;
      state.mode = message.mode;
      state.boundary = message.boundary;
      state.pins = message.pins || [];
      state.accent = message.accent || state.accent;
      state.areas = message.areas || [];
      state.outline = message.outline || null;
      state.outlineColor = message.outlineColor || null;
      document.documentElement.style.setProperty('--accent', state.accent);
      if (enteringDraw) {
        // Editar parte da área atual; sem área, começa do zero.
        draft = openRing(state.boundary);
        closed = draft.length >= 3;
        emitDraft();
      }
      drawAreas();
      drawBoundary();
      drawPins();
      if (!fitted || enteringDraw) fitted = fit() || fitted;
      // O painel do desenho é mais alto e encolhe o mapa logo depois: enquadra de novo.
      if (enteringDraw) setTimeout(function () { map.invalidateSize(); fit(); }, 450);
    } else if (message.type === 'undo') {
      if (closed) closed = false; else draft.pop();
      drawBoundary();
      emitDraft();
    } else if (message.type === 'clear') {
      draft = [];
      closed = false;
      drawBoundary();
      emitDraft();
    } else if (message.type === 'fit') {
      fit();
    } else if (message.type === 'center') {
      fitted = true;
      map.setView(latlng(message.position), message.zoom || 16);
    } else if (message.type === 'focus') {
      // Lugar buscado: enquadra a área dele (município, distrito) ou aproxima no ponto, e marca.
      fitted = true;
      var b = message.bounds;
      if (b && (b[2] - b[0] > 0.0005 || b[3] - b[1] > 0.0005)) map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { maxZoom: 16 });
      else map.setView(latlng(message.position), 16);
      if (found) map.removeLayer(found);
      found = L.circleMarker(latlng(message.position), { radius: 9, color: '#fff', weight: 3, fillColor: '#FF6F1E', fillOpacity: 1, interactive: false }).addTo(map);
    }
  }
  window.__agrogestMap = handle;
  window.addEventListener('message', function (event) {
    if (event.data && event.data.agrogestIn) handle(event.data.agrogestIn);
  });
  send({ type: 'ready' });
})();
</script>
</body></html>`;
}

// Satélite Esri e Leaflet pela CDN: religados em 11/11/2026 a pedido do usuário (exigem internet).
const MAP_NETWORK_ENABLED = true;
