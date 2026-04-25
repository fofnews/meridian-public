import fs   from 'fs';
import path from 'path';

const ARTICLES_DIR = path.join(process.cwd(), 'articles');

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function embedQuery(query) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [query], model: 'voyage-3', input_type: 'query' }),
  });
  if (!res.ok) throw new Error(`Voyage AI ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding;
}

export default async function handler(req, res) {
  const { query, date } = req.query;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date required (YYYY-MM-DD)' });

  let articles;
  try {
    articles = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, `${date}.json`), 'utf8'));
  } catch {
    return res.status(404).json({ error: 'No articles for this date' });
  }

  const embeddingsFile = path.join(ARTICLES_DIR, `${date}.embeddings.json`);
  if (process.env.VOYAGE_API_KEY && fs.existsSync(embeddingsFile)) {
    try {
      const { embeddings } = JSON.parse(fs.readFileSync(embeddingsFile, 'utf8'));
      const queryVec = await embedQuery(query.trim());
      const results = articles
        .map((article, i) => ({ article, score: embeddings[i] ? cosineSimilarity(queryVec, embeddings[i]) : -1 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map(s => s.article);
      return res.json({ results, semantic: true });
    } catch (err) {
      console.error('Semantic search failed, falling back:', err.message);
    }
  }

  const q = query.toLowerCase();
  const results = articles
    .filter(a => (a.title || '').toLowerCase().includes(q) || (a.source || '').toLowerCase().includes(q))
    .slice(0, 30);
  res.json({ results, semantic: false });
}
