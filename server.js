import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// On VPS: set REPORTS_DIR env var to wherever your reports folder lives.
// Locally: defaults to the reports/ directory inside this project.
const REPORTS_DIR = process.env.REPORTS_DIR || path.join(__dirname, 'reports');
const PORT = process.env.PORT || 3002;

const app = express();

// Serve the built React app
app.use(express.static(path.join(__dirname, 'dist')));

// List available dates
app.get('/api/dates', (_req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR);
    const dateMap = {};
    files.forEach(f => {
      const match = f.match(/^(\d{4}-\d{2}-\d{2})(?:-(morning|evening))?\.json$/);
      if (!match) return;
      const [, date, edition] = match;
      if (!dateMap[date]) dateMap[date] = [];
      const label = edition || 'manual';
      if (!dateMap[date].includes(label)) dateMap[date].push(label);
    });
    const result = Object.entries(dateMap)
      .map(([date, editions]) => ({ date, editions }))
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json(result);
  } catch {
    res.json([]);
  }
});

// Serve a specific report
app.get('/api/report/:date', (req, res) => {
  const { date } = req.params;
  const { edition } = req.query;

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
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`The Meridian running on port ${PORT}`));
