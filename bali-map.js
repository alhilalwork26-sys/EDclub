// Peta 3D Bali: tur Uluwatu -> Kuta -> Kintamani -> Ubud
const { places, legs } = window.EDBALI;
const frame = document.getElementById('baliFrame');
const hudStep = document.getElementById('baliStep');
const hudName = document.getElementById('baliName');
const hudBar = document.getElementById('baliBar');
const stopEls = [...document.querySelectorAll('.stop')];
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const RAD = Math.PI / 180;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const haversine = (a, b) => {
  const dLat = (b[1] - a[1]) * RAD, dLng = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(s));
};
const bearingOf = (a, b) => {
  const dLng = (b[0] - a[0]) * RAD, la = a[1] * RAD, lb = b[1] * RAD;
  const y = Math.sin(dLng) * Math.cos(lb);
  const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dLng);
  return (Math.atan2(y, x) / RAD + 360) % 360;
};
const angleDiff = (a, b) => ((b - a + 540) % 360) - 180;
const ease = (p) => 0.5 - Math.cos(Math.PI * p) / 2;
const line = (c) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c } });

// Jarak kumulatif per leg
legs.forEach((leg) => {
  leg.cum = [0];
  for (let i = 1; i < leg.coordinates.length; i++) leg.cum.push(leg.cum[i - 1] + haversine(leg.coordinates[i - 1], leg.coordinates[i]));
  leg.total = leg.cum[leg.cum.length - 1];
});
const pointAt = (leg, d) => {
  d = clamp(d, 0, leg.total);
  let lo = 0, hi = leg.cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; leg.cum[mid] <= d ? (lo = mid) : (hi = mid); }
  const seg = leg.cum[hi] - leg.cum[lo] || 1;
  const t = (d - leg.cum[lo]) / seg;
  const a = leg.coordinates[lo], b = leg.coordinates[hi];
  return { idx: lo, pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
};
const grandTotal = legs.reduce((s, l) => s + l.total, 0);
const km = (m) => Math.round(m / 1000);
document.getElementById('baliTotal').textContent = `±${km(grandTotal)} km`;
legs.forEach((l, i) => {
  const el = document.querySelector(`.stop__leg[data-leg="${i + 1}"]`);
  if (el) el.textContent = `±${km(l.total)} km dari ${l.from}`;
});

const allCoords = legs.flatMap((l) => l.coordinates);
const bounds = allCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));
const overview = { padding: { top: 60, bottom: 60, left: 40, right: 40 }, pitch: 58, bearing: -22 };
const focusOf = (i, extra = {}) => ({ center: [places[i].lng, places[i].lat], zoom: 11.6, pitch: 68, bearing: 25 + i * 40, ...extra });

