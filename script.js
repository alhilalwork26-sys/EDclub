const modalData = {
  about: {
    title: "Tentang English Day",
    body: `<p>English Day awalnya cuma kumpul mingguan buat latihan ngobrol bahasa Inggris bareng teman-teman. Lama-lama kita sadar, cara paling seru buat belajar adalah dengan jalan-jalan bareng — sambil ngobrol, sambil eksplor tempat baru.</p>
    <p>Board ini adalah "meja kerja" digital kita: catatan trip, jadwal ketemuan, foto-foto perjalanan, sampai obrolan random yang nempel kayak sticky note.</p>`
  },
  destinations: {
    title: "Destinasi",
    body: `<p>Tempat-tempat yang udah dan mau kita jelajahi bareng:</p>
    <ul>
      <li>🏖️ Pantai Karang Bolong — sunset trip pertama kita</li>
      <li>🏔️ Dieng Plateau — camping + latihan speaking di alam terbuka</li>
      <li>🏙️ Yogyakarta — city walk & english cafe hopping</li>
      <li>🌊 Nusa Penida — masih wishlist, lagi nabung bareng!</li>
    </ul>`
  },
  itinerary: {
    title: "Trip Plan Berikutnya",
    body: `<p>Rencana perjalanan yang lagi disusun panitia:</p>
    <table>
      <tr><th>Waktu</th><th>Kegiatan</th></tr>
      <tr><td>06.00</td><td>Kumpul & briefing (English only!)</td></tr>
      <tr><td>08.00</td><td>Berangkat bareng</td></tr>
      <tr><td>12.00</td><td>Eksplor + games seru</td></tr>
      <tr><td>16.00</td><td>Sharing session & foto-foto</td></tr>
    </table>`
  },
  schedule: {
    title: "Jadwal Rutin",
    body: `<ul>
      <li>Setiap Sabtu — Speaking Club (offline/online)</li>
      <li>Sebulan sekali — Mini trip / day trip</li>
      <li>3 bulan sekali — Big trip ke luar kota</li>
    </ul>
    <p>Jadwal detail selalu diupdate lewat grup WhatsApp ya!</p>`
  },
  members: {
    title: "The Crew",
    body: `<div class="crew-grid">
      <div class="crew-card"><div class="crew-avatar"></div>Fira</div>
      <div class="crew-card"><div class="crew-avatar"></div>Bagas</div>
      <div class="crew-card"><div class="crew-avatar"></div>Nadia</div>
      <div class="crew-card"><div class="crew-avatar"></div>Rizky</div>
      <div class="crew-card"><div class="crew-avatar"></div>Alya</div>
      <div class="crew-card"><div class="crew-avatar"></div>Dimas</div>
    </div>`
  },
  event: {
    title: "Next Trip",
    body: `<p><strong>Belum ada tanggal fix</strong> — tapi tim lagi survei lokasi baru! Pantau terus sticky note di board ini, biasanya info trip berikutnya nongol duluan di sini sebelum di grup 😉</p>`
  },
  gallery: {
    title: "Galeri",
    body: `<p>Kumpulan momen seru English Day. Foto-foto asli akan ditambahkan di sini — untuk sementara, bayangkan sunset, ketawa bareng, dan banyak percakapan bahasa Inggris yang belepotan tapi seru 😄</p>`
  },
  joke: {
    title: "Psst...",
    body: `<p>Kalau lagi bosan pas latihan speaking, inget aja: grammar boleh salah, yang penting berani ngomong. 🙂</p>`
  },
  joke2: {
    title: "Catatan Penting",
    body: `<p>Checklist wajib sebelum trip: paspor/KTP, charger, kamera, dan mental buat ngomong Inggris seharian!</p>`
  },
  contact: {
    title: "Contact Us",
    body: `<p>Ada pertanyaan atau mau gabung English Day? Kirim pesan lewat form ini:</p>
    <form class="contact-form" id="contactForm">
      <input type="text" name="name" placeholder="Nama kamu" required>
      <input type="email" name="email" placeholder="Email" required>
      <textarea name="message" rows="4" placeholder="Pesan kamu..." required></textarea>
      <button type="submit">Kirim</button>
    </form>`
  }
};

const overlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');

function openModal(key){
  const data = modalData[key];
  if(!data) return;
  modalContent.innerHTML = `<h2>${data.title}</h2>${data.body}`;
  overlay.classList.add('open');

  const form = document.getElementById('contactForm');
  if(form){
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('[name="name"]').value;
      const subject = encodeURIComponent('Pesan dari ' + name + ' — English Day');
      const body = encodeURIComponent(form.querySelector('[name="message"]').value + '\n\nEmail: ' + form.querySelector('[name="email"]').value);
      window.location.href = `mailto:hello@englishday.id?subject=${subject}&body=${body}`;
    });
  }
}

