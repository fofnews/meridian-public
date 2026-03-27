import fs from 'fs';
import path from 'path';

const ARTICLES_DIR = path.join(process.cwd(), 'articles');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

function loadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function latestReport(date) {
  return loadJson(path.join(REPORTS_DIR, `${date}-evening.json`))
    || loadJson(path.join(REPORTS_DIR, `${date}-morning.json`))
    || loadJson(path.join(REPORTS_DIR, `${date}.json`));
}

export default function handler(req, res) {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  const articles = loadJson(path.join(ARTICLES_DIR, `${date}.json`));
  if (!articles) return res.status(404).json({ error: 'No articles for this date' });

  // Build a URL lookup from the latest report's story clusters
  const report = latestReport(date);
  const storyByUrl = {};
  if (report?.stories) {
    for (const story of report.stories) {
      for (const article of story.articles || []) {
        if (article.link) storyByUrl[article.link] = { headline: story.headline, id: story.id };
      }
    }
  }

  // Group articles by matched story, then unclassified
  const storyMap = {};
  const unclassified = [];

  for (const article of articles) {
    const match = storyByUrl[article.link];
    if (match) {
      if (!storyMap[match.headline]) storyMap[match.headline] = { headline: match.headline, articles: [] };
      storyMap[match.headline].articles.push(article);
    } else {
      unclassified.push(article);
    }
  }

  // Sort stories by article count descending
  const stories = Object.values(storyMap).sort((a, b) => b.articles.length - a.articles.length);

  // Sort unclassified by pubDate descending
  unclassified.sort((a, b) => new Date(b.pubDate || b.collectedAt) - new Date(a.pubDate || a.collectedAt));

  res.json({ date, stories, unclassified, total: articles.length });
}
