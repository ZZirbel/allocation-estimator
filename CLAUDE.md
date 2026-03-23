# Allocation Estimator - Claude Code Guide

## Documentation Maintenance Requirements

**IMPORTANT**: When making changes to this application, you (Claude Code) MUST update all relevant documentation to reflect those changes. This includes:

1. **This file (CLAUDE.md)**: Update any sections affected by your changes:
   - New components → update Project Structure
   - New API endpoints → update API Endpoints table
   - New data fields → update Key Concepts interfaces
   - New commands → update Key Commands
   - Changed behavior → update relevant sections

2. **docs/user-guide.md**: Update if changes affect user-facing functionality:
   - New features or UI elements
   - Changed workflows or behaviors
   - New keyboard shortcuts

3. **README.md**: Update if changes affect:
   - Installation or setup process
   - Core feature descriptions
   - Screenshots (if UI changed significantly)

4. **Code comments**: Add/update inline comments for complex logic

**Before committing**: Review your changes and ask yourself "Would a future Claude session need to know about this?" If yes, document it.

---

## Project Overview

A desktop application for creating resource allocation estimates for consulting engagements. Users define roles with hourly rates, allocate percentages across months, and generate cost/sell projections. Designed for team use with shared data via SharePoint/OneDrive sync.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js (server.cjs) - serves API + static files
- **Desktop**: Electron wrapper (desktop/)
- **Styling**: Plain CSS (src/styles.css)
- **Exports**: jsPDF + jspdf-autotable (PDF), SheetJS/xlsx (Excel)

## Project Structure

```
allocation-estimator/
├── src/                      # React frontend
│   ├── components/
│   │   ├── Dashboard.tsx     # Home page, estimate list
│   │   ├── EstimateEditor.tsx # Main estimate editing view
│   │   ├── PhaseGrid.tsx     # Allocation grid (roles × months)
│   │   ├── RoleLibrary.tsx   # Manage shared role definitions
│   │   ├── Settings.tsx      # Data directory configuration
│   │   └── SummaryDashboard.tsx
│   ├── lib/
│   │   ├── store.ts          # localStorage + server sync
│   │   ├── calculations.ts   # Cost/sell/margin calculations
│   │   ├── pdfExport.ts      # PDF generation
│   │   ├── excelExport.ts    # Excel generation
│   │   └── ids.ts            # UID generation
│   ├── types.ts              # TypeScript interfaces
│   ├── styles.css            # All styles (single file)
│   ├── App.tsx               # Router + setup wizard check
│   └── main.tsx              # Entry point, hydration
├── server.cjs                # Express backend (CommonJS)
├── desktop/                  # Electron app
│   ├── main.js               # Electron main process
│   ├── package.json          # Electron dependencies
│   └── create-shortcut.ps1   # Windows shortcut creator
├── data-templates/           # Starter files for new setups
│   ├── role-library.example.json
│   ├── rate-cards.example.json
│   └── role-templates.example.json
└── docs/                     # User documentation
```

## Key Commands

```bash
# Development (hot reload)
npm run dev                   # Starts Vite at http://localhost:5173

# Production build
npm run build                 # TypeScript check + Vite build → dist/

# Run production server
node server.cjs               # Serves at http://localhost:4000

# Electron (development)
npm install && cd desktop && npm install && cd ..
npx electron desktop/         # Starts Electron + Express

# Electron (production build)
npm run build
cd desktop && npm run build   # Creates desktop/dist/win-unpacked/
```

## Data Architecture

### Storage Layers
1. **localStorage**: Runtime cache for fast UI access
2. **Server files**: Persisted JSON in configured data directory
3. **Hydration**: On app load, server files → localStorage

### Data Sync (Team Collaboration)
- **Ctrl+R refresh**: Re-hydrates all data from server files (picks up team changes)
- **Focus-based sync**: When window gains focus, automatically re-fetches from server
  - 30-second debounce prevents excessive fetching
  - Dashboard listens for `storage` events to refresh estimate list
- **Write path**: Changes save to localStorage immediately, then async POST to server
- **Conflict handling**: Last write wins (no merge logic currently)

### Data Directory Structure
```
<dataDir>/
├── estimates/
│   └── <name>-<id>.json      # One file per estimate
├── role-library.json         # Shared role definitions
├── rate-cards.json           # Rate card configurations
└── role-templates.json       # Reusable role sets
```

### Config Location
- **Electron**: `%APPDATA%/allocation-estimator-desktop/data/config.json`
- **Dev/CLI**: `./data/config.json`

Config contains: `{ "dataDir": "<path>", "configured": true }`

## Key Concepts

### Estimate Structure
```typescript
interface Estimate {
  id: string;
  name: string;
  client: string;
  status: 'draft' | 'in_review' | 'approved' | 'won' | 'lost';
  phases: EstimatePhase[];      // Multiple phases per estimate
  showMargin: boolean;          // Toggle to show cost rate + margin
  versions: EstimateVersion[];  // Snapshots for history
}
```

