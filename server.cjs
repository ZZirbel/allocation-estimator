const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 4000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'appdata.json');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── Data Persistence ────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return { estimates: [], roleLibrary: null, rateCards: [], roleTemplates: null };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return { estimates: [], roleLibrary: null, rateCards: [], roleTemplates: null };
  }
}

function writeData(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET /api/data — return all persisted data
app.get('/api/data', (_req, res) => {
  res.json(readData());
});

// POST /api/data — overwrite all persisted data
app.post('/api/data', (req, res) => {
  writeData(req.body);
  res.json({ ok: true });
});

// ── Static Files ────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback — all routes serve index.html
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Allocation Estimator running at http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
