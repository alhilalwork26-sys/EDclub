// Hati-hati melayang dari pesepeda pengejar menuju temannya di depan
(() => {
  const pack = document.querySelector('.sd-pack');
  const chase = pack?.querySelector('.sd-rider--chase');
  const lead = pack?.querySelector('.sd-rider--lead');
  const hero = document.querySelector('.sd-hero');
  if (!pack || !chase || !lead || !hero) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.5 2 12 2 8.5 2 5.5 4.3 3.5 7 3.5c2 0 3.8 1.1 5 2.9 1.2-1.8 3-2.9 5-2.9 2.7 0 5 2 5 5 0 3.5-3 7-10 12.5z"/></svg>';
  const COLORS = ['#ff3d6e', '#ff6b8f', '#e0245e', '#ff8fab'];
  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; };
  const headOf = (rider) => rider.querySelector('image') || rider;
  let timer = 0, n = 0;

  const spawn = () => {
    const o = pack.getBoundingClientRect();
    const [cx, cy, cw] = center(headOf(chase));
    const [lx, ly] = center(headOf(lead));
    const size = 24 + (n % 3) * 8;
    const startX = cx + cw * 0.38 - o.left;
    const startY = cy - o.top;
    const dx = (lx - cw * 0.45) - (cx + cw * 0.38);
    const dy = ly - cy;
    const h = document.createElement('span');
    h.className = 'sd-heart';
    h.style.cssText = `left:${startX.toFixed(1)}px;top:${startY.toFixed(1)}px;--dx:${dx.toFixed(1)}px;--dy:${dy.toFixed(1)}px;--s:${size}px;--c:${COLORS[n % COLORS.length]};--t:${(1.05 + (n % 3) * 0.12).toFixed(2)}s`;
    h.innerHTML = `<i>${HEART}</i>`;
    h.addEventListener('animationend', (e) => {
      if (e.animationName !== 'sd-heart-x') return;
      h.remove();
      lead.classList.remove('is-love'); void lead.offsetWidth; lead.classList.add('is-love');
    });
    pack.appendChild(h);
    n++;
  };

  let inView = false;
  const sync = () => {
    if (inView && !document.hidden) { if (!timer) timer = setInterval(spawn, 430); }
    else { clearInterval(timer); timer = 0; }
  };
  new IntersectionObserver((e) => { inView = e[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(hero);
  document.addEventListener('visibilitychange', sync);
})();
