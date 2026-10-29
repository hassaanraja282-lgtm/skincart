require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const yc = require('./src/youcam');
const { buildReport, effectsFor, findProduct } = require('./src/recommend');
const demo = require('./src/demoFixture.json');

const app = express();
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// LIVE when a key is configured (or YOUCAM_LIVE=1 behind a key-injecting proxy).
const LIVE = Boolean(process.env.YOUCAM_API_KEY) || process.env.YOUCAM_LIVE === '1';

// Small in-memory cache so the same selfie never burns units twice.
const cache = new Map();
const sessions = new Map(); // sessionId -> { fileId, url }
const remember = (k, v) => { cache.set(k, v); if (cache.size > 200) cache.delete(cache.keys().next().value); return v; };

app.get('/healthz', (_req, res) => res.json({ ok: true, live: LIVE }));
app.get('/api/status', async (_req, res) => {
  let units = null;
  if (LIVE) { try { units = await yc.credits(); } catch { /* ignore */ } }
  res.json({ live: LIVE, units });
});

function decodeDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|jpg|png));base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw Object.assign(new Error('Please send a JPG or PNG image.'), { status: 400 });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 9.5 * 1024 * 1024) throw Object.assign(new Error('Image must be under 10 MB.'), { status: 400 });
  return { buf, type: m[1] === 'image/jpg' ? 'image/jpeg' : m[1] };
}

// POST /api/analyze  { image: dataURL } | { sample: true }
app.post('/api/analyze', async (req, res) => {
  try {
    if (req.body.sample || !LIVE) {
      const report = buildReport(demo.skin, demo.tone);
      sessions.set('demo', { demo: true });
      return res.json({ sessionId: 'demo', demo: true, photo: '/demo/selfie.jpg', report });
    }
    const { buf, type } = decodeDataUrl(req.body.image);
    const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 24);
    if (cache.has(`a:${hash}`)) return res.json(cache.get(`a:${hash}`));

    const fileId = await yc.uploadImage(buf, type, `selfie.${type === 'image/png' ? 'png' : 'jpg'}`);
    const ref = { fileId };
    const [skin, tone] = await Promise.all([yc.skinAnalysis(ref), yc.skinTone(ref)]);
    const report = buildReport(skin, tone);
    sessions.set(hash, ref);
    res.json(remember(`a:${hash}`, { sessionId: hash, demo: false, report }));
  } catch (e) {
    console.error('[analyze]', e.message);
    res.status(e.status && e.status < 500 ? e.status : 502).json({ error: e.message });
  }
});

// POST /api/tryon { sessionId, productId }
app.post('/api/tryon', async (req, res) => {
  try {
    const { sessionId, productId } = req.body;
    const product = findProduct(productId);
    if (!product) return res.status(400).json({ error: 'Unknown product' });
    const effects = effectsFor(product);
    if (!effects) return res.status(400).json({ error: 'This product has no virtual try-on' });
    const key = `t:${sessionId}:${productId}`;
    if (cache.has(key)) return res.json(cache.get(key));

    const ref = sessions.get(sessionId);
    if (!ref || ref.demo || !LIVE) {
      // Demo mode: one pre-rendered YouCam lip try-on result.
      return res.json({ url: '/demo/tryon_lip.jpg', demo: true, note: 'Demo image (live try-on renders your exact shade).' });
    }
    const url = await yc.makeupTryOn(ref, effects);
    res.json(remember(key, { url, demo: false }));
  } catch (e) {
    console.error('[tryon]', e.message);
    res.status(502).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`SkinCart on http://localhost:${PORT} (${LIVE ? 'LIVE YouCam API' : 'demo mode'})`));
}
module.exports = app;
