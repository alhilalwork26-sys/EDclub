// Dua pendaki (Al dan Ode) menanjak mengikuti garis profil jalur
(() => {
  const box = document.querySelector('.gn-elev');
  const path = box?.querySelector('.path');
  const al = box?.querySelector('.gn-hiker--al');
  const ode = box?.querySelector('.gn-hiker--ode');
  if (!path || !al || !ode) return;

  const VW = 1000, VH = 300;
  const total = path.getTotalLength();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (p) => 0.5 - Math.cos(Math.PI * p) / 2;
  const CLIMB = 13000, GAP = 1100, REST = 2400;

  const place = (el, p) => {
    const L = Math.max(0, Math.min(1, p)) * total;
    const a = path.getPointAtLength(L), b = path.getPointAtLength(Math.min(total, L + 6));
    el.style.left = (a.x / VW * 100) + '%';
    el.style.top = (a.y / VH * 100) + '%';
    const r = box.getBoundingClientRect();
    const dx = (b.x - a.x) * r.width / VW, dy = (b.y - a.y) * r.height / VH;
    const ang = Math.max(-16, Math.min(16, Math.atan2(dy, dx) * 180 / Math.PI));
    el.firstElementChild.nextElementSibling.style.transform = `rotate(${ang.toFixed(1)}deg)`;
  };

  if (reduce) {
    [al, ode].forEach((el, i) => { el.classList.add('is-on'); place(el, 0.62 - i * 0.1); });
    return;
  }

  let raf = 0, t0 = 0, running = false;
  const frame = (now) => {
    if (!running) return;
    const t = now - t0;
    const pA = ease(Math.min(t / CLIMB, 1));
    const pO = ease(Math.min(Math.max(t - GAP, 0) / CLIMB, 1)) * 0.93;
    place(al, pA); place(ode, pO);
    al.classList.toggle('is-top', pA >= 1);
    ode.classList.toggle('is-top', pO >= 0.93);
    if (t > CLIMB + GAP + REST) {
      [al, ode].forEach((el) => el.classList.remove('is-on'));
      if (t > CLIMB + GAP + REST + 700) { t0 = now; [al, ode].forEach((el) => el.classList.add('is-on')); }
    } else if (t > 0) { al.classList.add('is-on'); if (t > GAP * 0.5) ode.classList.add('is-on'); }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running) return; running = true; t0 = performance.now(); place(al, 0); place(ode, 0); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  new IntersectionObserver((e) => (e[0].isIntersecting ? start() : stop()), { threshold: 0.2 }).observe(box);
})();
