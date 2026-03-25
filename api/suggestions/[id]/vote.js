import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  const suggestions = (await kv.get('suggestions')) || [];
  const suggestion = suggestions.find(s => s.id === id);
  if (!suggestion) return res.status(404).json({ error: 'Not found' });

  suggestion.votes += 1;
  await kv.set('suggestions', suggestions);
  return res.json(suggestion);
}
