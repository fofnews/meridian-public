import fs from 'fs';
import path from 'path';

const TIMELINES_DIR = path.join(process.cwd(), 'timelines');

export default function handler(req, res) {
  try {
    const file = path.join(TIMELINES_DIR, 'timeline.json');
    if (!fs.existsSync(file)) return res.json({ timelines: [], updatedAt: null });
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    res.json(data);
  } catch {
    res.json({ timelines: [], updatedAt: null });
  }
}
