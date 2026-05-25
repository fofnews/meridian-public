import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.join(process.cwd(), 'articles');

function getLast7Dates() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function loadArticlesForDates(dates) {
  const all = [];
  for (const date of dates) {
    try {
      const articles = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, `${date}.json`), 'utf8'));
      for (const a of articles) all.push({ ...a, date });
    } catch { /* date not available */ }
  }
  return all;
}

async function embedQuery(query) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [query], model: 'voyage-3-lite', input_type: 'query' }),
  });
  if (!res.ok) throw new Error(`Voyage AI ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding;
}

async function queryPinecone(queryVector, dates) {
  const host = process.env.PINECONE_HOST;
  const key = process.env.PINECONE_API_KEY;
  if (!host || !key) return null;

  const res = await fetch(`${host}/query`, {
    method: 'POST',
    headers: { 'Api-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vector: queryVector,
      topK: 30,
      includeMetadata: true,
      filter: { date: { $in: dates } },
    }),
  });
  if (!res.ok) throw new Error(`Pinecone ${res.status}`);
  const json = await res.json();
  return json.matches ?? [];
}

export default async function handler(req, res) {
  const { query } = req.query;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  const dates = getLast7Dates();

  if (process.env.VOYAGE_API_KEY && process.env.PINECONE_API_KEY && process.env.PINECONE_HOST) {
    try {
      const queryVec = await embedQuery(query.trim());
      const matches = await queryPinecone(queryVec, dates);
      const results = matches.map(m => ({
        title: m.metadata.title,
        link: m.metadata.link,
        source: m.metadata.source,
        pubDate: m.metadata.pubDate,
        date: m.metadata.date,
        score: m.score,
      }));
      return res.json({ results, semantic: true });
    } catch (err) {
      console.error('Semantic search failed, falling back:', err.message);
    }
  }

  const q = query.toLowerCase();
  const results = loadArticlesForDates(dates)
    .filter(a => (a.title || '').toLowerCase().includes(q) || (a.source || '').toLowerCase().includes(q))
    .slice(0, 30);
  res.json({ results, semantic: false });
}
