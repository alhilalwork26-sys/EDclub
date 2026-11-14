// Peta 3D rute lari: loop Kedai Karimata -> Kedai Karimata (Surabaya)
const coords = window.EDROUTE.coordinates;
const frame = document.querySelector('.run-map__frame');
const hudKm = document.getElementById('hudKm');
const hudBar = document.getElementById('hudBar');
const btnReplay = document.getElementById('mapReplay');
const btnFollow = document.getElementById('mapFollow');
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
const RUN_MS = 26000;
const RAD = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Jarak kumulatif sepanjang rute
const haversine = (a, b) => {
  const dLat = (b[1] - a[1]) * RAD, dLng = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(s));
};
const cum = [0];
for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
const total = cum[cum.length - 1];

const pointAt = (d) => {
  d = clamp(d, 0, total);
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; cum[mid] <= d ? (lo = mid) : (hi = mid); }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  const a = coords[lo], b = coords[hi];
  return { idx: lo, pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
};
const bearingOf = (a, b) => {
  const dLng = (b[0] - a[0]) * RAD, la = a[1] * RAD, lb = b[1] * RAD;
  const y = Math.sin(dLng) * Math.cos(lb);
  const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dLng);
  return (Math.atan2(y, x) / RAD + 360) % 360;
};
const angleDiff = (a, b) => ((b - a + 540) % 360) - 180;
const ease = (p) => 0.5 - Math.cos(Math.PI * p) / 2;
const fmtKm = (m) => (m / 1000).toFixed(1).replace('.', ',');

const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
const overview = { padding: { top: 110, bottom: 110, left: 70, right: 70 }, pitch: 52, bearing: -28 };

// Titik petugas: marshal di tikungan, water station di tengah rute, P3K di start/finish
const nearest = (lngLat) => coords.reduce((best, c) => (haversine(c, lngLat) < haversine(best, lngLat) ? c : best), coords[0]);
// cameraForBounds mengabaikan pitch, jadi zoom dihitung datar lalu diperbesar karena pitch memendekkan rute
const overviewCamera = () => {
  const cam = map.cameraForBounds(bounds, { padding: overview.padding, bearing: overview.bearing, pitch: 0 });
  return { center: cam.center, zoom: cam.zoom + 0.55, pitch: overview.pitch, bearing: overview.bearing };
};

const AID = [
  ...[[112.74618, -7.27632], [112.74443, -7.27255], [112.7496, -7.26599], [112.74774, -7.26534], [112.74878, -7.2617], [112.75138, -7.26658], [112.74925, -7.2771]]
    .map((p, i) => ({ cls: 'marshal', label: 'M', text: `Marshal ${i + 1}`, pos: nearest(p) })),
  { cls: 'water', label: 'W', text: `Water station · km ${fmtKm(total / 2)}`, pos: pointAt(total / 2).pos },
  { cls: 'med', label: '+', text: 'Titik P3K (start & finish)', pos: pointAt(120).pos },
];
const AID_COLOR = { marshal: '#ff8a3d', water: '#3fa9ff', med: '#ff4d5e' };

const map = new maplibregl.Map({
  container: 'map',
  style: STYLE_URL,
  bounds,
  fitBoundsOptions: overview,
  pitch: overview.pitch,
  bearing: overview.bearing,
  maxPitch: 75,
  antialias: true,
  cooperativeGestures: true,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

const pin = (cls, label) => {
  const el = document.createElement('div');
  el.className = `pin ${cls}`;
  el.innerHTML = `<i></i>${label ? `<span>${label}</span>` : ''}`;
  return el;
};
const runner = new maplibregl.Marker({ element: pin('pin--runner') }).setLngLat(coords[0]);
const startPin = new maplibregl.Marker({ element: pin('pin--finish', 'Start & Finish · Kedai Karimata') }).setLngLat(coords[0]);

const line = (c) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c } });
let follow = true, running = false, raf = 0, smoothBearing = 0, started = false, curD = 0, capturing = false;

