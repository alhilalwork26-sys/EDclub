// Papan semangat untuk Ayah: hitungan orang dan klik, level energi, grafik 24 jam, dan komentar
(() => {
  const board = document.getElementById('brBoard');
  if (!board) return;
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const POLL_MS = 15000;
  const LEVELS = [
    [0, 'Pemanasan'], [10, 'Mulai panas'], [25, 'Tanjakan Ngadiwono'], [50, 'Jalur batu Pandansari'],
    [100, 'Hutan Mororejo'], [250, 'Puncak 2.468 m'], [500, 'Finish Wonokitri'], [1000, 'Legenda Bromo'],
  ];

  // Identitas acak per peramban untuk menghitung jumlah orang (bukan data pribadi)
  const vid = (() => {
    try {
      let v = localStorage.getItem('ed_vid');
      if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`); localStorage.setItem('ed_vid', v); }
      return v;
    } catch (e) { return ''; }
  })();

  /* ---------- Angka bergulir (odometer) ---------- */
  const fmt = (n) => Math.max(0, Math.round(n)).toLocaleString('id-ID');
  const setOdo = (el, n) => {
    const s = fmt(n);
    if (el.dataset.len !== String(s.length)) {
      el.dataset.len = s.length;
      el.innerHTML = [...s].map((ch) => (/\d/.test(ch)
        ? `<span class="odo__d"><span class="odo__col">${'0123456789'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>`
        : `<span class="odo__s">${ch}</span>`)).join('');
      el.offsetWidth;                                           // supaya transisi berjalan dari 0
    }
    [...el.querySelectorAll('.odo__col')].forEach((col, i) => {
      const d = s.replace(/\D/g, '')[i];
      col.style.transform = `translateY(${-d * 10}%)`;
    });
    el.setAttribute('aria-label', s);
  };

  const state = { total: 0, people: 0, comments: 0, hours: Array(24).fill(0) };
  const people = $('brPeople'), total = $('brTotal'), comments = $('brComments');
  const meter = $('brMeter'), level = $('brLevel'), next = $('brNext'), spark = $('brSpark');
  [people, total, comments].forEach((el) => setOdo(el, 0));
  spark.innerHTML = Array.from({ length: 24 }, () => '<i><b></b></i>').join('');

  const render = () => {
    setOdo(people, state.people); setOdo(total, state.total); setOdo(comments, state.comments);
    let li = 0;
    LEVELS.forEach(([min], i) => { if (state.total >= min) li = i; });
    const [lo, name] = LEVELS[li], hi = LEVELS[li + 1]?.[0];
    level.textContent = `Level ${li + 1} · ${name}`;
    next.textContent = hi ? `${fmt(hi - state.total)} lagi ke ${LEVELS[li + 1][1]}` : 'Level tertinggi tercapai';
    meter.style.transform = `scaleX(${hi ? (state.total - lo) / (hi - lo) : 1})`;
    const max = Math.max(1, ...state.hours);
    const now = new Date();
    [...spark.children].forEach((bar, i) => {
      const v = state.hours[i] || 0;
      bar.firstChild.style.transform = `scaleY(${Math.max(v / max, 0.03)})`;
      const h = new Date(now.getTime() - (23 - i) * 3600e3).getHours();
      bar.title = `${String(h).padStart(2, '0')}.00 · ${fmt(v)} semangat`;
      bar.classList.toggle('is-now', i === 23);
    });
  };

  /* ---------- API ---------- */
  let online = false;
  // Pindah antara aktif dan belum aktif
  const setOnline = (on) => {
    online = on;
    board.classList.toggle('is-offline', !on);
    $('brNote').hidden = on;
    $('brForm').querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = !on; });
  };
  const api = async (path, opts) => {
    const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (r.status === 503 || r.status === 404) throw Object.assign(new Error('offline'), { offline: true });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'error'), { status: r.status });
    return data;
  };
  const applyStats = (d, fromOthers) => {
    const gained = d.total - state.total;
    Object.assign(state, { total: d.total, people: d.people, comments: d.comments, hours: d.hours || state.hours });
    render();
    if (fromOthers && gained > 0 && !reduce) burst(board.querySelector('.br-big'), Math.min(gained, 8));
  };

  /* ---------- Komentar ---------- */
  const list = $('brList');
  const COLORS = ['#ff7a3d', '#d4ff3f', '#5ad0e6', '#ff4d7d', '#ffb066', '#9be0ae', '#b57bff'];
  const colorOf = (s) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  const ago = (t) => {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'baru saja';
    if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
    return `${Math.floor(s / 86400)} hari lalu`;
  };
  const itemEl = (c, fresh) => {
    const li = document.createElement('li');
    li.className = `br-msg${fresh ? ' is-new' : ''}`;
    const av = document.createElement('span');
    av.className = 'br-msg__av'; av.style.background = colorOf(c.name); av.textContent = (c.name.trim()[0] || '?').toUpperCase();
    const body = document.createElement('div');
    const head = document.createElement('div'); head.className = 'br-msg__head';
    const nm = document.createElement('b'); nm.textContent = c.name;
    const tm = document.createElement('time'); tm.dataset.t = c.t; tm.textContent = ago(c.t);
    head.append(nm, tm);
    const p = document.createElement('p'); p.textContent = c.message;
    body.append(head, p);
    li.append(av, body);
    return li;
  };
  let known = new Set();
  const renderComments = (items) => {
    const firstLoad = known.size === 0;
    const fresh = items.filter((c) => !known.has(`${c.t}|${c.name}`));
    if (!fresh.length && !firstLoad) return;
    list.innerHTML = '';
    items.forEach((c, i) => list.append(Object.assign(itemEl(c, !firstLoad && fresh.includes(c)), { style: `--i:${i}` })));
    known = new Set(items.map((c) => `${c.t}|${c.name}`));
    $('brEmpty').hidden = items.length > 0;
  };
  setInterval(() => list.querySelectorAll('time').forEach((t) => { t.textContent = ago(+t.dataset.t); }), 30000);

  const refresh = async (fromOthers = true) => {
    try {
      const [s, c] = await Promise.all([api('/api/cheer'), api('/api/comments?limit=30')]);
      if (!online) setOnline(true);
      applyStats(s, fromOthers);
      renderComments(c.items || []);
    } catch (e) { if (e.offline || e instanceof TypeError) setOnline(false); }
  };

  /* ---------- Tombol semangat ---------- */
  const plusOne = (el) => {
    if (reduce) return;
    const r = el.getBoundingClientRect();
    const t = document.createElement('span');
    t.className = 'br-plus'; t.textContent = '+1';
    t.style.left = `${r.left + r.width / 2}px`; t.style.top = `${r.top}px`;
    document.body.appendChild(t);
    t.animate([{ transform: 'translate(-50%, 0)', opacity: 1 }, { transform: 'translate(-50%, -60px)', opacity: 0 }], { duration: 900, easing: 'ease-out' }).onfinish = () => t.remove();
  };
  function burst(el, n) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < n * 2; i++) {
      const h = document.createElement('i');
      h.className = 'br-heart';
      h.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C5 15.5 2 12 2 8.5 2 5.5 4.3 3.5 7 3.5c2 0 3.8 1.1 5 2.9 1.2-1.8 3-2.9 5-2.9 2.7 0 5 2 5 5 0 3.5-3 7-10 12.5z"/></svg>';
      h.style.left = `${r.left + r.width * Math.random()}px`; h.style.top = `${r.top + r.height * 0.6}px`;
      document.body.appendChild(h);
      h.animate([{ transform: 'translateY(0) scale(.4)', opacity: 0 }, { transform: 'translateY(-40px) scale(1)', opacity: 1, offset: 0.3 }, { transform: `translate(${(Math.random() - 0.5) * 80}px, -140px) scale(.7)`, opacity: 0 }],
        { duration: 1300, delay: i * 50, easing: 'ease-out', fill: 'backwards' }).onfinish = () => h.remove();
    }
  }
  const cheered = () => { try { return localStorage.getItem('ed_cheered_bromo26') === '1'; } catch (e) { return false; } };
  $('brCheer')?.addEventListener('click', async () => {
    if (!online) return;
    // Tampilkan dulu, lalu cocokkan dengan angka dari server
    state.total += 1; state.hours[23] += 1;
    if (!cheered()) state.people += 1;
    render(); plusOne(total);
    try { localStorage.setItem('ed_cheered_bromo26', '1'); } catch (e) { /* abaikan */ }
    try { applyStats(await api('/api/cheer', { method: 'POST', body: JSON.stringify({ vid }) }), false); }
    catch (e) { if (e.status === 429) say('Pelan-pelan, semangatnya kebanyakan 😄'); }
  });

  /* ---------- Form komentar ---------- */
  const form = $('brForm'), nameIn = form.elements.name, msgIn = form.elements.message, count = $('brCount'), sendBtn = form.querySelector('button');
  try { nameIn.value = localStorage.getItem('ed_name') || ''; } catch (e) { /* abaikan */ }
  msgIn.addEventListener('input', () => { count.textContent = `${msgIn.value.length}/280`; });
  const say = (msg) => { const n = $('brFormMsg'); n.textContent = msg; n.hidden = false; clearTimeout(say.t); say.t = setTimeout(() => { n.hidden = true; }, 3500); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!online) return;
    const message = msgIn.value.trim();
    if (message.length < 2) { say('Tulis pesan dulu ya.'); msgIn.focus(); return; }
    sendBtn.disabled = true;
    try {
      const name = nameIn.value.trim();
      try { localStorage.setItem('ed_name', name); } catch (err) { /* abaikan */ }
      const res = await api('/api/comments', { method: 'POST', body: JSON.stringify({ name, message, vid }) });
      msgIn.value = ''; count.textContent = '0/280';
      state.comments = res.total; render();
      const c = res.item;
      known.add(`${c.t}|${c.name}`);
      list.prepend(itemEl(c, true));
      $('brEmpty').hidden = true;
      say('Terkirim! Terima kasih sudah menyemangati Ayah.');
      if (!reduce) burst(form, 4);
    } catch (err) {
      say(err.status === 429 ? 'Tunggu sebentar sebelum mengirim lagi.' : 'Gagal mengirim, coba lagi.');
    } finally { sendBtn.disabled = false; }
  });

  /* ---------- Mulai saat papan terlihat, perbarui berkala ---------- */
  // Tetap mencoba saat belum aktif, supaya papan menyala sendiri begitu database tersambung
  let timer = 0, visible = false;
  const sync = () => {
    clearInterval(timer); timer = 0;
    if (visible && !document.hidden) timer = setInterval(() => refresh(true), POLL_MS);
  };
  let started = false;
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && !started) { started = true; refresh(false).then(sync); } else sync();
  }, { threshold: 0.1 }).observe(board);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && started) refresh(true); sync(); });
})();
