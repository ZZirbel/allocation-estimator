const express = require('express');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 4000;
const CONFIG_DIR = process.env.CONFIG_DIR || path.join(__dirname, 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── Default data path ───────────────────────────────────────────
// Local-only fallback. Users configure shared paths via Settings UI.

function getDefaultDataDir() {
  return path.join(CONFIG_DIR, 'local');
}

// ── Config Management ───────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadConfig() {
  ensureDir(CONFIG_DIR);
  if (!fs.existsSync(CONFIG_FILE)) {
    const defaults = { dataDir: getDefaultDataDir() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return { dataDir: getDefaultDataDir() };
  }
}

function saveConfig(config) {
  ensureDir(CONFIG_DIR);
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getDataDir() {
  return loadConfig().dataDir;
}

// ── Per-Estimate File Storage ───────────────────────────────────
// estimates/          one JSON file per estimate
// role-library.json   shared role library
// rate-cards.json     shared rate cards
// role-templates.json shared role templates

function estimatesDir() {
  const dir = path.join(getDataDir(), 'estimates');
  ensureDir(dir);
  return dir;
}

function sharedFile(name) {
  const dir = getDataDir();
  ensureDir(dir);
  return path.join(dir, name);
}

function readJsonFile(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJsonFile(filepath, data) {
  ensureDir(path.dirname(filepath));
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ── Migration: single appdata.json → per-file ──────────────────
// If an old appdata.json exists, split it into the new structure.

function migrateOldData() {
  const oldFile = path.join(CONFIG_DIR, 'appdata.json');
  if (!fs.existsSync(oldFile)) return;

  try {
    const old = JSON.parse(fs.readFileSync(oldFile, 'utf-8'));
    const dataDir = getDataDir();
    ensureDir(dataDir);

    // Migrate estimates
    if (old.estimates && old.estimates.length > 0) {
      const estDir = path.join(dataDir, 'estimates');
      ensureDir(estDir);
      for (const est of old.estimates) {
        if (est.id) {
          writeJsonFile(path.join(estDir, `${est.id}.json`), est);
        }
      }
    }

    // Migrate shared data
    if (old.roleLibrary) writeJsonFile(path.join(dataDir, 'role-library.json'), old.roleLibrary);
    if (old.rateCards) writeJsonFile(path.join(dataDir, 'rate-cards.json'), old.rateCards);
    if (old.roleTemplates) writeJsonFile(path.join(dataDir, 'role-templates.json'), old.roleTemplates);

    // Rename old file so migration doesn't re-run
    fs.renameSync(oldFile, oldFile + '.migrated');
    console.log('[migrate] Migrated appdata.json to per-file storage');
  } catch (err) {
    console.error('[migrate] Migration failed:', err.message);
  }
}

// ── API: Settings ───────────────────────────────────────────────

app.get('/api/settings', (_req, res) => {
  const config = loadConfig();
  res.json({
    dataDir: config.dataDir,
    defaultDataDir: getDefaultDataDir(),
    configDir: CONFIG_DIR,
    dataDirExists: fs.existsSync(config.dataDir),
    needsSetup: !config.configured,
  });
});

app.post('/api/settings', (req, res) => {
  const { dataDir, initializeData } = req.body;
  if (!dataDir) return res.status(400).json({ error: 'dataDir is required' });

  // Create the directory if it doesn't exist
  try {
    ensureDir(dataDir);
    ensureDir(path.join(dataDir, 'estimates'));
  } catch (err) {
    return res.status(400).json({ error: `Cannot create directory: ${err.message}` });
  }

  // If requested, seed the data directory with example/starter files
  const warnings = [];
  if (initializeData) {
    const TEMPLATE_DIR = path.join(__dirname, 'data-templates');
    const filesToCopy = [
      { src: 'role-library.example.json', dest: 'role-library.json' },
      { src: 'rate-cards.example.json', dest: 'rate-cards.json' },
      { src: 'role-templates.example.json', dest: 'role-templates.json' },
    ];
    for (const { src, dest } of filesToCopy) {
      const destPath = path.join(dataDir, dest);
      const srcPath = path.join(TEMPLATE_DIR, src);
      if (fs.existsSync(destPath)) {
        warnings.push(`${dest} already exists — skipped to avoid overwriting.`);
      } else if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  const config = loadConfig();
  config.dataDir = dataDir;
  config.configured = true;
  saveConfig(config);

  res.json({ ok: true, dataDir, warnings: warnings.length > 0 ? warnings : undefined });
});

// ── API: Estimates (per-file) ───────────────────────────────────

app.get('/api/estimates', (_req, res) => {
  const dir = estimatesDir();
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const estimates = files
      .map((f) => readJsonFile(path.join(dir, f)))
      .filter(Boolean);
    res.json(estimates);
  } catch {
    res.json([]);
  }
});

app.get('/api/estimates/:id', (req, res) => {
  const file = path.join(estimatesDir(), `${req.params.id}.json`);
  const data = readJsonFile(file);
  if (data) res.json(data);
  else res.status(404).json({ error: 'Not found' });
});

app.put('/api/estimates/:id', (req, res) => {
  const file = path.join(estimatesDir(), `${req.params.id}.json`);
  writeJsonFile(file, req.body);
  res.json({ ok: true });
});

app.delete('/api/estimates/:id', (req, res) => {
  const file = path.join(estimatesDir(), `${req.params.id}.json`);
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: Shared data (role library, rate cards, templates) ──────

app.get('/api/role-library', (_req, res) => {
  res.json(readJsonFile(sharedFile('role-library.json')) || []);
});

app.post('/api/role-library', (req, res) => {
  writeJsonFile(sharedFile('role-library.json'), req.body);
  res.json({ ok: true });
});

app.get('/api/rate-cards', (_req, res) => {
  res.json(readJsonFile(sharedFile('rate-cards.json')) || []);
});

app.post('/api/rate-cards', (req, res) => {
  writeJsonFile(sharedFile('rate-cards.json'), req.body);
  res.json({ ok: true });
});

app.get('/api/role-templates', (_req, res) => {
  res.json(readJsonFile(sharedFile('role-templates.json')) || []);
});

app.post('/api/role-templates', (req, res) => {
  writeJsonFile(sharedFile('role-templates.json'), req.body);
  res.json({ ok: true });
});

// ── Legacy API (backward compat for hydration) ──────────────────

app.get('/api/data', (_req, res) => {
  const dir = estimatesDir();
  let estimates = [];
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    estimates = files.map((f) => readJsonFile(path.join(dir, f))).filter(Boolean);
  } catch { /* empty */ }

  res.json({
    estimates,
    roleLibrary: readJsonFile(sharedFile('role-library.json')),
    rateCards: readJsonFile(sharedFile('rate-cards.json')) || [],
    roleTemplates: readJsonFile(sharedFile('role-templates.json')),
  });
});

app.post('/api/data', (req, res) => {
  const { estimates, roleLibrary, rateCards, roleTemplates } = req.body;
  const dir = estimatesDir();

  if (estimates) {
    for (const est of estimates) {
      if (est.id) writeJsonFile(path.join(dir, `${est.id}.json`), est);
    }
  }
  if (roleLibrary) writeJsonFile(sharedFile('role-library.json'), roleLibrary);
  if (rateCards) writeJsonFile(sharedFile('rate-cards.json'), rateCards);
  if (roleTemplates) writeJsonFile(sharedFile('role-templates.json'), roleTemplates);

  res.json({ ok: true });
});

// ── Static Files ────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────────

migrateOldData();

app.listen(PORT, () => {
  const config = loadConfig();
  console.log(`Allocation Estimator running at http://localhost:${PORT}`);
  console.log(`Config directory: ${CONFIG_DIR}`);
  console.log(`Data directory:   ${config.dataDir}`);
});
