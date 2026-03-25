import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.suggestiondb_KV_REST_API_URL,
  token: process.env.suggestiondb_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.headers['x-admin-secret'] !== secret) {
    return res.status(403).json({
      error: 'Forbidden',
      debug: {
        envVarSet: !!secret,
        headerReceived: !!req.headers['x-admin-secret'],
        match: req.headers['x-admin-secret'] === secret,
      }
    });
  }

  try {
    const { id } = req.query;
    const suggestions = (await redis.get('suggestions')) || [];
    const filtered = suggestions.filter(s => s.id !== id);
    if (filtered.length === suggestions.length) return res.status(404).json({ error: 'Not found' });
    await redis.set('suggestions', filtered);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