const map = new maplibregl.Map({
  container: 'bmap',
  style: 'https://tiles.openfreemap.org/styles/dark',
  bounds,
  fitBoundsOptions: overview,
  pitch: overview.pitch,
  bearing: overview.bearing,
  maxBounds: [[114.3, -9.1], [115.9, -7.9]],
  maxPitch: 80,
  cooperativeGestures: true,
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

const pinEl = (n, name) => {
  const el = document.createElement('div');
  el.className = 'bpin';
  el.innerHTML = `<i>${n}</i><span>${name}</span>`;
  return el;
};

let runId = 0, ready = false, started = false;

const setActive = (i) => {
  stopEls.forEach((el, k) => el.classList.toggle('is-active', k === i));
  if (i == null) return;
  hudStep.textContent = `Destinasi ${i + 1} dari ${places.length}`;
  hudName.textContent = places[i].name;
};

map.on('load', () => {
  map.addSource('dem', {
    type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 13,
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    attribution: 'Terrain: Mapzen / AWS',
  });
  map.setTerrain({ source: 'dem', exaggeration: 1.7 });
  // Daratan lebih terang dari laut supaya bentuk pulau terbaca
  const tint = { background: ['background-color', '#243222'], water: ['fill-color', '#070d12'], landcover_wood: ['fill-color', '#2f4a31'], landuse_park: ['fill-color', '#35553a'], landuse_residential: ['fill-color', '#2e382c'] };
  Object.entries(tint).forEach(([id, [prop, color]]) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, color); });
  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addLayer({
    id: 'relief', type: 'hillshade', source: 'dem',
    paint: { 'hillshade-exaggeration': 0.9, 'hillshade-shadow-color': '#02060a', 'hillshade-highlight-color': '#9cc48a', 'hillshade-accent-color': '#2a3a28' },
  }, firstSymbol);

  map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: legs.map((l) => line(l.coordinates)) } });
  map.addSource('run', { type: 'geojson', data: line([allCoords[0], allCoords[0]]) });
  map.addLayer({ id: 'route-base', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.3, 'line-width': 3, 'line-dasharray': [1, 2] } });
  map.addLayer({ id: 'run-glow', type: 'line', source: 'run', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d4ff3f', 'line-opacity': 0.4, 'line-width': 14, 'line-blur': 9 } });
  map.addLayer({ id: 'run-line', type: 'line', source: 'run', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#d4ff3f', 'line-width': 4 } });

  places.forEach((p, i) => new maplibregl.Marker({ element: pinEl(i + 1, p.name) }).setLngLat([p.lng, p.lat]).addTo(map));

  ready = true;
  frame.classList.add('is-ready');
  new IntersectionObserver((entries, io) => {
    if (entries[0].isIntersecting && !started) { started = true; io.disconnect(); tour(); }
  }, { threshold: 0.5 }).observe(frame);
});

const fly = (opts, ms) => { map.flyTo({ ...opts, duration: ms, essential: true }); return wait(ms + 80); };

const driveLeg = (leg, id, doneBefore) => new Promise((resolve) => {
  const prior = legs.slice(0, doneBefore).flatMap((l) => l.coordinates);
  const dur = clamp(leg.total / 1000 * 170, 5200, 11500);
  const first = bearingOf(leg.coordinates[0], pointAt(leg, 600).pos);
  let bearing = first;
  const t0 = performance.now();
  const frameFn = (now) => {
    if (id !== runId) return resolve(false);
    const p = Math.min((now - t0) / dur, 1);
    const d = ease(p) * leg.total;
    const { idx, pos } = pointAt(leg, d);
    map.getSource('run').setData(line([...prior, ...leg.coordinates.slice(0, idx + 1), pos]));
    const done = legs.slice(0, doneBefore).reduce((s, l) => s + l.total, 0) + d;
    hudBar.style.transform = `scaleX(${done / grandTotal})`;
    const ahead = pointAt(leg, Math.min(d + 1500, leg.total)).pos;
    bearing += angleDiff(bearing, bearingOf(pos, ahead)) * 0.035;
    map.jumpTo({ center: pos, bearing, pitch: 66, zoom: 10.7 });
    p < 1 ? requestAnimationFrame(frameFn) : resolve(true);
  };
  requestAnimationFrame(frameFn);
});

async function tour() {
  if (!ready) return;
  const id = ++runId;
  frame.classList.remove('is-done');
  frame.classList.add('is-running');
  map.getSource('run').setData(line([allCoords[0], allCoords[0]]));
  hudBar.style.transform = 'scaleX(0)';
  hudStep.textContent = 'Pulau Bali';
  hudName.textContent = 'Tur dimulai';
  stopEls.forEach((el) => el.classList.remove('is-active'));

  if (prefersReduced) {
    map.getSource('run').setData(line(allCoords));
    hudBar.style.transform = 'scaleX(1)';
    hudName.textContent = 'Uluwatu → Ubud';
    frame.classList.remove('is-running'); frame.classList.add('is-done');
    return;
  }

  map.fitBounds(bounds, { ...overview, duration: 1400, essential: true });
  await wait(1700); if (id !== runId) return;
  await fly(focusOf(0), 3200); if (id !== runId) return;
  setActive(0);
  await wait(2200); if (id !== runId) return;

  for (let i = 0; i < legs.length; i++) {
    const ok = await driveLeg(legs[i], id, i);
    if (!ok || id !== runId) return;
    setActive(i + 1);
    map.easeTo({ ...focusOf(i + 1), duration: 1800, essential: true });
    await wait(i === legs.length - 1 ? 2600 : 3000); if (id !== runId) return;
  }
  hudStep.textContent = 'Selesai';
  hudName.textContent = 'Uluwatu → Ubud';
  stopEls.forEach((el) => el.classList.remove('is-active'));
  frame.classList.remove('is-running'); frame.classList.add('is-done');
  map.fitBounds(bounds, { ...overview, duration: 3200, essential: true });
}

const toOverview = () => {
  runId++;
  frame.classList.remove('is-running');
  setActive(null);
  hudStep.textContent = 'Pulau Bali';
  hudName.textContent = '4 destinasi';
  map.getSource('run')?.setData(line(allCoords));
  hudBar.style.transform = 'scaleX(1)';
  map.fitBounds(bounds, { ...overview, duration: 2200, essential: true });
};

document.getElementById('baliReplay').addEventListener('click', tour);
document.getElementById('baliOverview').addEventListener('click', toOverview);
stopEls.forEach((el, i) => el.addEventListener('click', () => {
  if (!ready) return;
  runId++;
  frame.classList.remove('is-running');
  map.getSource('run').setData(line(allCoords));
  hudBar.style.transform = 'scaleX(1)';
  setActive(i);
  map.flyTo({ ...focusOf(i), duration: 2600, essential: true });
  frame.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));
map.on('dragstart', () => { if (frame.classList.contains('is-running')) { runId++; frame.classList.remove('is-running'); } });
