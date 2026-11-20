// GET: statistik semangat untuk Ayah. POST: tambah satu semangat.
const { NS, configured, pipeline, limited, readBody } = require('./_redis');

const hourKey = (d) => `${NS}:cheer:h:${d.toISOString().slice(0, 13).replace(/[-T]/g, '')}`;
const last24 = () => {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => hourKey(new Date(now - (23 - i) * 3600e3)));
};

async function stats() {
  const [total, people, comments, hours] = await pipeline([
    ['GET', `${NS}:cheer:total`],
    ['SCARD', `${NS}:cheer:people`],
    ['GET', `${NS}:comments:total`],
    ['MGET', ...last24()],
  ]);
  return { total: +total || 0, people: +people || 0, comments: +comments || 0, hours: (hours || []).map((v) => +v || 0) };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).json({ error: 'not-configured' });
  try {
    if (req.method === 'GET') return res.status(200).json(await stats());
    if (req.method === 'POST') {
      if (await limited(req, 'cheer', 40)) return res.status(429).json({ error: 'rate-limited' });
      const vid = String(readBody(req).vid || '');
      const hk = hourKey(new Date());
      const cmds = [['INCR', `${NS}:cheer:total`], ['INCR', hk], ['EXPIRE', hk, String(3 * 86400)]];
      if (/^[a-z0-9-]{8,64}$/i.test(vid)) cmds.push(['SADD', `${NS}:cheer:people`, vid]);
      await pipeline(cmds);
      return res.status(200).json(await stats());
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method-not-allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server-error' });
  }
};
