// Meja billiard animasi: bola ditata, dipukul, menyebar, lalu ditata ulang
(() => {
  const cv = document.getElementById('blTable');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 1000, H = 500, R = 15, POCKET = 30;
  const COLORS = ['#f4c21b', '#1b5fd0', '#d62b2b', '#6a2aa8', '#f2791c', '#1f9b4d', '#8a1f1f', '#111111'];
  const POCKETS = [[0, 0], [W / 2, -6], [W, 0], [0, H], [W / 2, H + 6], [W, H]];

  let balls = [], cue, state = 'rack', t0 = 0, running = false, last = 0, dpr = 1, scale = 1;

  const makeBall = (x, y, n) => ({ x, y, vx: 0, vy: 0, n, sunk: false, s: 1 });
  const rack = () => {
    balls = [];
    const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
    let i = 0;
    const x0 = W * 0.68, dx = R * 1.74;
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row <= col; row++) {
        balls.push(makeBall(x0 + col * dx, H / 2 + (row - col / 2) * (R * 2.02), order[i++]));
      }
    }
    cue = makeBall(W * 0.24, H / 2, 0);
    balls.push(cue);
    state = 'aim'; t0 = performance.now();
  };

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    scale = (w * dpr) / W;
  };

  const shade = (c, amt) => {
    const n = parseInt(c.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  const drawBall = (b) => {
    const r = R * b.s;
    if (r <= 0.5) return;
    const base = b.n === 0 ? '#f6f3ea' : COLORS[(b.n - 1) % 8];
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(3, 5, r, r * 0.9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
    ctx.fillStyle = b.n > 8 ? '#f6f3ea' : base;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    if (b.n > 8) { ctx.fillStyle = base; ctx.fillRect(-r, -r * 0.5, r * 2, r); }
    if (b.n > 0) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.46, 0, 7); ctx.fill();
      ctx.fillStyle = '#111'; ctx.font = `700 ${r * 0.62}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(b.n), 0, 1);
    }
    const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.65)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  };

  const drawCue = (dirx, diry, pull) => {
    const len = 340, gap = R + 6 + pull;
    const sx = cue.x - dirx * gap, sy = cue.y - diry * gap;
    const ex = sx - dirx * len, ey = sy - diry * len;
    const grad = ctx.createLinearGradient(sx, sy, ex, ey);
    grad.addColorStop(0, '#f0d9a8'); grad.addColorStop(0.12, '#c9a05a'); grad.addColorStop(1, '#4a2a14');
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(sx + 3, sy + 5); ctx.lineTo(ex + 3, ey + 5); ctx.stroke();
    ctx.strokeStyle = grad; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#7fb8e6'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - dirx * 7, sy - diry * 7); ctx.stroke();
    ctx.restore();
  };

  let shotDir = [1, 0];
  const physics = (k) => {
    const live = balls.filter((b) => !b.sunk);
    live.forEach((b) => {
      b.x += b.vx * k; b.y += b.vy * k;
      const f = Math.pow(0.989, k); b.vx *= f; b.vy *= f;
      if (Math.hypot(b.vx, b.vy) < 0.04) { b.vx = 0; b.vy = 0; }
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.92; }
      if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * 0.92; }
      if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.92; }
      if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy) * 0.92; }
      POCKETS.forEach(([px, py]) => { if (Math.hypot(b.x - px, b.y - py) < POCKET) { b.sunk = true; b.vx = b.vy = 0; b.x = px; b.y = py; } });
    });
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.sunk || b.sunk) continue;
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy);
      if (d > 0 && d < R * 2) {
        dx /= d; dy /= d;
        const o = (R * 2 - d) / 2; a.x -= dx * o; a.y -= dy * o; b.x += dx * o; b.y += dy * o;
        const p = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
        if (p > 0) { a.vx -= p * dx; a.vy -= p * dy; b.vx += p * dx; b.vy += p * dy; }
      }
    }
  };

  const frame = (now) => {
    if (!running) return;
    const k = Math.min((now - last) / 16.67, 3); last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // kantong
    ctx.fillStyle = '#050805';
    POCKETS.forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px, py, POCKET, 0, 7); ctx.fill(); });
    // garis kepala meja
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.3, 8); ctx.lineTo(W * 0.3, H - 8); ctx.stroke();

    const t = now - t0;
    if (state === 'aim') {
      const ang = Math.sin(t / 900) * 0.05;
      shotDir = [Math.cos(ang), Math.sin(ang)];
      const pull = t < 1400 ? 14 + Math.sin(t / 220) * 6 : 14 + Math.min((t - 1400) / 450, 1) * 44;
      if (t > 1850) {
        const rel = Math.min((t - 1850) / 120, 1);
        drawCue(shotDir[0], shotDir[1], 58 - rel * 58);
        if (t > 1970) { cue.vx = shotDir[0] * 19; cue.vy = shotDir[1] * 19 + (Math.random() - 0.5) * 1.2; state = 'roll'; t0 = now; }
      } else drawCue(shotDir[0], shotDir[1], pull);
    } else if (state === 'roll') {
      physics(k);
      const moving = balls.some((b) => !b.sunk && (b.vx || b.vy));
      if (!moving || t > 9000) { state = 'rest'; t0 = now; }
    } else if (state === 'rest') {
      if (t > 1800) { state = 'reset'; t0 = now; }
    } else if (state === 'reset') {
      balls.forEach((b) => { b.s = Math.max(0, 1 - t / 500); });
      if (t > 500) rack();
    }
    balls.forEach((b) => { if (b.sunk) b.s = Math.max(0, b.s - 0.06 * k); drawBall(b); });
    requestAnimationFrame(frame);
  };

  const start = () => { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); };
  const stop = () => { running = false; };

  resize(); rack();
  addEventListener('resize', resize);
  if (reduce) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    POCKETS.forEach(([px, py]) => { ctx.fillStyle = '#050805'; ctx.beginPath(); ctx.arc(px, py, POCKET, 0, 7); ctx.fill(); });
    balls.forEach(drawBall);
    return;
  }
  new IntersectionObserver((e) => (e[0].isIntersecting ? start() : stop()), { threshold: 0.1 }).observe(cv);
})();
