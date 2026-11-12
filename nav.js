// Menu mobile (hamburger)
const burger = document.querySelector('.burger');
const setMenu = (open) => {
  document.body.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
};
burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
document.querySelectorAll('.menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
addEventListener('resize', () => { if (innerWidth > 820) setMenu(false); });

// Bar nav mendapat latar saat halaman di-scroll
const nav = document.querySelector('.nav');
const onScroll = () => nav.classList.toggle('is-scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
