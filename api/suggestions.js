import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.suggestiondb_KV_REST_API_URL,
  token: process.env.suggestiondb_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const suggestions = (await redis.get('suggestions')) || [];
      return res.json(suggestions.sort((a, b) => b.votes - a.votes));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { text } = req.body ?? {};
      if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
      const suggestions = (await redis.get('suggestions')) || [];
      const suggestion = {
        id: Date.now().toString(),
        text: text.trim(),
        votes: 0,
        createdAt: new Date().toISOString(),
      };
      suggestions.push(suggestion);
      await redis.set('suggestions', suggestions);
      return res.json(suggestion);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
