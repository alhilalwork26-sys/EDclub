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
let follow = true, running = false, raf = 0, smoothBearing = 0, started = false;

map.on('load', () => {
  // Gedung 3D di atas data OpenStreetMap
  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer({
    id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
    paint: {
      'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8], 0, '#262b26', 40, '#3b443a', 120, '#566152'],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.92,
    },
  }, firstSymbol);

  map.addSource('route', { type: 'geojson', data: line(coords) });
  map.addSource('run', { type: 'geojson', data: line([coords[0], coords[0]]) });
  map.addLayer({ id: 'route-base', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.28, 'line-width': 4, 'line-dasharray': [1, 2] } });
  map.addLayer({ id: 'run-glow', type: 'line', source: 'run', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d4ff3f', 'line-opacity': 0.4, 'line-width': 16, 'line-blur': 10 } });
  map.addLayer({ id: 'run-line', type: 'line', source: 'run', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d4ff3f', 'line-width': 5 } });

  startPin.addTo(map);

  // Marshal di tikungan, water station di tengah rute, P3K di start/finish
  const nearest = (lngLat) => coords.reduce((best, c) => (haversine(c, lngLat) < haversine(best, lngLat) ? c : best), coords[0]);
  const aid = (cls, label, text, lngLat) => {
    const el = document.createElement('div');
    el.className = `aid aid--${cls}`;
    el.textContent = label;
    el.title = text;
    new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
  };
  [[112.74618, -7.27632], [112.74443, -7.27255], [112.7496, -7.26599], [112.74774, -7.26534], [112.74878, -7.2617], [112.75138, -7.26658], [112.74925, -7.2771]]
    .forEach((p, i) => aid('marshal', 'M', `Marshal ${i + 1}`, nearest(p)));
  aid('water', 'W', `Water station · km ${fmtKm(total / 2)}`, pointAt(total / 2).pos);
  aid('med', '+', 'Titik P3K (start & finish)', pointAt(120).pos);
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
  const { idx, pos } = pointAt(d);
  map.getSource('run').setData(line([...coords.slice(0, idx + 1), pos]));
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
  map.fitBounds(bounds, { ...overview, duration: 3200, essential: true });
};

const play = () => {
  cancelAnimationFrame(raf);
  running = true;
  frame.classList.remove('is-done');
  frame.classList.add('is-running');
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
    map.fitBounds(bounds, { ...overview, duration: 1200 });
    setTimeout(go, 1300);
  }
};

btnReplay.addEventListener('click', () => { if (map.loaded()) play(); });
btnFollow.addEventListener('click', () => {
  follow = !follow;
  btnFollow.setAttribute('aria-pressed', follow);
  btnFollow.textContent = follow ? 'Kamera ikuti pelari' : 'Kamera bebas';
  if (!follow && running) map.easeTo({ ...overview, center: bounds.getCenter(), zoom: undefined, duration: 1200 });
});
map.on('dragstart', () => {
  if (running && follow) { follow = false; btnFollow.setAttribute('aria-pressed', false); btnFollow.textContent = 'Kamera bebas'; }
});
