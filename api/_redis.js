// Klien kecil Redis untuk fungsi /api, tanpa dependensi.
// Memakai REST Upstash jika tersedia, atau koneksi Redis biasa (REDIS_URL / KV_URL) sebagai cadangan.
// Variabel lingkungan diisi otomatis saat database disambungkan ke proyek Vercel.
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');

const NS = 'ed:bromo26';

const env = () => {
  const e = process.env;
  let url = e.KV_REST_API_URL || e.UPSTASH_REDIS_REST_URL;
  let token = e.KV_REST_API_TOKEN || e.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Integrasi Vercel bisa memakai awalan nama sendiri, mis. STORAGE_KV_REST_API_URL
    const k = Object.keys(e).find((n) => /(REST_API|REDIS_REST)_URL$/.test(n) && e[n.replace(/URL$/, 'TOKEN')]);
    if (k) { url = e[k]; token = e[k.replace(/URL$/, 'TOKEN')]; }
  }
  let tcp = '';
  if (!url || !token) {
    const k = ['REDIS_URL', 'KV_URL', ...Object.keys(e)].find((n) => /(REDIS|KV)_URL$/.test(n) && /^rediss?:\/\//.test(e[n] || ''));
    if (k) tcp = e[k];
  }
  return { url, token, tcp };
};

const configured = () => { const { url, token, tcp } = env(); return Boolean((url && token) || tcp); };

/* ---------- Protokol Redis (RESP) lewat TCP/TLS ---------- */
const encode = (cmd) => `*${cmd.length}\r\n${cmd.map((a) => { const s = String(a); return `$${Buffer.byteLength(s)}\r\n${s}\r\n`; }).join('')}`;

// Mengurai satu balasan mulai dari posisi i; null jika data belum lengkap
function parseReply(b, i) {
  const nl = b.indexOf('\r\n', i);
  if (nl < 0) return null;
  const type = String.fromCharCode(b[i]), line = b.toString('utf8', i + 1, nl), next = nl + 2;
  if (type === '+') return { v: line, end: next };
  if (type === '-') return { v: new Error(line), end: next };
  if (type === ':') return { v: Number(line), end: next };
  if (type === '$') {
    const n = Number(line);
    if (n < 0) return { v: null, end: next };
    if (b.length < next + n + 2) return null;
    return { v: b.toString('utf8', next, next + n), end: next + n + 2 };
  }
  if (type === '*') {
    const n = Number(line);
    if (n < 0) return { v: null, end: next };
    const arr = [];
    let p = next;
    for (let k = 0; k < n; k++) { const r = parseReply(b, p); if (!r) return null; arr.push(r.v); p = r.end; }
    return { v: arr, end: p };
  }
  throw new Error(`redis reply ${type}`);
}

function tcpPipeline(urlStr, cmds) {
  const u = new URL(urlStr);
  const all = [];
  if (u.password) all.push(u.username ? ['AUTH', decodeURIComponent(u.username), decodeURIComponent(u.password)] : ['AUTH', decodeURIComponent(u.password)]);
  all.push(...cmds);
  return new Promise((resolve, reject) => {
    const opts = { host: u.hostname, port: Number(u.port) || 6379 };
    const sock = u.protocol === 'rediss:' ? tls.connect({ ...opts, servername: u.hostname }) : net.connect(opts);
    let buf = Buffer.alloc(0);
    const replies = [];
    const fail = (err) => { sock.destroy(); reject(err); };
    sock.setTimeout(8000, () => fail(new Error('redis timeout')));
    sock.on('error', fail);
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      try {
        let r;
        while (replies.length < all.length && (r = parseReply(buf, 0))) { replies.push(r.v); buf = buf.subarray(r.end); }
      } catch (err) { fail(err); return; }
      if (replies.length < all.length) return;
      sock.end();
      const err = replies.find((x) => x instanceof Error);
      if (err) reject(err); else resolve(replies.slice(all.length - cmds.length));
    });
    sock.write(all.map(encode).join(''));
  });
}

// Menjalankan beberapa perintah Redis dalam satu permintaan
async function pipeline(cmds) {
  const { url, token, tcp } = env();
  if (!(url && token)) return tcpPipeline(tcp, cmds);
  const r = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}

// Kunci pengunjung dari IP yang di-hash, supaya IP asli tidak disimpan
const clientKey = (req) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'anon';
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
};

// true jika pengunjung melewati batas permintaan per menit
async function limited(req, name, max) {
  const k = `ed:rl:${name}:${clientKey(req)}:${Math.floor(Date.now() / 60000)}`;
  const [n] = await pipeline([['INCR', k], ['EXPIRE', k, '70']]);
  return n > max;
}

const readBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return req.body;
};

// Jawaban saat database belum tersambung
const notConfigured = (res) => res.status(503).json({
  error: 'not-configured',
  hint: 'Sambungkan database Upstash for Redis ke proyek ini (Production), lalu deploy ulang.',
});

module.exports = { NS, configured, pipeline, limited, readBody, notConfigured };
