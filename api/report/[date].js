import fs from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(process.cwd(), 'reports');

export default function handler(req, res) {
  const { date, edition } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  if (edition && edition !== 'manual') {
    const editionFile = path.join(REPORTS_DIR, `${date}-${edition}.json`);
    if (fs.existsSync(editionFile)) {
      return res.json(JSON.parse(fs.readFileSync(editionFile, 'utf8')));
    }
  }

  const baseFile = path.join(REPORTS_DIR, `${date}.json`);
  if (fs.existsSync(baseFile)) {
    return res.json(JSON.parse(fs.readFileSync(baseFile, 'utf8')));
  }

  res.status(404).json({ error: 'Report not found' });
}
