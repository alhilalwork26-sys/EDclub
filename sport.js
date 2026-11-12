// Skrip bersama untuk halaman tiap olahraga
(() => {
const body = document.body;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Intro: buka loader setelah foto hero siap (maksimal 4 detik)
const heroImg = document.querySelector('[data-hero-img]');
const openPage = () => body.classList.remove('is-loading');
const startPage = () => setTimeout(openPage, 600);
if (heroImg) heroImg.complete ? startPage() : heroImg.addEventListener('load', startPage, { once: true });
else startPage();
setTimeout(openPage, 4000);

const whenOpen = (fn) => (body.classList.contains('is-loading') ? setTimeout(() => whenOpen(fn), 200) : fn());

// Muncul saat di-scroll
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
}, { threshold: 0.15 });
document.querySelectorAll('[data-reveal]').forEach((el) => revealIO.observe(el));

// Angka naik
const runCount = (el) => {
  if (el._done) return;
  el._done = true;
  const to = +el.dataset.count, dur = +(el.dataset.dur || 1600), suffix = el.dataset.suffix || '';
  const pad = +(el.dataset.pad || 0);
  const t0 = performance.now();
  const tick = (t) => {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3)))).padStart(pad, '0') + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { whenOpen(() => runCount(e.target)); countIO.unobserve(e.target); } });
}, { threshold: 0.4 });
document.querySelectorAll('[data-count]').forEach((el) => countIO.observe(el));

// Geser dengan mouse + tombol panah
document.querySelectorAll('.drag').forEach((el) => {
  let down = false, startX = 0, startLeft = 0;
  el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; startX = e.clientX; startLeft = el.scrollLeft; el.classList.add('is-drag'); });
  addEventListener('pointerup', () => { down = false; el.classList.remove('is-drag'); });
  el.addEventListener('pointermove', (e) => { if (down) el.scrollLeft = startLeft - (e.clientX - startX); });
});
document.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
  const t = document.querySelector(b.dataset.target);
  t.scrollBy({ left: +b.dataset.scroll * (t.firstElementChild.offsetWidth + 16), behavior: 'smooth' });
}));

// Tab
document.querySelectorAll('[data-tabs]').forEach((box) => {
  const tabs = [...box.querySelectorAll('[data-tab]')], panels = [...box.querySelectorAll('[data-panel]')];
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => x.setAttribute('aria-selected', x === t));
    panels.forEach((p) => p.classList.toggle('is-on', p.dataset.panel === t.dataset.tab));
  }));
});

// Penghitung repetisi dekoratif (halaman gym)
document.querySelectorAll('[data-loop]').forEach((el) => {
  const max = +el.dataset.loop; let n = 0;
  setInterval(() => { n = (n % max) + 1; el.textContent = String(n).padStart(2, '0'); }, +el.dataset.ms || 850);
});

// Animasi SVG (SMIL) dihentikan jika pengguna memilih gerakan minimal
if (reduce) document.querySelectorAll('.gm-stage svg').forEach((s) => s.pauseAnimations && s.pauseAnimations());

// Parallax dan garis yang tergambar saat scroll
const parallax = [...document.querySelectorAll('[data-parallax]')];
const draws = [...document.querySelectorAll('[data-draw-box]')];
let ticking = false;
const onScroll = () => {
  const y = scrollY, vh = innerHeight;
  if (!reduce) parallax.forEach((el) => { el.style.transform = `translate3d(0, ${y * +el.dataset.parallax}px, 0)`; });
  draws.forEach((box) => {
    const r = box.getBoundingClientRect();
    const p = clamp((vh * 0.85 - r.top) / (r.height * 0.9), 0, 1);
    box.style.setProperty('--p', p.toFixed(3));
    box.querySelectorAll('[data-draw]').forEach((path) => { path.style.strokeDashoffset = 1 - p; });
    box.querySelectorAll('[data-at]').forEach((pt) => pt.classList.toggle('is-hit', p >= +pt.dataset.at));
  });
  ticking = false;
};
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
onScroll();
})();