// Gedung 3D, garis rute neon, dan jejak lari (dipakai peta utama dan peta pembuat gambar bagikan)
// Warna dasar peta: hijau-hitam dengan jalan yang lebih terang supaya rute dan kota terbaca
const BASE_TINT = {
  background: ['background-color', '#08120e'], water: ['fill-color', '#0a2230'], waterway: ['line-color', '#0c2a3a'],
  landuse_residential: ['fill-color', '#0c1914'], landcover_wood: ['fill-color', '#0e2c1b'], landuse_park: ['fill-color', '#0e2c1b'],
  highway_path: ['line-color', '#2b4a3a'], highway_minor: ['line-color', '#30443b'], highway_major_casing: ['line-color', 'rgba(212,255,63,0.16)'],
  highway_major_inner: ['line-color', '#445a4f'], highway_major_subtle: ['line-color', '#445a4f'],
};
const addMapLayers = (m, { story = false } = {}) => {
  Object.entries(BASE_TINT).forEach(([id, [prop, color]]) => { if (m.getLayer(id)) m.setPaintProperty(id, prop, color); });
  if (story) m.getStyle().layers.filter((l) => l.type === 'symbol').forEach((l) => m.setLayoutProperty(l.id, 'visibility', 'none'));
  const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  m.addLayer({
    id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
    paint: {
      // makin tinggi gedungnya, makin menyala hijau limau
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8],
        0, '#1d2420', 20, '#2a382f', 50, '#3d5a3d', 100, '#6b8f35', 200, '#d4ff3f'],
      // pada gambar story tinggi gedung dilebihkan supaya efek 3D terasa
      'fill-extrusion-height': ['*', story ? 2.2 : 1, ['coalesce', ['get', 'render_height'], 8]],
      'fill-extrusion-base': ['*', story ? 2.2 : 1, ['coalesce', ['get', 'render_min_height'], 0]],
      'fill-extrusion-opacity': 0.94,
    },
  }, firstSymbol);

  const k = story ? 1.7 : 1;
  const L = { 'line-cap': 'round', 'line-join': 'round' };
  m.addSource('route', { type: 'geojson', data: line(coords) });
  m.addSource('run', { type: 'geojson', data: line([coords[0], coords[0]]) });
  m.addLayer({ id: 'route-base', type: 'line', source: 'route', layout: L,
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.28, 'line-width': 4 * k, 'line-dasharray': [1, 2] } });
  m.addLayer({ id: 'run-glow-wide', type: 'line', source: 'run', layout: L,
    paint: { 'line-color': '#d4ff3f', 'line-opacity': 0.26, 'line-width': 38 * k, 'line-blur': 24 * k } });
  m.addLayer({ id: 'run-glow', type: 'line', source: 'run', layout: L,
    paint: { 'line-color': '#d4ff3f', 'line-opacity': 0.5, 'line-width': 16 * k, 'line-blur': 9 * k } });
  m.addLayer({ id: 'run-line', type: 'line', source: 'run', layout: L,
    paint: { 'line-color': '#d4ff3f', 'line-width': 5 * k } });
  m.addLayer({ id: 'run-core', type: 'line', source: 'run', layout: L,
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-width': 1.7 * k } });
};

map.on('load', () => {
  addMapLayers(map);
  map.jumpTo(overviewCamera());
  startPin.addTo(map);

  AID.forEach(({ cls, label, text, pos }) => {
    const el = document.createElement('div');
    el.className = `aid aid--${cls}`;
    el.textContent = label;
    el.title = text;
    new maplibregl.Marker({ element: el }).setLngLat(pos).addTo(map);
  });
  frame.classList.add('is-ready');

  // Mulai otomatis saat peta terlihat
  new IntersectionObserver((entries, io) => {
    if (entries[0].isIntersecting && !started) { started = true; io.disconnect(); play(); }
  }, { threshold: 0.5 }).observe(frame);
});

const setHud = (d) => {
  hudKm.textContent = fmtKm(d);
  hudBar.style.transform = `scaleX(${d / total})`;
};

const drawTo = (d) => {
  curD = d;
  const { idx, pos } = pointAt(d);
  if (!capturing) map.getSource('run').setData(line([...coords.slice(0, idx + 1), pos]));
  runner.setLngLat(pos);
  setHud(d);
  return pos;
};

const step = (t0) => (now) => {
  const p = Math.min((now - t0) / RUN_MS, 1);
  const d = ease(p) * total;
  const pos = drawTo(d);
  if (follow) {
    const ahead = pointAt(Math.min(d + 140, total)).pos;
    smoothBearing += angleDiff(smoothBearing, bearingOf(pos, ahead)) * 0.04;
    map.jumpTo({ center: pos, bearing: smoothBearing, pitch: 62, zoom: 16.1 });
  }
  if (p < 1) raf = requestAnimationFrame(step(t0));
  else finish();
};

const finish = () => {
  running = false;
  frame.classList.remove('is-running');
  frame.classList.add('is-done');
  map.easeTo({ ...overviewCamera(), duration: 3200, essential: true });
};

const play = () => {
  cancelAnimationFrame(raf);
  running = true;
  frame.classList.remove('is-done');
  frame.classList.add('is-running');
  curD = 0;
  map.getSource('run').setData(line([coords[0], coords[0]]));
  runner.setLngLat(coords[0]).addTo(map);
  setHud(0);

  if (prefersReduced) { drawTo(total); finish(); return; }

  const first = bearingOf(coords[0], pointAt(140).pos);
  smoothBearing = first;
  const go = () => { if (running) raf = requestAnimationFrame(step(performance.now())); };
  if (follow) {
    map.flyTo({ center: coords[0], zoom: 16.1, pitch: 62, bearing: first, duration: 3000, essential: true });
    setTimeout(go, 3100);
  } else {
    map.easeTo({ ...overviewCamera(), duration: 1200 });
    setTimeout(go, 1300);
  }
};

btnReplay.addEventListener('click', () => { if (map.loaded()) play(); });
btnFollow.addEventListener('click', () => {
  follow = !follow;
  btnFollow.setAttribute('aria-pressed', follow);
  btnFollow.textContent = follow ? 'Kamera ikuti pelari' : 'Kamera bebas';
  if (!follow && running) map.easeTo({ ...overviewCamera(), duration: 1200 });
});
map.on('dragstart', () => {
  if (running && follow) { follow = false; btnFollow.setAttribute('aria-pressed', false); btnFollow.textContent = 'Kamera bebas'; }
});

/* ---------- Bagikan rute: gambar 3D dan link ---------- */
const SHARE_FILE = 'ed-fun-run-rute-3d.jpg';
const SHARE_TEXT = 'Ikut lari bareng ED Club! ED Fun Run Vol. 1, Sabtu 20:00 di Kedai Karimata (±5 km). Lihat rute 3D-nya:';

// Tautan ke bagian peta di halaman ini; membuka halaman langsung memutar rute
const shareUrl = () => { const u = new URL(location.href); u.search = ''; u.hash = '#rute'; return u.toString(); };

const roundRect = (c, x, y, w, h, r) => {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};

// Menempelkan penanda dan teks ED Club di atas tangkapan kanvas peta
const composeShare = async (src, project, cssW, cssH, opts = {}) => {
  try {
    await Promise.all([document.fonts.load('64px Anton'), document.fonts.load('600 20px Inter'), document.fonts.load('500 20px Inter')]);
  } catch (e) { /* tetap lanjut dengan font cadangan */ }
  const s = src.width / cssW;
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const c = out.getContext('2d');
  c.scale(s, s);
  c.drawImage(src, 0, 0, cssW, cssH);

  const u = Math.max(cssW / 1200, 0.62);   // satuan desain, acuan lebar 1200
  const m = 44 * u;
  const xy = (pos) => { const p = project(pos); return [p.x ?? p[0], p.y ?? p[1]]; };

  // Bayangan atas untuk logo dan bawah untuk teks
  let g = c.createLinearGradient(0, 0, 0, 130 * u);
  g.addColorStop(0, 'rgba(8,10,6,.7)'); g.addColorStop(1, 'rgba(8,10,6,0)');
  c.fillStyle = g; c.fillRect(0, 0, cssW, 130 * u);
  const gh = Math.min(cssH * 0.5, 250 * u);
  g = c.createLinearGradient(0, cssH - gh, 0, cssH);
  g.addColorStop(0, 'rgba(8,10,6,0)'); g.addColorStop(1, 'rgba(8,10,6,.94)');
  c.fillStyle = g; c.fillRect(0, cssH - gh, cssW, gh);

  // Penanda petugas
  c.textAlign = 'center'; c.textBaseline = 'middle';
  AID.forEach(({ cls, label, pos }) => {
    const [x, y] = xy(pos);
    if (x < 0 || y < 0 || x > cssW || y > cssH) return;
    c.beginPath(); c.arc(x, y, 11 * u, 0, 7);
    c.fillStyle = AID_COLOR[cls]; c.fill();
    c.lineWidth = 2.5 * u; c.strokeStyle = '#0b0d0a'; c.stroke();
    c.fillStyle = '#fff'; c.font = `700 ${12 * u}px Inter, sans-serif`;
    c.fillText(label, x, y + 0.5 * u);
  });

  // Penanda start & finish dengan label
  const [sx, sy] = xy(coords[0]);
  c.beginPath(); c.arc(sx, sy, 15 * u, 0, 7); c.fillStyle = 'rgba(212,255,63,.28)'; c.fill();
  c.beginPath(); c.arc(sx, sy, 9 * u, 0, 7); c.fillStyle = '#d4ff3f'; c.fill();
  c.lineWidth = 3.5 * u; c.strokeStyle = '#0b0d0a'; c.stroke();
  const tag = 'Start & Finish · Kedai Karimata';
  c.font = `600 ${15 * u}px Inter, sans-serif`;
  const tw = c.measureText(tag).width + 28 * u, th = 30 * u;
  const flip = sx + 22 * u + tw > cssW - 12 * u;
  const tx = flip ? sx - 22 * u - tw : sx + 22 * u;
  roundRect(c, tx, sy - th / 2, tw, th, th / 2); c.fillStyle = '#d4ff3f'; c.fill();
  c.fillStyle = '#0b0d0a'; c.textAlign = 'left';
  c.fillText(tag, tx + 14 * u, sy + 0.5 * u);

  // Logo kiri atas dan label kanan atas
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.font = `${34 * u}px Anton, Impact, sans-serif`;
  c.fillStyle = '#fff'; c.fillText('ED', m, m + 24 * u);
  const edw = c.measureText('ED ').width;
  c.fillStyle = '#d4ff3f'; c.fillText('Club', m + edw, m + 24 * u);
  c.font = `600 ${13 * u}px Inter, sans-serif`;
  const chip = 'RUTE LARI 3D';
  const cw = c.measureText(chip).width + 28 * u, ch = 30 * u;
  roundRect(c, cssW - m - cw, m + 2 * u, cw, ch, ch / 2); c.fillStyle = 'rgba(255,255,255,.16)'; c.fill();
  c.lineWidth = 1.2 * u; c.strokeStyle = 'rgba(255,255,255,.4)'; c.stroke();
  c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(chip, cssW - m - cw + 14 * u, m + 2 * u + ch / 2 + 0.5 * u);

  // Teks utama kiri bawah
  c.textBaseline = 'alphabetic';
  c.font = `600 ${15 * u}px Inter, sans-serif`; c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillText('SABTU · 20:00 · KEDAI KARIMATA', m, cssH - m - 78 * u);
  c.font = `${64 * u}px Anton, Impact, sans-serif`; c.fillStyle = '#fff';
  c.fillText('ED FUN RUN', m, cssH - m - 20 * u);
  const fw = c.measureText('ED FUN RUN ').width;
  c.fillStyle = '#d4ff3f'; c.fillText('VOL. 1', m + fw, cssH - m - 20 * u);
  c.font = `500 ${17 * u}px Inter, sans-serif`; c.fillStyle = 'rgba(255,255,255,.85)';
  c.fillText(`±${Math.round(total / 1000)} km · satu loop dari dan ke Kedai Karimata`, m, cssH - m + 10 * u);

  // Alamat situs kanan bawah
  const host = opts.host ?? (/^(localhost|127\.|\[::1\]|)$/.test(location.hostname) ? '' : location.host);
  if (host) {
    c.textAlign = 'right'; c.font = `600 ${16 * u}px Inter, sans-serif`; c.fillStyle = '#d4ff3f';
    c.fillText(`${host}/fun-run`, cssW - m, cssH - m + 10 * u);
  }
  return out;
};

// Menangkap tampilan peta yang sedang dilihat
// Garis rute ditampilkan penuh saat menangkap, lalu dikembalikan ke posisi lari semula
const grabLiveMap = () => new Promise((resolve) => {
  capturing = true;
  map.getSource('run').setData(line(coords));
  map.once('render', () => {
    const cv = map.getCanvas();
    const snap = document.createElement('canvas');
    snap.width = cv.width; snap.height = cv.height;
    snap.getContext('2d').drawImage(cv, 0, 0);
    const cssW = cv.clientWidth, cssH = cv.clientHeight;
    const project = (p) => map.project(p);
    capturing = false;
    drawTo(curD);
    composeShare(snap, project, cssW, cssH).then(resolve);
  });
  map.triggerRepaint();
});

/* ---------- Gambar Story Instagram (9:16, 1080×1920) ---------- */
const STORY_W = 1080, STORY_H = 1920;

const composeStory = async (src, project) => {
  try {
    await Promise.all([document.fonts.load('120px Anton'), document.fonts.load('800 26px Inter'), document.fonts.load('600 26px Inter'), document.fonts.load('500 26px Inter')]);
  } catch (e) { /* tetap lanjut dengan font cadangan */ }
  const W = STORY_W, H = STORY_H, m = 64;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const c = out.getContext('2d');
  c.imageSmoothingQuality = 'high';
  c.drawImage(src, 0, 0, W, H);
  const xy = (pos) => { const p = project(pos); return [p.x ?? p[0], p.y ?? p[1]]; };
  const lime = '#d4ff3f', ink = '#0b0d0a';

  // Vinyet dan bayangan atas-bawah supaya teks terbaca dan fokus ke rute
  let g = c.createRadialGradient(W / 2, H * 0.5, H * 0.22, W / 2, H * 0.5, H * 0.72);
  g.addColorStop(0, 'rgba(5,8,4,0)'); g.addColorStop(1, 'rgba(5,8,4,.5)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  g = c.createLinearGradient(0, 0, 0, 760);
  g.addColorStop(0, 'rgba(6,9,5,.96)'); g.addColorStop(.55, 'rgba(6,9,5,.78)'); g.addColorStop(1, 'rgba(6,9,5,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, 760);
  g = c.createLinearGradient(0, H - 760, 0, H);
  g.addColorStop(0, 'rgba(6,9,5,0)'); g.addColorStop(.45, 'rgba(6,9,5,.88)'); g.addColorStop(1, 'rgba(6,9,5,.98)');
  c.fillStyle = g; c.fillRect(0, H - 760, W, 760);

  // Panah arah lari sepanjang rute
  for (let d = 380; d < total - 260; d += 640) {
    const [x0, y0] = xy(pointAt(d).pos), [x1, y1] = xy(pointAt(d + 45).pos);
    const a = Math.atan2(y1 - y0, x1 - x0);
    c.save(); c.translate(x0, y0); c.rotate(a);
    c.beginPath(); c.moveTo(15, 0); c.lineTo(-11, -13); c.lineTo(-5, 0); c.lineTo(-11, 13); c.closePath();
    c.fillStyle = '#fff'; c.strokeStyle = 'rgba(8,10,6,.75)'; c.lineWidth = 3; c.stroke(); c.fill();
    c.restore();
  }

  // Penanda tiap kilometer
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let k = 1; k * 1000 < total - 400; k++) {
    const [x, y] = xy(pointAt(k * 1000).pos);
    const label = `${k} KM`;
    c.font = '800 21px Inter, sans-serif';
    const w = c.measureText(label).width + 30, h = 40;
    roundRect(c, x - w / 2, y - h / 2, w, h, h / 2);
    c.fillStyle = ink; c.fill(); c.lineWidth = 3; c.strokeStyle = lime; c.stroke();
    c.fillStyle = '#fff'; c.fillText(label, x, y + 1);
  }

  // Start & finish dengan cincin berpendar
  const [sx, sy] = xy(coords[0]);
  [[54, .14], [36, .26]].forEach(([r, a]) => { c.beginPath(); c.arc(sx, sy, r, 0, 7); c.fillStyle = `rgba(212,255,63,${a})`; c.fill(); });
  c.beginPath(); c.arc(sx, sy, 17, 0, 7); c.fillStyle = lime; c.fill(); c.lineWidth = 5; c.strokeStyle = ink; c.stroke();
  c.font = '800 24px Inter, sans-serif';
  const tag = 'START & FINISH';
  const tw = c.measureText(tag).width + 36, th = 46;
  const flip = sx + 40 + tw > W - 30;
  const tx = flip ? sx - 40 - tw : sx + 40;
  roundRect(c, tx, sy - th / 2 - 18, tw, th, th / 2); c.fillStyle = lime; c.fill();
  c.fillStyle = ink; c.fillText(tag, tx + tw / 2, sy - 18 + 1);
  c.font = '600 24px Inter, sans-serif'; c.fillStyle = '#fff';
  c.fillText('Kedai Karimata', tx + tw / 2, sy + 22);

  // Kepala: logo dan label
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.font = '58px Anton, Impact, sans-serif';
  c.fillStyle = '#fff'; c.fillText('ED', m, 330);
  const edw = c.measureText('ED ').width;
  c.fillStyle = lime; c.fillText('Club', m + edw, 330);
  c.font = '700 22px Inter, sans-serif';
  const chip = 'RUTE LARI 3D', cw = c.measureText(chip).width + 44, ch = 48;
  roundRect(c, W - m - cw, 330 - 40, cw, ch, ch / 2); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill();
  c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.45)'; c.stroke();
  c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(chip, W - m - cw + 22, 330 - 40 + ch / 2 + 1);

  c.textBaseline = 'alphabetic';
  c.font = '700 28px Inter, sans-serif'; c.fillStyle = 'rgba(255,255,255,.9)';
  c.fillText('SABTU  ·  20:00  ·  SURABAYA', m, 432);
  c.font = '124px Anton, Impact, sans-serif'; c.fillStyle = '#fff';
  c.fillText('ED FUN RUN', m, 565);
  const fw = c.measureText('ED FUN RUN ').width;
  c.fillStyle = lime; c.fillText('VOL. 1', m + fw, 565);

  // Kartu statistik
  const gap = 18, cardW = (W - m * 2 - gap * 2) / 3, cardY = 1318, cardH = 168;
  const cards = [[`${Math.round(total / 1000)} KM`, 'SATU LOOP'], ['20:00', 'SABTU MALAM'], ['KARIMATA', 'START & FINISH']];
  cards.forEach(([big, small], i) => {
    const x = m + i * (cardW + gap);
    roundRect(c, x, cardY, cardW, cardH, 30); c.fillStyle = 'rgba(255,255,255,.1)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.3)'; c.stroke();
    c.textAlign = 'center';
    c.font = `${big.length > 6 ? 46 : 70}px Anton, Impact, sans-serif`; c.fillStyle = i === 0 ? lime : '#fff';
    c.fillText(big, x + cardW / 2, cardY + 92);
    c.font = '700 20px Inter, sans-serif'; c.fillStyle = 'rgba(255,255,255,.75)';
    c.fillText(small, x + cardW / 2, cardY + 136);
  });

  // Ajakan dan alamat situs
  const host = /^(localhost|127\.|\[::1\]|)$/.test(location.hostname) ? 'edsocialclub.vercel.app' : location.host;
  roundRect(c, m, 1518, W - m * 2, 124, 62); c.fillStyle = lime; c.fill();
  c.textAlign = 'center'; c.fillStyle = ink;
  c.font = '800 36px Inter, sans-serif'; c.fillText('IKUT LARI BARENG KAMI  →', W / 2, 1578);
  c.font = '600 26px Inter, sans-serif'; c.fillText(`${host}/fun-run`, W / 2, 1618);
  return out;
};

// Peta khusus 1080×1920 di luar layar, lalu dibubuhi teks story
const renderStory = async (cam, { pixelRatio = 1 } = {}) => {
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-4000px;top:0;width:${STORY_W}px;height:${STORY_H}px;pointer-events:none`;
  document.body.appendChild(host);
  const m = new maplibregl.Map({
    container: host, style: STYLE_URL, center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing,
    interactive: false, attributionControl: false, pixelRatio, preserveDrawingBuffer: true, antialias: true, fadeDuration: 0,
  });
  try {
    await new Promise((r) => m.once('load', r));
    if (cam.padding) m.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing, padding: cam.padding });
    addMapLayers(m, { story: true });
    m.getSource('run').setData(line(coords));
    await Promise.race([new Promise((r) => m.once('idle', r)), new Promise((r) => setTimeout(r, 20000))]);
    await new Promise((r) => setTimeout(r, 500));
    return await composeStory(m.getCanvas(), (p) => m.project(p));
  } finally {
    m.remove(); host.remove();
  }
};
const liveCamera = () => ({
  center: map.getCenter(),
  zoom: clamp(map.getZoom() + Math.log2(STORY_W / map.getCanvas().clientWidth), 13.4, 16.6),
  pitch: map.getPitch(), bearing: map.getBearing(),
});

// Antarmuka bagikan (hanya jika halaman memuat panelnya)
(() => {
  const modal = document.getElementById('shareModal');
  if (!modal) return;
  const $ = (id) => document.getElementById(id);
  const img = $('shareImg'), dl = $('shareDl'), nativeBtn = $('shareNative'), liveBtn = $('shareLive');
  const urlInput = $('shareUrl'), toast = $('shareToast'), busy = $('shareBusy'), busyText = $('shareBusyText');
  const tabs = [...modal.querySelectorAll('[data-fmt]')];
  const FORMATS = {
    story: { src: 'assets/images/rute-fun-run-story.jpg', file: 'ed-fun-run-story.jpg', title: 'Story Instagram', native: 'Bagikan ke Instagram Story', live: 'Buat story dari tampilan peta ini', alt: 'Gambar story Instagram 9:16 berisi peta 3D rute ED Fun Run Vol. 1, satu loop 5 km dari dan ke Kedai Karimata' },
    wide: { src: 'assets/images/rute-fun-run-3d.jpg', file: SHARE_FILE, title: 'Gambar 3D & link lari', native: 'Bagikan…', live: 'Ambil tampilan peta saat ini', alt: 'Gambar 3D rute ED Fun Run Vol. 1: satu loop 5 km dari dan ke Kedai Karimata, Surabaya' },
  };
  let fmt = 'story', lastFocus = null, live = null, toastTimer = 0;

  const say = (msg) => {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  };
  const copyQuiet = async () => {
    const url = shareUrl();
    try { await navigator.clipboard.writeText(url); return true; }
    catch (e) { try { urlInput.value = url; urlInput.select(); return document.execCommand('copy'); } catch (e2) { return false; } }
  };
  const copy = async () => { say((await copyQuiet()) ? 'Link disalin' : 'Tidak bisa menyalin, salin manual dari kolom'); };
  const wa = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n${shareUrl()}`)}`;
  ['shareWa', 'shareWa2'].forEach((id) => { const a = $(id); if (a) a.href = wa; });

  const useDefault = () => {
    if (live) URL.revokeObjectURL(live);
    live = null;
    const F = FORMATS[fmt];
    img.src = F.src; img.alt = F.alt; dl.href = F.src; dl.setAttribute('download', F.file);
    liveBtn.textContent = F.live;
  };
  const setFormat = (f) => {
    fmt = f;
    const F = FORMATS[f];
    modal.classList.toggle('is-story', f === 'story');
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.fmt === f)));
    $('shareTitle').textContent = F.title;
    nativeBtn.textContent = F.native;
    $('shareSteps').hidden = f !== 'story';
    useDefault();
  };
  const open = (f) => {
    lastFocus = document.activeElement;
    setFormat(f);
    urlInput.value = shareUrl();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    modal.querySelector('.share-modal__x').focus();
  };
  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    lastFocus?.focus?.();
  };

  $('shareStoryOpen').addEventListener('click', () => open('story'));
  $('shareOpen').addEventListener('click', () => open('wide'));
  $('shareCopy').addEventListener('click', copy);
  $('shareCopy2').addEventListener('click', copy);
  tabs.forEach((t) => t.addEventListener('click', () => setFormat(t.dataset.fmt)));
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  // Unduh gambar story sekaligus menyalin link untuk stiker Link
  dl.addEventListener('click', async () => {
    if (fmt === 'story') say((await copyQuiet()) ? 'Gambar diunduh. Link disalin untuk stiker Link' : 'Gambar diunduh');
  });

  liveBtn.addEventListener('click', async () => {
    if (live) { useDefault(); return; }
    const forStory = fmt === 'story';
    busyText.textContent = forStory ? 'Membuat gambar story… butuh beberapa detik' : 'Menangkap tampilan peta…';
    busy.hidden = false; liveBtn.disabled = true;
    try {
      const out = forStory ? await renderStory(liveCamera(), { pixelRatio: matchMedia('(pointer: coarse)').matches ? 1 : 2 }) : await grabLiveMap();
      const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
      if (forStory !== (fmt === 'story')) return;       // format diganti selama proses
      live = URL.createObjectURL(blob);
      img.src = live; dl.href = live;
      liveBtn.textContent = 'Pakai gambar bawaan';
    } catch (e) { say('Gagal membuat gambar, coba lagi'); }
    finally { busy.hidden = true; liveBtn.disabled = false; }
  });

  // Bagikan langsung ke aplikasi lain (HP): di sinilah Instagram Story muncul
  if (navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', async () => {
      const url = shareUrl(), F = FORMATS[fmt];
      try {
        if (fmt === 'story') await copyQuiet();
        const blob = await (await fetch(img.src)).blob();
        const file = new File([blob], F.file, { type: blob.type || 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'ED Fun Run Vol. 1', text: fmt === 'story' ? SHARE_TEXT : `${SHARE_TEXT} ${url}` });
          if (fmt === 'story') say('Link sudah disalin, tempel di stiker Link');
        } else await navigator.share({ title: 'ED Fun Run Vol. 1', text: SHARE_TEXT, url });
      } catch (e) { if (e.name !== 'AbortError') say('Tidak bisa membagikan, coba unduh gambarnya'); }
    });
  }
})();
