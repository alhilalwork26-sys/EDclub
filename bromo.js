// Peta 3D rute Bromo Marathon 2026 21K: terrain, terbang menyusuri rute, profil ketinggian yang bisa digeser
(() => {
  const D = window.EDBROMO;
  const frame = document.getElementById('brFrame');
  if (!D || !frame || !window.maplibregl) return;

  const pts = D.coordinates;                        // [lng, lat, elevasi]
  const coords = pts.map((p) => [p[0], p[1]]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const RUN_MS = 60000;
  const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
  const $ = (id) => document.getElementById(id);

  const haversine = (a, b) => {
    const dLat = (b[1] - a[1]) * RAD, dLng = (b[0] - a[0]) * RAD;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLng / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(s));
  };
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const total = cum[cum.length - 1];

  // Elevasi dihaluskan (rata-rata bergerak) karena data GPS berderau
  const smooth = (arr, w) => arr.map((_, i) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - w); k <= Math.min(arr.length - 1, i + w); k++) { s += arr[k]; n++; }
    return s / n;
  });
  const el = smooth(pts.map((p) => p[2]), 8);
  const minE = Math.min(...el), maxE = Math.max(...el);
  // Titik tertinggi memakai data asli supaya sama dengan angka di halaman
  const raw = pts.map((p) => p[2]);
  const rawMax = Math.max(...raw), iMax = raw.indexOf(rawMax);

  const locate = (d) => {
    d = clamp(d, 0, total);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; cum[mid] <= d ? (lo = mid) : (hi = mid); }
    const t = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    const a = coords[lo], b = coords[hi];
    return { idx: lo, pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ele: el[lo] + (el[hi] - el[lo]) * t };
  };
  const bearingOf = (a, b) => {
    const dLng = (b[0] - a[0]) * RAD, la = a[1] * RAD, lb = b[1] * RAD;
    const y = Math.sin(dLng) * Math.cos(lb);
    const x = Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dLng);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  };
  const angleDiff = (a, b) => ((b - a + 540) % 360) - 180;
  const line = (c) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: c } });
  const fmtKm = (m) => (m / 1000).toFixed(1).replace('.', ',');
  const fmtM = (m) => Math.round(m).toLocaleString('id-ID');

  /* ---------- Profil ketinggian ---------- */
  const lo = Math.floor(minE / 200) * 200 - 0, hi = Math.ceil(maxE / 200) * 200;
  const yOf = (e) => 8 + (1 - (e - lo) / (hi - lo)) * 84;           // persen tinggi grafik
  const plot = $('brPlot'), chart = $('brChart');
  const step = 3;
  let d = '';
  for (let i = 0; i < el.length; i += step) d += `${d ? 'L' : 'M'}${(cum[i] / total * 1000).toFixed(1)} ${(yOf(el[i]) * 2.4).toFixed(1)}`;
  d += `L1000 ${(yOf(el[el.length - 1]) * 2.4).toFixed(1)}`;
  const grid = [];
  for (let e = lo + 200; e <= hi; e += 200) grid.push(e);
  plot.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="brGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a3d" stop-opacity=".5"/><stop offset="1" stop-color="#ff7a3d" stop-opacity="0"/></linearGradient></defs>
      ${grid.map((e) => `<line class="grid" x1="0" x2="1000" y1="${(yOf(e) * 2.4).toFixed(1)}" y2="${(yOf(e) * 2.4).toFixed(1)}"/>`).join('')}
      <path class="area" d="${d}L1000 240L0 240Z"/><path class="line" d="${d}"/><path class="done" id="brDone" d=""/></svg>
    <div class="br-chart__y">${grid.map((e) => `<span style="top:${yOf(e)}%">${fmtM(e)} m</span>`).join('')}</div>
    <div class="br-chart__x">${[0, 5, 10, 15, 20].map((k) => `<span style="left:${k * 1000 / total * 100}%">${k} km</span>`).join('')}</div>
    <i class="br-cursor" id="brCursor"></i><i class="br-dot" id="brDot"></i>`);
  const donePath = $('brDone'), cursor = $('brCursor'), dot = $('brDot');

  /* ---------- Peta 3D ---------- */
  const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  const OVERVIEW = { padding: { top: 70, bottom: 110, left: 50, right: 50 }, pitch: 56, bearing: -12 };
  const map = new maplibregl.Map({
    container: 'brMap', style: STYLE_URL, bounds, fitBoundsOptions: OVERVIEW, pitch: OVERVIEW.pitch, bearing: OVERVIEW.bearing,
    maxPitch: 80, antialias: true, cooperativeGestures: true,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  // cameraForBounds mengabaikan pitch, jadi zoom dihitung datar lalu sedikit diperbesar
  const overviewCamera = () => {
    const cam = map.cameraForBounds(bounds, { padding: OVERVIEW.padding, bearing: OVERVIEW.bearing, pitch: 0 });
    return { center: cam.center, zoom: cam.zoom + 0.5, pitch: OVERVIEW.pitch, bearing: OVERVIEW.bearing };
  };

  const mk = (html, cls, pos) => {
    const e = document.createElement('div');
    e.className = cls; e.innerHTML = html;
    return new maplibregl.Marker({ element: e }).setLngLat(pos);
  };
  const runner = mk('<i></i>', 'br-runner', coords[0]);

  const TINT = {
    background: ['background-color', '#150a0c'], water: ['fill-color', '#101a2a'], waterway: ['line-color', '#14233a'],
    landuse_residential: ['fill-color', '#1d1012'], landcover_wood: ['fill-color', '#1c2a19'], landuse_park: ['fill-color', '#1c2a19'],
    highway_path: ['line-color', '#8a6a52'], highway_minor: ['line-color', '#5a463c'], highway_major_casing: ['line-color', 'rgba(255,122,61,0.2)'],
    highway_major_inner: ['line-color', '#7a6256'], highway_major_subtle: ['line-color', '#7a6256'],
  };

  map.on('load', () => {
    Object.entries(TINT).forEach(([id, [prop, color]]) => { if (map.getLayer(id)) map.setPaintProperty(id, prop, color); });
    map.addSource('dem', {
      type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 13,
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], attribution: 'Terrain: Mapzen / AWS',
    });
    map.setTerrain({ source: 'dem', exaggeration: 1.25 });
    const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
    map.addLayer({
      id: 'relief', type: 'hillshade', source: 'dem',
      paint: { 'hillshade-exaggeration': 0.6, 'hillshade-shadow-color': '#07030a', 'hillshade-highlight-color': '#8d6a52', 'hillshade-accent-color': '#2a1414' },
    }, firstSymbol);

    const L = { 'line-cap': 'round', 'line-join': 'round' };
    map.addSource('route', { type: 'geojson', data: line(coords) });
    map.addSource('run', { type: 'geojson', data: line([coords[0], coords[0]]) });
    map.addLayer({ id: 'route-base', type: 'line', source: 'route', layout: L, paint: { 'line-color': '#ffffff', 'line-opacity': 0.55, 'line-width': 3.5, 'line-dasharray': [1, 1.6] } });
    map.addLayer({ id: 'run-glow-wide', type: 'line', source: 'run', layout: L, paint: { 'line-color': '#ff7a3d', 'line-opacity': 0.28, 'line-width': 34, 'line-blur': 22 } });
    map.addLayer({ id: 'run-glow', type: 'line', source: 'run', layout: L, paint: { 'line-color': '#ff7a3d', 'line-opacity': 0.5, 'line-width': 14, 'line-blur': 8 } });
    map.addLayer({ id: 'run-line', type: 'line', source: 'run', layout: L, paint: { 'line-color': '#ff8a4c', 'line-width': 6.5 } });
    map.addLayer({ id: 'run-core', type: 'line', source: 'run', layout: L, paint: { 'line-color': '#ffffff', 'line-opacity': 0.9, 'line-width': 2 } });

    mk('<i></i><span>Start / Finish</span>', 'br-pin br-pin--start', coords[0]).addTo(map);
    mk(`<i></i><span>Titik tertinggi · ${fmtM(rawMax)} m</span>`, 'br-pin br-pin--top', locate(cum[iMax]).pos).addTo(map);
    [5, 10, 15, 20].forEach((k) => mk(`<span>${k} KM</span>`, 'br-km', locate(k * 1000).pos).addTo(map));
    map.jumpTo(overviewCamera());
    frame.classList.add('is-ready');

    new IntersectionObserver((entries, io) => {
      if (entries[0].isIntersecting) { io.disconnect(); startTour(); }
    }, { threshold: 0.5 }).observe(frame);
  });

  /* ---------- Animasi lari ---------- */
  const hudKm = $('brKm'), hudEle = $('brEle'), hudGrade = $('brGrade'), hudBar = $('brBar');
  const btnPlay = $('brPlay'), btnFollow = $('brFollow'), btnOverview = $('brOverview');
  let p = 0, playing = false, follow = true, smoothBearing = 0, last = 0, raf = 0, ready = false;

  const update = (cam = true) => {
    const dist = p * total;
    const { idx, pos, ele } = locate(dist);
    const ahead = locate(Math.min(dist + 120, total));
    const grade = (ahead.ele - ele) / 120 * 100;
    if (map.getSource('run')) map.getSource('run').setData(line([...coords.slice(0, idx + 1), pos]));
    runner.setLngLat(pos);
    hudKm.textContent = fmtKm(dist);
    hudEle.textContent = fmtM(ele);
    hudGrade.textContent = `${grade >= 0 ? '+' : '−'}${Math.abs(grade).toFixed(0)}`;
    hudBar.style.transform = `scaleX(${p})`;
    // Titik di profil
    const x = p * 100, y = yOf(ele);
    dot.style.left = `${x}%`; dot.style.top = `${y}%`; cursor.style.left = `${x}%`;
    let dd = '';
    for (let i = 0; i <= idx; i += step) dd += `${dd ? 'L' : 'M'}${(cum[i] / total * 1000).toFixed(1)} ${(yOf(el[i]) * 2.4).toFixed(1)}`;
    donePath.setAttribute('d', dd + `L${(p * 1000).toFixed(1)} ${(y * 2.4).toFixed(1)}`);
    if (follow && cam) {
      const look = locate(Math.min(dist + 500, total)).pos;
      smoothBearing += angleDiff(smoothBearing, bearingOf(pos, look)) * 0.06;
      map.jumpTo({ center: pos, bearing: smoothBearing, pitch: 66, zoom: 13.7 });
    }
  };

  const setPlayLabel = () => { btnPlay.textContent = playing ? 'Jeda' : (p >= 1 ? '↻ Putar ulang' : 'Lanjutkan'); };
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(now - last, 80); last = now;
    if (!playing) return;
    p = Math.min(1, p + dt / RUN_MS);
    update();
    if (p >= 1) { playing = false; setPlayLabel(); map.easeTo({ ...overviewCamera(), duration: 3200, essential: true }); }
  };
  const begin = async () => {
    p = 0; update(false);
    const first = bearingOf(coords[0], locate(500).pos);
    smoothBearing = first;
    if (follow) {
      map.flyTo({ center: coords[0], zoom: 13.7, pitch: 66, bearing: first, duration: 3000, essential: true });
      await new Promise((r) => setTimeout(r, 3100));
    }
    playing = true; setPlayLabel();
  };
  function startTour() {
    ready = true;
    cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick);
    if (reduce) { p = 1; update(); setPlayLabel(); map.jumpTo(overviewCamera()); return; }
    begin();
  }

  btnPlay.addEventListener('click', () => {
    if (!ready) return;
    if (playing) { playing = false; setPlayLabel(); return; }
    if (p >= 1) { begin(); return; }
    playing = true; setPlayLabel();
  });
  btnFollow.addEventListener('click', () => {
    follow = !follow;
    btnFollow.setAttribute('aria-pressed', follow);
    btnFollow.textContent = follow ? 'Kamera ikuti pelari' : 'Kamera bebas';
    if (!follow) map.easeTo({ ...overviewCamera(), duration: 1400 });
  });
  btnOverview.addEventListener('click', () => {
    follow = false; btnFollow.setAttribute('aria-pressed', false); btnFollow.textContent = 'Kamera bebas';
    map.easeTo({ ...overviewCamera(), duration: 1800 });
  });
  map.on('dragstart', () => {
    if (follow && playing) { follow = false; btnFollow.setAttribute('aria-pressed', false); btnFollow.textContent = 'Kamera bebas'; }
  });

  // Geser profil ketinggian untuk melompat ke titik mana pun di rute
  let scrubbing = false;
  const scrubTo = (e) => {
    const r = plot.getBoundingClientRect();
    p = clamp((e.clientX - r.left) / r.width, 0, 1);
    playing = false; setPlayLabel();
    update();
  };
  chart.addEventListener('pointerdown', (e) => {
    if (!ready) return;
    scrubbing = true; chart.setPointerCapture(e.pointerId); scrubTo(e);
    if (follow) map.stop();
  });
  chart.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e); });
  const endScrub = () => { scrubbing = false; };
  chart.addEventListener('pointerup', endScrub);
  chart.addEventListener('pointercancel', endScrub);

  // Semangat untuk Ayah: hati beterbangan dari tombol
  const cheer = $('brCheer');
  if (cheer && !reduce) {
    cheer.addEventListener('click', () => {
      const r = cheer.getBoundingClientRect();
      for (let i = 0; i < 12; i++) {
        const h = document.createElement('i');
        h.className = 'br-heart';
        h.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.5 2 12 2 8.5 2 5.5 4.3 3.5 7 3.5c2 0 3.8 1.1 5 2.9 1.2-1.8 3-2.9 5-2.9 2.7 0 5 2 5 5 0 3.5-3 7-10 12.5z"/></svg>';
        h.style.left = `${r.left + r.width * (0.15 + Math.random() * 0.7)}px`;
        h.style.top = `${r.top + r.height / 2}px`;
        document.body.appendChild(h);
        const dx = (Math.random() - 0.5) * 120, dy = -90 - Math.random() * 120;
        h.animate([
          { transform: 'translate(0,0) scale(.4)', opacity: 0 },
          { transform: `translate(${dx * 0.4}px,${dy * 0.5}px) scale(1.1)`, opacity: 1, offset: 0.3 },
          { transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: 0 },
        ], { duration: 1100 + Math.random() * 500, delay: i * 40, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' }).onfinish = () => h.remove();
      }
    });
  }
})();
