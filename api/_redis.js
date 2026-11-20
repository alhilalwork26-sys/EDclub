// Klien kecil Upstash Redis lewat REST untuk fungsi /api.
// Variabel lingkungan diisi otomatis saat database Upstash for Redis disambungkan ke proyek Vercel.
const crypto = require('crypto');

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
  return { url, token };
};

const configured = () => { const { url, token } = env(); return Boolean(url && token); };

// Menjalankan beberapa perintah Redis dalam satu permintaan
async function pipeline(cmds) {
  const { url, token } = env();
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
const notConfigured = (res) => res.status(503).json({ error: 'not-configured', hint: 'Sambungkan database Upstash for Redis ke proyek ini (Production), lalu deploy ulang.' });

module.exports = { NS, configured, pipeline, limited, readBody, notConfigured };