### Phase Structure
```typescript
interface EstimatePhase {
  id: string;
  name: string;
  startMonth: string;           // "YYYY-MM" format
  monthCount: number;
  roles: Role[];
  allocations: Record<roleId, Record<monthKey, decimal>>;  // 0-1 values
  expenses: ExpenseLine[];
}
```

### Role Structure
```typescript
interface Role {
  id: string;
  title: string;
  hourlyRate: number;           // Cost rate (internal)
  sellRate?: number;            // Sell rate (client-facing)
  location: 'onshore' | 'offshore';
}
```

### Rate Display Logic
- **Default view**: Shows Sell Rate
- **showMargin=true**: Also shows Cost Rate + calculated margin
- Standard: 160 hours/month for all calculations

## API Endpoints (server.cjs)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/settings` | GET | Get config (dataDir, needsSetup) |
| `/api/settings` | POST | Update dataDir, optionally initialize |
| `/api/estimates` | GET | List all estimates |
| `/api/estimates/:id` | GET/PUT/DELETE | Single estimate CRUD |
| `/api/role-library` | GET/POST | Shared role definitions |
| `/api/rate-cards` | GET/POST | Rate card configurations |
| `/api/role-templates` | GET/POST | Role templates |
| `/api/data` | GET/POST | Legacy bulk data endpoint |

## Common Development Tasks

### Adding a New Field to Estimates
1. Update `types.ts` with new field
2. Add migration logic in `store.ts` → `migrateEstimate()`
3. Update relevant components
4. Consider export functions (pdfExport.ts, excelExport.ts)

### Changing Data Directory Behavior
- `store.ts`: `clearLocalData()` clears localStorage + sessionStorage
- `Settings.tsx`: Calls `clearLocalData()` then `window.location.reload()`
- Server reloads data from new directory on next API call

### Modifying the Grid Display
- `PhaseGrid.tsx`: Main allocation grid component
- CSS classes: `.cell-pct`, `.cost-label`, `.sell-label`, `.total-cell`
- View modes: 'pct' | 'cost' | 'both'

### Export Changes
- **PDF**: `src/lib/pdfExport.ts` - uses jsPDF + autoTable
- **Excel**: `src/lib/excelExport.ts` - uses SheetJS

## Code Conventions

### TypeScript
- Strict mode enabled
- Use `as unknown as Type` for unsafe casts (migration code)
- Interfaces in `types.ts`, component-local types inline

### React Patterns
- Functional components with hooks
- `useState` for local state, localStorage for persistence
- Auto-save with debounce (1 second delay in EstimateEditor)

### CSS
- Single file: `src/styles.css`
- CSS variables for theming (--bg, --text, --border, etc.)
- BEM-ish naming: `.component-element`

### File Naming
- Estimate files: `<slugified-name>-<id>.json`
- Components: PascalCase.tsx
- Utilities: camelCase.ts

## Testing Notes

- No automated test suite currently
- Manual testing via dev server or Electron app
- Test data directory switching by pointing to different folders
- Test exports by generating PDF/Excel and verifying content

## Electron Specifics

- `CONFIG_DIR` env var set to `%APPDATA%/allocation-estimator-desktop/data/`
- Server spawned as child process on port 4000
- Keyboard shortcuts: Ctrl+R (reload), Ctrl+U (git pull), Ctrl+Q (quit)
- Tray icon for background operation

### Auto-Update System
- **Daily check**: On app startup, checks if 24+ hours since last update check
- **Update config**: Stored in `%APPDATA%/allocation-estimator-desktop/data/update-check.json`
- **UI notification**: "New Version Available" badge appears in Dashboard header
- **User-initiated**: Clicking badge shows confirmation modal, then pulls/rebuilds/reloads
- **IPC communication**: `preload.js` exposes `electronAPI` to renderer via contextBridge
  - `checkForUpdates()`: Runs `git fetch` and compares HEAD to origin/main
  - `performUpdate()`: Triggers existing `pullUpdates()` function

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Setup wizard appears unexpectedly | Check `config.json` has `"configured": true` |
| Data not loading after directory change | Ensure `clearLocalData()` is called before reload |
| Team changes not appearing | Press Ctrl+R or switch away and back to window |
| Role library empty | Initialize data directory or check file exists |
| Build TypeScript errors | Use `as unknown as Type` for migration casts |
| Electron won't start | Check node server.cjs works standalone first |

## Documentation Files

Keep these files in sync with code changes:

| File | Purpose | Update When |
|------|---------|-------------|
| `CLAUDE.md` | AI development guide (this file) | Any architectural, API, or structural changes |
| `README.md` | User-facing quick start | Setup process, core features, or screenshots change |
| `docs/user-guide.md` | Detailed user manual | UI, workflows, or features change |
| `docs/future-enhancements.md` | Roadmap/backlog | Features completed or new ideas added |

When completing a task, always check: **"Does this change require documentation updates?"**
