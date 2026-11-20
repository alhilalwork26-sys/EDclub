// GET: komentar terbaru untuk Ayah. POST: kirim komentar baru.
const { NS, configured, pipeline, limited, readBody } = require('./_redis');

const KEEP = 200;   // komentar yang disimpan
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const parse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).json({ error: 'not-configured' });
  try {
    if (req.method === 'GET') {
      const limit = Math.min(50, Math.max(1, parseInt((req.query && req.query.limit) || '30', 10) || 30));
      const [items, total] = await pipeline([['LRANGE', `${NS}:comments`, '0', String(limit - 1)], ['GET', `${NS}:comments:total`]]);
      return res.status(200).json({ total: +total || 0, items: (items || []).map(parse).filter(Boolean) });
    }
    if (req.method === 'POST') {
      if (await limited(req, 'comment', 4)) return res.status(429).json({ error: 'rate-limited' });
      const body = readBody(req);
      const name = clean(body.name, 40) || 'Teman ED';
      const message = clean(body.message, 280);
      if (message.length < 2) return res.status(400).json({ error: 'message-too-short' });
      const item = { name, message, t: Date.now() };
      const [, , total] = await pipeline([
        ['LPUSH', `${NS}:comments`, JSON.stringify(item)],
        ['LTRIM', `${NS}:comments`, '0', String(KEEP - 1)],
        ['INCR', `${NS}:comments:total`],
      ]);
      return res.status(201).json({ item, total: +total || 0 });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method-not-allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server-error' });
  }
};
