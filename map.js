// Peta 3D rute lari: loop Kedai Karimata -> Kedai Karimata (Surabaya)
const coords = window.EDROUTE.coordinates;
const frame = document.querySelector('.run-map__frame');
const hudKm = document.getElementById('hudKm');
const hudBar = document.getElementById('hudBar');
const btnReplay = document.getElementById('mapReplay');
const btnFollow = document.getElementById('mapFollow');
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  style: 'https://tiles.openfreemap.org/styles/dark',
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

// Gedung 3D, garis rute, dan jejak lari (dipakai peta utama dan peta pembuat gambar bagikan)
const addMapLayers = (m) => {
  const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  m.addLayer({
    id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#262b26', 40, '#3b443a', 120, '#566152'],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.92,
    },
  }, firstSymbol);

  m.addSource('route', { type: 'geojson', data: line(coords) });
  m.addSource('run', { type: 'geojson', data: line([coords[0], coords[0]]) });
  m.addLayer({ id: 'route-base', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.28, 'line-width': 4, 'line-dasharray': [1, 2] } });
  m.addLayer({ id: 'run-glow', type: 'line', source: 'run', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d4ff3f', 'line-opacity': 0.4, 'line-width': 16, 'line-blur': 10 } });
  m.addLayer({ id: 'run-line', type: 'line', source: 'run', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d4ff3f', 'line-width': 5 } });
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

// Antarmuka bagikan (hanya jika halaman memuat panelnya)
(() => {
  const modal = document.getElementById('shareModal');
  if (!modal) return;
  const $ = (id) => document.getElementById(id);
  const img = $('shareImg'), dl = $('shareDl'), nativeBtn = $('shareNative'), liveBtn = $('shareLive');
  const urlInput = $('shareUrl'), toast = $('shareToast'), busy = $('shareBusy');
  const defaultSrc = img.getAttribute('src');
  let lastFocus = null, live = null, toastTimer = 0;

  const say = (msg) => {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2200);
  };
  const copy = async () => {
    const url = shareUrl();
    try { await navigator.clipboard.writeText(url); }
    catch (e) { urlInput.value = url; urlInput.select(); document.execCommand('copy'); }
    say('Link disalin');
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT}\n${shareUrl()}`)}`;
  ['shareWa', 'shareWa2'].forEach((id) => { const a = $(id); if (a) a.href = wa; });

  const open = () => {
    lastFocus = document.activeElement;
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
  const useDefault = () => {
    if (live) URL.revokeObjectURL(live); live = null;
    img.src = defaultSrc; dl.href = defaultSrc;
    liveBtn.textContent = 'Ambil tampilan peta saat ini';
  };

  $('shareOpen').addEventListener('click', open);
  $('shareCopy').addEventListener('click', copy);
  $('shareCopy2').addEventListener('click', copy);
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });

  liveBtn.addEventListener('click', async () => {
    if (live) { useDefault(); return; }
    busy.hidden = false; liveBtn.disabled = true;
    try {
      const out = await grabLiveMap();
      const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.92));
      live = URL.createObjectURL(blob);
      img.src = live; dl.href = live;
      liveBtn.textContent = 'Pakai gambar bawaan';
    } catch (e) { say('Gagal mengambil tampilan peta'); }
    busy.hidden = true; liveBtn.disabled = false;
  });

  // Bagikan langsung ke aplikasi lain (HP): gambar beserta teks dan link
  if (navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', async () => {
      const url = shareUrl();
      try {
        const blob = await (await fetch(img.src)).blob();
        const file = new File([blob], SHARE_FILE, { type: blob.type || 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'ED Fun Run Vol. 1', text: `${SHARE_TEXT} ${url}` });
        else await navigator.share({ title: 'ED Fun Run Vol. 1', text: SHARE_TEXT, url });
      } catch (e) { if (e.name !== 'AbortError') say('Tidak bisa membagikan, coba salin link'); }
    });
  }
})();
