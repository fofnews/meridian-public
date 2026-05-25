import fs from 'fs';
import path from 'path';

const TOPICS_DIR = path.join(process.cwd(), 'topics');

export default function handler(req, res) {
  const { date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date' });
  }

  const topicsFile = path.join(TOPICS_DIR, `${date}.json`);
  if (!fs.existsSync(topicsFile)) {
    return res.json([]);
  }

  try {
    const data = JSON.parse(fs.readFileSync(topicsFile, 'utf8'));
    return res.json(data);
  } catch {
    return res.json([]);
  }
}
