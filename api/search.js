import fs   from 'fs';
import path from 'path';

const ARTICLES_DIR = path.join(process.cwd(), 'articles');

export default function handler(req, res) {
  const { query, date } = req.query;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });

  let articles;
  try {
    articles = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, `${date}.json`), 'utf8'));
  } catch {
    return res.status(404).json({ error: 'No articles for this date' });
  }

  const q = query.toLowerCase();
  const results = articles
    .filter(a => (a.title || '').toLowerCase().includes(q) || (a.source || '').toLowerCase().includes(q))
    .slice(0, 30);

  res.json({ results, semantic: false });
}
