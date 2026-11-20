// Link spesial untuk menyemangati Ayah: edsocialclub.vercel.app/ayah?dari=Nama
(() => {
  const modal = document.getElementById('brShare');
  if (!modal) return;
  const $ = (id) => document.getElementById(id);
  const BASE = 'https://edsocialclub.vercel.app/ayah';
  const TEXT = 'Ayo semangati Ayah (Alfan) yang lari Half Marathon 21K di Bromo Marathon 2026, Sabtu 21 November! 🔥 Klik semangat dan tulis pesanmu di sini:';
  const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);

  /* ---------- Sambutan untuk yang datang lewat link ajakan ---------- */
  const from = clean(new URLSearchParams(location.search).get('dari'));
  if (from) {
    $('brInviteName').textContent = from;
    $('brInvite').hidden = false;
  }

  /* ---------- Jendela bagikan ---------- */
  const nameIn = $('brShareName'), urlOut = $('brShareUrl'), wa = $('brShareWa'), toast = $('brToast');
  const link = () => {
    const name = clean(nameIn.value);
    return name ? `${BASE}?${new URLSearchParams({ dari: name })}` : BASE;
  };
  const update = () => {
    const url = link();
    urlOut.value = url.replace(/^https:\/\//, '');
    wa.href = `https://wa.me/?text=${encodeURIComponent(`${TEXT}\n${url}`)}`;
  };
  const remember = () => { try { localStorage.setItem('ed_name', clean(nameIn.value)); } catch (e) { /* abaikan */ } };

  let toastTimer = 0;
  const say = (msg) => {
    toast.textContent = msg; toast.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  };
  const copy = async () => {
    const url = link();
    remember();
    try { await navigator.clipboard.writeText(url); say('Link spesial disalin'); return; } catch (e) { /* coba cara lama */ }
    urlOut.value = url; urlOut.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* abaikan */ }
    say(ok ? 'Link spesial disalin' : 'Tidak bisa menyalin, salin manual dari kolom link');
    if (ok) update();
  };

  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement;
    try { if (!nameIn.value) nameIn.value = clean(localStorage.getItem('ed_name')); } catch (e) { /* abaikan */ }
    update();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    nameIn.focus();
  };
  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    lastFocus?.focus?.();
  };

  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', open));
  modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  nameIn.addEventListener('input', update);
  $('brShareCopy').addEventListener('click', copy);
  wa.addEventListener('click', remember);

  // Bagikan langsung ke aplikasi lain (HP)
  if (navigator.share) {
    const btn = $('brShareNative');
    btn.hidden = false;
    btn.addEventListener('click', async () => {
      remember();
      try { await navigator.share({ title: 'Semangati Ayah di Bromo Marathon 2026!', text: TEXT, url: link() }); }
      catch (e) { if (e.name !== 'AbortError') copy(); }
    });
  }
})();
