# Allocation Estimator

A desktop application for resource allocation and pricing estimation. Built for teams that need to plan project staffing, calculate costs, and generate professional estimates.

![Dashboard](docs/images/dashboard.png)

## Features

- **Multi-phase estimates** with independent role allocations per phase
- **Monthly allocation grid** with percentage-based resource planning (160 hrs/month)
- **Onshore/offshore support** with automatic rate switching from a shared role library
- **Margin tracking** with cost and sell rate visibility
- **Travel & expenses** line items per phase
- **PDF and Excel export** for client-ready deliverables
- **Version history** with named snapshots and restore
- **Role templates** for rapid estimate setup
- **Pipeline dashboard** with summary analytics and FTE demand forecasting
- **Shared team storage** via synced SharePoint/OneDrive folders
- **Desktop app** with system tray, background server, and auto-update from GitHub

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [Git](https://git-scm.com/) (for cloning and updates)
- Windows 10/11 (Electron desktop wrapper is Windows-targeted)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/ZZirbel/allocation-estimator.git
cd allocation-estimator
```

### 2. Install dependencies

```bash
npm install
cd desktop && npm install && cd ..
```

### 3. Build the web app

```bash
npm run build
```

### 4. Build the desktop app

```bash
cd desktop
npm run build
```

The built application will be at `desktop/dist/win-unpacked/Allocation Estimator.exe`.

### 5. Create shortcuts

```powershell
powershell -ExecutionPolicy Bypass -File desktop/create-shortcut.ps1
```

This creates a Desktop shortcut and a Start Menu entry so you can pin the app to your taskbar.

### 6. Launch and configure

Double-click the shortcut or run the exe. On first launch, you'll be prompted to set a **data directory**:

![Setup Wizard](docs/images/setup-wizard.png)

- **Personal use:** Click "Use Local Default" to store data on your machine only.
- **Team use:** Paste the path to a synced SharePoint folder (see [Shared Team Setup](#shared-team-setup) below).
- **Initialize data directory:** Check this box if the directory is brand new. This creates starter files (role library, rate cards, role templates) so you can begin immediately. Do **not** check this if pointing to a directory that already has data from another user's setup.

## Shared Team Setup

The app stores data as JSON files in a configurable directory. To share data across a team, point everyone's data directory to the same synced SharePoint folder.

### Step-by-step

1. **Create a SharePoint folder.** Go to your team's SharePoint site → Documents library → create a folder (e.g., "Allocation Estimator").

2. **Sync the folder.** In SharePoint, click **Sync**. OneDrive will create a local copy on your machine. The path will look something like:
   ```
   C:\Users\YourName\YourOrg\SiteName - Documents\Allocation Estimator
   ```

3. **Configure the app (first team member).** On first launch, paste the local synced folder path as the data directory and **check "Initialize data directory"**. This creates the starter data files (role library, rate cards, templates) in the shared folder.

4. **Each additional team member repeats steps 2-3** but does **not** check "Initialize data directory" — the files already exist from the first person's setup. They just paste their own local synced path and click Save.

### How it works

- The app reads/writes files directly to the local synced folder
- OneDrive (already signed in on each person's device) handles sync and authentication
- Each estimate is stored as a separate JSON file, so multiple people can work on different estimates simultaneously
- No additional login, API keys, or configuration needed

### Data structure

```
<data-directory>/
  estimates/
    <estimate-id>.json     # One file per estimate
  role-library.json        # Shared role definitions and rates
  rate-cards.json          # Shared rate cards
  role-templates.json      # Shared role templates
```

These shared files are created automatically when you check **"Initialize data directory"** during setup. Starter templates are stored in `data-templates/` in the repository and can be customized before initialization.

## Development

### Run in dev mode (hot reload)

```bash
npm run dev
```

Opens at `http://localhost:5173` with Vite HMR.

### Run with Express server (production mode)

```bash
npm run build
node server.cjs
```

Opens at `http://localhost:4000`.

### Run the Electron app in dev mode

```bash
cd desktop
npx electron .
```

This starts the Express server and opens the Electron window.

## Updating

### From the app

Press **Ctrl+U** (or File → Pull Updates) to pull the latest code from GitHub, rebuild, and reload — all without closing the app.

### From the command line

```bash
git pull origin main
npm run build
cd desktop && npm run build
```

## Configuration

All user configuration is stored at:

```
%APPDATA%/allocation-estimator-desktop/data/config.json
```

This file contains only the data directory path and is never committed to git.

You can change the data directory at any time via the Settings page (gear icon on the dashboard).

![Settings](docs/images/settings.png)

## Screenshots

### Estimate Editor

The allocation grid with cost/sell rates, monthly percentage allocations, totals, and margin tracking:

![Estimate Editor](docs/images/estimate-editor.png)

### Add Role

Add roles from a shared library with onshore/offshore rate switching, or define custom roles:

![Add Role Modal](docs/images/add-role-modal.png)

### Pipeline Summary

Bird's-eye view of all estimates with pipeline value, won revenue, and FTE demand forecasting:

![Summary Dashboard](docs/images/summary-dashboard.png)

### Context Menus

Right-click any role row for quick actions — switch location, duplicate, clear allocations, or remove:

![Context Menu](docs/images/context-menu.png)

## Troubleshooting

### Role library / templates are empty

If you launch the app and the role library or templates are empty, it usually means the data directory was not initialized with starter files.

**Fix:** Go to Settings (gear icon), check **"Initialize data directory"**, and click Save. This copies the starter files into your data directory.

### "Some files were skipped" warning during setup

This appears when you check "Initialize data directory" but the directory already contains `role-library.json`, `rate-cards.json`, or `role-templates.json`. Existing files are **not** overwritten to prevent data loss.

**If intentional:** No action needed — your existing data is preserved.

**If you want to reset to defaults:** Manually delete the files from the data directory (or rename them), then re-run setup with initialization checked.

### Multiple team members see different data

Everyone must point to the same synced SharePoint folder. Verify that:
- Each person has the SharePoint folder synced via OneDrive
- Each person's data directory path in Settings points to their local copy of that synced folder
- OneDrive sync is running and not paused

### App shows "Could not load settings"

The Express server isn't running. This can happen in browser-only dev mode (`npm run dev`). For full functionality including settings and file persistence, run the Express server:

```bash
npm run build && node server.cjs
```

Or use the Electron desktop app which starts the server automatically.

### Data not persisting after rebuild

The Electron app stores config at `%APPDATA%/allocation-estimator-desktop/data/config.json`. This config points to your data directory, which is **outside** the git repository and survives rebuilds. If data is missing after a rebuild, check that:
- The config file still exists and points to the correct directory
- The data directory itself hasn't been moved or deleted

For more details, see the [User Guide](docs/user-guide.md).

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Server:** Express (CommonJS, serves the built frontend + data API)
- **Desktop:** Electron with system tray and auto-update support
- **Storage:** JSON files on disk (local or synced via OneDrive/SharePoint)
- **Export:** jsPDF + jspdf-autotable (PDF), SheetJS (Excel)

## License

[MIT](LICENSE)
