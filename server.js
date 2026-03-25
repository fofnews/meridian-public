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
app.use(express.json());

const SUGGESTIONS_FILE = path.join(__dirname, 'suggestions.json');

function readSuggestions() {
  if (!fs.existsSync(SUGGESTIONS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SUGGESTIONS_FILE, 'utf8')); } catch { return []; }
}

function writeSuggestions(data) {
  fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(data, null, 2));
}

// Get all suggestions sorted by votes
app.get('/api/suggestions', (_req, res) => {
  const suggestions = readSuggestions();
  res.json(suggestions.sort((a, b) => b.votes - a.votes));
});

// Submit a new suggestion
app.post('/api/suggestions', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required' });
  const suggestions = readSuggestions();
  const suggestion = { id: Date.now().toString(), text: text.trim(), votes: 0, createdAt: new Date().toISOString() };
  suggestions.push(suggestion);
  writeSuggestions(suggestions);
  res.json(suggestion);
});

// Vote on a suggestion
app.post('/api/suggestions/:id/vote', (req, res) => {
  const suggestions = readSuggestions();
  const suggestion = suggestions.find(s => s.id === req.params.id);
  if (!suggestion) return res.status(404).json({ error: 'Not found' });
  suggestion.votes += 1;
  writeSuggestions(suggestions);
  res.json(suggestion);
});

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
app.get('*path', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => console.log(`The Meridian running on port ${PORT}`));
