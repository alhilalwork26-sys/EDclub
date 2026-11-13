const body = document.body;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Intro: tunggu gambar siap, lalu buka loader
const img = document.querySelector('.hero__img');
const start = () => {
  setTimeout(() => {
    body.classList.remove('is-loading');
    setTimeout(() => body.classList.add('is-ready'), 2600);
  }, 700);
};
img.complete ? start() : img.addEventListener('load', start, { once: true });

// Parallax halus mengikuti kursor
if (!reduce && matchMedia('(hover: hover)').matches) {
  const hero = document.querySelector('.hero');
  let tx = 0, ty = 0, cx = 0, cy = 0;
  hero.addEventListener('pointermove', (e) => {
    tx = (e.clientX / innerWidth - .5) * -24;
    ty = (e.clientY / innerHeight - .5) * -16;
  });
  const loop = () => {
    cx += (tx - cx) * .06;
    cy += (ty - cy) * .06;
    hero.style.setProperty('--mx', cx.toFixed(2) + 'px');
    hero.style.setProperty('--my', cy.toFixed(2) + 'px');
    requestAnimationFrame(loop);
  };
  loop();
}

// About: slider geser + reveal saat di-scroll
const track = document.getElementById('sliderTrack');
const step = () => (track.querySelector('.slide')?.offsetWidth || 300) + 20;
document.getElementById('sliderPrev').addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
document.getElementById('sliderNext').addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
}, { threshold: .15 });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

// Sports: cari, geser, dan lihat semua
const sTrack = document.getElementById('sportTrack');
const sCards = [...sTrack.querySelectorAll('.sport')];
const sEmpty = document.getElementById('sportEmpty');
const sStep = () => (sCards[0]?.offsetWidth || 260) + 18;
document.getElementById('sportPrev').addEventListener('click', () => sTrack.scrollBy({ left: -sStep(), behavior: 'smooth' }));
document.getElementById('sportNext').addEventListener('click', () => sTrack.scrollBy({ left: sStep(), behavior: 'smooth' }));

document.getElementById('sportSearch').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  let shown = 0;
  sCards.forEach((c) => {
    const hit = c.dataset.name.includes(q);
    c.classList.toggle('is-hidden', !hit);
    if (hit) shown++;
  });
  sEmpty.hidden = shown > 0;
  sTrack.scrollTo({ left: 0 });
});

const sToggle = document.getElementById('sportToggle');
sToggle.addEventListener('click', () => {
  const grid = sTrack.classList.toggle('is-grid');
  sToggle.setAttribute('aria-pressed', grid);
  sToggle.firstElementChild.textContent = grid ? 'Show Less' : 'View All';
});
