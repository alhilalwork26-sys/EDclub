// Kursor wajah beranimasi: mengikuti mouse dengan sedikit tertinggal, miring saat bergerak,
// membesar di atas elemen yang bisa diklik, memipih saat klik, dan memercikkan air mata.
(() => {
  // Hanya untuk perangkat dengan mouse; layar sentuh tidak punya kursor.
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SRC = 'assets/images/cursor-face.webp';

  const probe = new Image();
  probe.onload = init;       // kursor bawaan baru disembunyikan setelah gambar siap
  probe.src = SRC;

  function init() {
    const root = document.documentElement;
    const el = document.createElement('div');
    el.className = 'face-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="fc-tilt"><div class="fc-scale"><img class="fc-img" src="${SRC}" alt="" draggable="false"></div></div>`;
    document.body.appendChild(el);
    const tilt = el.firstElementChild;

    let tx = -100, ty = -100, x = tx, y = ty, vx = 0, rot = 0, started = false;
    const set = (cls, on) => el.classList.toggle(cls, on);

    const classify = (t) => {
      const target = t && t.closest ? t : null;
      const text = !!target?.closest('input, textarea, [contenteditable="true"]');
      const hot = !text && !!target?.closest('a, button, summary, label, select, [role="button"], .sport, .stop, .drag, .nav-btn, .map-btn');
      set('is-text', text);
      set('is-hover', hot);
    };

    addEventListener('pointermove', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!started) { started = true; x = tx; y = ty; root.classList.add('has-face-cursor'); }
      set('is-on', true);
      classify(e.target);
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      set('is-down', true);
      if (e.button === 0 && !el.classList.contains('is-text')) burst();
    }, { passive: true });
    addEventListener('pointerup', () => set('is-down', false), { passive: true });
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) set('is-on', false); });
    addEventListener('blur', () => { set('is-on', false); set('is-down', false); });

    // Percikan air mata saat klik
    const burst = () => {
      if (reduce) return;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const d = document.createElement('i');
        d.className = 'fc-drop';
        d.style.left = x + 'px';
        d.style.top = y + 'px';
        document.body.appendChild(d);
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        const dist = 34 + Math.random() * 30;
        d.animate([
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 20}px)) scale(.3)`, opacity: 0 },
        ], { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => d.remove();
      }
    };

    let prev = performance.now();
    const loop = (now) => {
      // Pergerakan dihitung per waktu supaya tetap mulus di layar 60 maupun 120 Hz
      const f = Math.min((now - prev) / 16.67, 4); prev = now;
      const k = reduce ? 1 : 1 - Math.pow(0.68, f);
      const dx = tx - x, dy = ty - y;
      x += dx * k; y += dy * k;
      vx += (dx - vx) * (1 - Math.pow(0.8, f));
      const targetRot = reduce ? 0 : Math.max(-28, Math.min(28, vx * 0.9));
      rot += (targetRot - rot) * (1 - Math.pow(0.8, f));
      const stretch = reduce ? 0 : Math.min(Math.hypot(dx, dy) * 0.004, 0.18);
      el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      tilt.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${(1 + stretch).toFixed(3)},${(1 - stretch * 0.6).toFixed(3)})`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();
