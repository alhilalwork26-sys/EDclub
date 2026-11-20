// Klien kecil Upstash Redis lewat REST untuk fungsi /api.
// Variabel lingkungan diisi otomatis saat database Upstash for Redis disambungkan ke proyek Vercel.
const crypto = require('crypto');

const NS = 'ed:bromo26';

const env = () => ({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

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

module.exports = { NS, configured, pipeline, limited, readBody };