function closeModal(){
  overlay.classList.remove('open');
}

document.querySelectorAll('[data-modal]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    openModal(el.getAttribute('data-modal'));
  });
});

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if(e.target === overlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeModal();
});

// Social links placeholder
const socialLinks = {
  instagram: 'https://instagram.com',
  tiktok: 'https://tiktok.com',
  youtube: 'https://youtube.com',
  whatsapp: 'https://wa.me/'
};
document.querySelectorAll('.soc').forEach(a => {
  const key = a.getAttribute('data-social');
  if(socialLinks[key]) a.href = socialLinks[key];
  a.target = '_blank';
  a.rel = 'noopener';
});

// Feed the fish easter egg
const feedBtn = document.getElementById('feedFishBtn');
const bubbles = document.getElementById('bubbles');
const fish = document.getElementById('fish');

feedBtn.addEventListener('click', () => {
  for(let i=0;i<6;i++){
    setTimeout(() => {
      const b = document.createElement('div');
      b.className = 'bubble';
      b.style.left = (10 + Math.random()*70) + '%';
      b.style.animationDuration = (1.2 + Math.random()*0.8) + 's';
      bubbles.appendChild(b);
      setTimeout(() => b.remove(), 2000);
    }, i*120);
  }
  fish.style.animationDuration = '1.4s';
  setTimeout(() => { fish.style.animationDuration = '5s'; }, 2500);
});

// Rotating gallery frame preview
const galleryScenes = [
  `<svg viewBox="0 0 100 70"><rect width="100" height="70" fill="#f0e6d2"/><circle cx="50" cy="24" r="10" fill="#f2b134"/><path d="M0 60 L30 30 L55 50 L75 25 L100 55 L100 70 L0 70 Z" fill="#7fa06b"/></svg>`,
  `<svg viewBox="0 0 100 70"><rect width="100" height="70" fill="#cfe6ef"/><path d="M0 55 Q50 30 100 55 L100 70 L0 70 Z" fill="#3f7d99"/><circle cx="20" cy="15" r="8" fill="#fef3c1"/></svg>`,
  `<svg viewBox="0 0 100 70"><rect width="100" height="70" fill="#f4d9b0"/><rect x="10" y="30" width="80" height="30" fill="#c96b4a"/><rect x="30" y="10" width="14" height="24" fill="#c96b4a"/><rect x="56" y="10" width="14" height="24" fill="#c96b4a"/></svg>`
];
let galleryIdx = 0;
const frameFace = document.getElementById('frameFace');
setInterval(() => {
  galleryIdx = (galleryIdx + 1) % galleryScenes.length;
  frameFace.innerHTML = galleryScenes[galleryIdx];
}, 3200);

// Drag-to-pan corkboard (desktop only; mobile uses the static grid layout)
(function(){
  const viewport = document.getElementById('boardViewport');
  const canvas = document.getElementById('boardCanvas');
  const dragHint = document.getElementById('dragHint');
  if (!viewport || !canvas) return;

  const isDesktop = () => window.matchMedia('(min-width: 901px)').matches;

  let panX = 0, panY = 0;
  let startX = 0, startY = 0;
  let startPanX = 0, startPanY = 0;
  let dragging = false;
  let moved = false;

  function clampPan(){
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    const minX = Math.min(0, vw - cw);
    const minY = Math.min(0, vh - ch);
    panX = Math.max(minX, Math.min(0, panX));
    panY = Math.max(minY, Math.min(0, panY));
  }

  function applyPan(){
    canvas.style.transform = `translate(${panX}px, ${panY}px)`;
  }

  viewport.addEventListener('pointerdown', (e) => {
    if (!isDesktop()) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = panX;
    startPanY = panY;
    viewport.classList.add('dragging');
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      moved = true;
      if (dragHint) dragHint.classList.add('hide');
    }
    panX = startPanX + dx;
    panY = startPanY + dy;
    clampPan();
    applyPan();
  });

  function endDrag(){
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('dragging');
  }
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  // Swallow the click that follows a drag so pins don't pop their modal open
  viewport.addEventListener('click', (e) => {
    if (moved) {
      e.stopPropagation();
      e.preventDefault();
      moved = false;
    }
  }, true);

  window.addEventListener('resize', () => { clampPan(); applyPan(); });
  clampPan();
  applyPan();
})();
