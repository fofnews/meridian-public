import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const suggestions = (await kv.get('suggestions')) || [];
    return res.json(suggestions.sort((a, b) => b.votes - a.votes));
  }

  if (req.method === 'POST') {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
    const suggestions = (await kv.get('suggestions')) || [];
    const suggestion = {
      id: Date.now().toString(),
      text: text.trim(),
      votes: 0,
      createdAt: new Date().toISOString(),
    };
    suggestions.push(suggestion);
    await kv.set('suggestions', suggestions);
    return res.json(suggestion);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
