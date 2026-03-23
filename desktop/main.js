const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

const PORT = 4000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
let mainWindow = null;
let splashWindow = null;
let tray = null;
let serverProcess = null;
let trayNotified = false;

// User data lives in %APPDATA%/allocation-estimator-desktop/data/
// This survives app rebuilds, git pulls, and reinstalls.
function getUserDataDir() {
  return path.join(app.getPath('userData'), 'data');
}

// ── Update Check Config ─────────────────────────────────────────

function getUpdateConfigPath() {
  return path.join(getUserDataDir(), 'update-check.json');
}

function loadUpdateConfig() {
  try {
    const configPath = getUpdateConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('[update] Failed to load update config:', e.message);
  }
  return { lastCheck: 0 };
}

function saveUpdateConfig(config) {
  try {
    const configPath = getUpdateConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('[update] Failed to save update config:', e.message);
  }
}

function shouldCheckForUpdates() {
  const config = loadUpdateConfig();
  const now = Date.now();
  return (now - config.lastCheck) > ONE_DAY_MS;
}

// ── Update Check Functions ──────────────────────────────────────

function checkForUpdatesAvailable() {
  const repoRoot = getRepoRoot();

  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    return { available: false, error: 'Not a git repository' };
  }

  try {
    // Fetch latest from origin
    execSync('git fetch origin main', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 15000,
      stdio: 'pipe',
    });

    // Check how many commits behind
    const behind = execSync('git rev-list HEAD..origin/main --count', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    const commitsBehind = parseInt(behind, 10) || 0;

    // Update last check time
    saveUpdateConfig({ lastCheck: Date.now() });

    return { available: commitsBehind > 0, commitsBehind };
  } catch (e) {
    console.error('[update] Check failed:', e.message);
    return { available: false, error: e.message };
  }
}

// ── IPC Handlers ────────────────────────────────────────────────

ipcMain.handle('check-for-updates', async () => {
  return checkForUpdatesAvailable();
});

ipcMain.handle('perform-update', async () => {
  try {
    await pullUpdates();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Paths — works both in dev and packaged
function getServerDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server');
  }
  return path.join(__dirname, '..');
}

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return path.join(__dirname, iconName);
}

// ── Server Management ──────────────────────────────────────────

function startServer() {
  const serverDir = getServerDir();
  const serverScript = path.join(serverDir, 'server.cjs');

  serverProcess = spawn('node', [serverScript], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(PORT), CONFIG_DIR: getUserDataDir() },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
    serverProcess = null;
  });
}

function stopServer() {
  if (serverProcess) {
    if (process.platform === 'win32') {
      try {
        execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
      } catch { /* process may already be gone */ }
    } else {
      serverProcess.kill();
    }
    serverProcess = null;
  }
}

function waitForServer(timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${PORT}/api/data`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(1000);
    };
    const retry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error('Server start timeout'));
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  });
}

// ── Pull Updates ──────────────────────────────────────────────

function getRepoRoot() {
  if (app.isPackaged) {
    return path.resolve(path.dirname(process.execPath), '..', '..', '..');
  }
  return path.join(__dirname, '..');
}

function syncFilesToResources() {
  if (!app.isPackaged) return;

  const repo = getRepoRoot();
  const dest = path.join(process.resourcesPath, 'server');

  // Sync server.js
  const src = path.join(repo, 'server.cjs');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(dest, 'server.cjs'));
  }

  // Rebuild and sync dist/
  try {
    execSync('npm run build', { cwd: repo, timeout: 60000 });
    const distDest = path.join(dest, 'dist');
    if (fs.existsSync(distDest)) {
      fs.rmSync(distDest, { recursive: true, force: true });
    }
    fs.cpSync(path.join(repo, 'dist'), distDest, { recursive: true });
  } catch (err) {
    console.error('[update] Build failed:', err.message);
  }
}

async function pullUpdates() {
  const repoRoot = getRepoRoot();

  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    dialog.showErrorBox('Update Failed', `Not a git repository:\n${repoRoot}`);
    return;
  }

  try {
    const output = execSync('git pull --ff-only origin main', {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 30000,
    });

    const hadNewCommits = !output.includes('Already up to date');

    syncFilesToResources();

    stopServer();
    startServer();
    await waitForServer();

    if (mainWindow) {
      mainWindow.reload();
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: hadNewCommits ? 'Updated Successfully' : 'Re-synced',
      message: hadNewCommits
        ? 'Allocation Estimator has been updated and reloaded.'
        : 'No new commits, but files have been re-synced and reloaded.',
      detail: output.trim(),
    });
  } catch (err) {
    dialog.showErrorBox('Update Failed', err.message || String(err));
  }
}

// ── Application Menu ──────────────────────────────────────────

function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Pull Updates',
          accelerator: 'CmdOrCtrl+U',
          click: () => pullUpdates(),
        },
        {
          label: 'Open in Browser',
          click: () => shell.openExternal(`http://localhost:${PORT}`),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Windows ────────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 340,
    height: 220,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Allocation Estimator',
    icon: getIconPath(),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();

      if (!trayNotified && tray) {
        trayNotified = true;
        tray.displayBalloon({
          title: 'Allocation Estimator',
          content: 'Still running in the system tray. Right-click the tray icon or use File > Quit to exit.',
          iconType: 'info',
        });
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── Tray ───────────────────────────────────────────────────────

function createTray() {
  const iconPath = getIconPath();
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('Allocation Estimator');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Allocation Estimator',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Open in Browser',
      click: () => shell.openExternal(`http://localhost:${PORT}`),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// ── App Lifecycle ──────────────────────────────────────────────

app.on('ready', async () => {
  createAppMenu();
  createSplash();
  createTray();

  startServer();

  try {
    await waitForServer();
  } catch (err) {
    console.error('Failed to start server:', err);
  }

  createMainWindow();

  // Explicit keyboard shortcuts (supplement menu accelerators)
  globalShortcut.register('CmdOrCtrl+R', () => {
    if (mainWindow && mainWindow.isFocused()) mainWindow.reload();
  });
  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    if (mainWindow && mainWindow.isFocused()) mainWindow.webContents.reloadIgnoringCache();
  });
  globalShortcut.register('F5', () => {
    if (mainWindow && mainWindow.isFocused()) mainWindow.reload();
  });
  globalShortcut.register('CmdOrCtrl+F5', () => {
    if (mainWindow && mainWindow.isFocused()) mainWindow.webContents.reloadIgnoringCache();
  });
});

app.on('window-all-closed', () => {
  // Keep running — tray icon active
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  globalShortcut.unregisterAll();
  stopServer();
});
