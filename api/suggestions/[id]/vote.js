import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.suggestiondb_KV_REST_API_URL,
  token: process.env.suggestiondb_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const suggestions = (await redis.get('suggestions')) || [];
  const suggestion = suggestions.find(s => s.id === id);
  if (!suggestion) return res.status(404).json({ error: 'Not found' });

  suggestion.votes += 1;
  await redis.set('suggestions', suggestions);
  return res.json(suggestion);
}
