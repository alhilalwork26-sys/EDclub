const body = document.body;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Intro: buka loader setelah foto siap (atau maksimal 4 detik)
const img = document.querySelector('.run-hero__photo img');
const open = () => body.classList.remove('is-loading');
const start = () => setTimeout(open, 600);
img.complete ? start() : img.addEventListener('load', start, { once: true });
setTimeout(open, 4000);

// Reveal saat di-scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
}, { threshold: .2 });
document.querySelectorAll('[data-reveal], .run-steps__list, .run-steps').forEach((el) => io.observe(el));

// Ticker bergeser mengikuti scroll, foto sedikit parallax
if (!reduce) {
  const ticker = document.getElementById('ticker');
  const photo = document.querySelector('.run-hero__photo img');
  let ticking = false;
  const update = () => {
    const y = scrollY;
    ticker.style.transform = `translateX(${-y * .55}px)`;
    if (y < innerHeight) photo.style.transform = `translateY(${y * .08}px) scale(1.06)`;
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
}
