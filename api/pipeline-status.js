import fs from 'fs';
import path from 'path';

const REPORTS_DIR   = path.join(process.cwd(), 'reports');
const ARTICLES_DIR  = path.join(process.cwd(), 'articles');
const TIMELINES_DIR = path.join(process.cwd(), 'timelines');

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const now = new Date();

  // --- Articles: latest date file + last collectedAt ---
  let articles = null;
  try {
    const files = fs.readdirSync(ARTICLES_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    if (files.length > 0) {
      const latestFile = files[files.length - 1];
      const latestDate = latestFile.replace('.json', '');
      const raw = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, latestFile), 'utf8'));
      // Articles are appended in order — last entry has the most recent collectedAt
      const lastArticle = Array.isArray(raw) ? raw[raw.length - 1] : null;
      const lastCollectedAt = lastArticle?.collectedAt ?? null;
      const staleMins = lastCollectedAt
        ? Math.round((now - new Date(lastCollectedAt)) / 60000)
        : null;
      articles = { latestDate, lastCollectedAt, staleMins, count: Array.isArray(raw) ? raw.length : null };
    }
  } catch { /* non-fatal */ }

  // --- Reports: latest file by sorted name + fetchedAt ---
  let reports = null;
  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => /^\d{4}-\d{2}-\d{2}(-\w+)?\.json$/.test(f))
      .sort();
    if (files.length > 0) {
      const latestFile = files[files.length - 1];
      const latest = latestFile.replace('.json', '');
      const raw = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, latestFile), 'utf8'));
      const fetchedAt = raw.fetchedAt ?? null;
      const staleMins = fetchedAt
        ? Math.round((now - new Date(fetchedAt)) / 60000)
        : null;
      reports = { latest, fetchedAt, staleMins };
    }
  } catch { /* non-fatal */ }

  // --- Timelines: updatedAt from timeline.json ---
  let timelines = null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(TIMELINES_DIR, 'timeline.json'), 'utf8'));
    const updatedAt = raw.updatedAt ?? null;
    const staleMins = updatedAt
      ? Math.round((now - new Date(updatedAt)) / 60000)
      : null;
    timelines = { updatedAt, staleMins };
  } catch { /* non-fatal */ }

  // Healthy: articles collected within last 30 min (cron runs every 15 min)
  const healthy = (articles?.staleMins ?? Infinity) <= 30;

  res.json({ checkedAt: now.toISOString(), healthy, articles, reports, timelines });
}
