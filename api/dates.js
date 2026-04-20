import fs from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(process.cwd(), 'reports');
const ARTICLES_DIR = path.join(process.cwd(), 'articles');

export default function handler(req, res) {
  try {
    const dateMap = {};

    const reportFiles = fs.readdirSync(REPORTS_DIR);
    reportFiles.forEach(f => {
      const match = f.match(/^(\d{4}-\d{2}-\d{2})(?:-(morning|evening))?\.json$/);
      if (!match) return;
      const [, date, edition] = match;
      if (!dateMap[date]) dateMap[date] = [];
      const label = edition || 'manual';
      if (!dateMap[date].includes(label)) dateMap[date].push(label);
    });

    try {
      const articleFiles = fs.readdirSync(ARTICLES_DIR);
      articleFiles.forEach(f => {
        const match = f.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
        if (!match) return;
        const [, date] = match;
        if (!dateMap[date]) dateMap[date] = ['articles-only'];
      });
    } catch { /* articles dir missing is non-fatal */ }

    const result = Object.entries(dateMap)
      .map(([date, editions]) => ({ date, editions }))
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json(result);
  } catch {
    res.json([]);
  }
}
