import type { Estimate, RoleLibraryEntry, RateCard, RoleTemplate } from '../types';

const ESTIMATES_KEY = 'allocation-estimator-estimates';
const ROLES_KEY = 'allocation-estimator-roles';
const RATE_CARDS_KEY = 'allocation-estimator-rate-cards';
const ROLE_TEMPLATES_KEY = 'allocation-estimator-role-templates';
const HYDRATED_KEY = 'allocation-estimator-hydrated';

// ── Server sync (fire-and-forget writes, startup hydration) ─────

const API_URL = '/api/data';

interface ServerData {
  estimates: Estimate[];
  roleLibrary: RoleLibraryEntry[] | null;
  rateCards: RateCard[];
  roleTemplates: RoleTemplate[] | null;
}

function persistToServer() {
  const payload: ServerData = {
    estimates: loadEstimates(),
    roleLibrary: (() => {
      const raw = localStorage.getItem(ROLES_KEY);
      return raw ? JSON.parse(raw) : null;
    })(),
    rateCards: loadRateCards(),
    roleTemplates: (() => {
      const raw = localStorage.getItem(ROLE_TEMPLATES_KEY);
      return raw ? JSON.parse(raw) : null;
    })(),
  };

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn('[store] Server persist failed:', err));
}

/**
 * On startup, pull data from the server file and populate localStorage.
 * This ensures data survives Electron rebuilds since the server writes
 * to %APPDATA%/allocation-estimator-desktop/data/appdata.json.
 *
 * Only hydrates once per session to avoid overwriting in-memory edits.
 */
export async function hydrateFromServer(): Promise<void> {
  // Skip if already hydrated this session
  if (sessionStorage.getItem(HYDRATED_KEY)) return;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) return;

    const data: ServerData = await res.json();

    // Only hydrate if the server actually has data
    if (data.estimates && data.estimates.length > 0) {
      localStorage.setItem(ESTIMATES_KEY, JSON.stringify(data.estimates));
    }
    if (data.roleLibrary) {
      localStorage.setItem(ROLES_KEY, JSON.stringify(data.roleLibrary));
    }
    if (data.rateCards && data.rateCards.length > 0) {
      localStorage.setItem(RATE_CARDS_KEY, JSON.stringify(data.rateCards));
    }
    if (data.roleTemplates) {
      localStorage.setItem(ROLE_TEMPLATES_KEY, JSON.stringify(data.roleTemplates));
    }

    sessionStorage.setItem(HYDRATED_KEY, '1');
    console.log('[store] Hydrated localStorage from server file');
  } catch {
    console.warn('[store] Server hydration unavailable (standalone browser mode)');
  }
}

// ── Migration ───────────────────────────────────────────────────

function migrateEstimate(est: Record<string, unknown>): Estimate {
  const e = est as Estimate;
  if (!e.phases) e.phases = [];
  if (!e.versions) e.versions = [];
  if (e.showMargin === undefined) e.showMargin = false;
  if (e.status === undefined) (e as Estimate).status = 'draft';

  // Migrate old top-level roles/allocations into a default phase
  if (e.phases.length === 0 && (est.roles || est.startMonth)) {
    e.phases = [{
      id: `migrated-${e.id}`,
      name: 'Phase 1',
      startMonth: (est.startMonth as string) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      monthCount: (est.monthCount as number) || 12,
      roles: (est.roles as Estimate['phases'][0]['roles']) || [],
      allocations: (est.allocations as Record<string, Record<string, number>>) || {},
      notes: {},
      expenses: [],
    }];
  }

  // Migrate old phase format
  for (const phase of e.phases) {
    const p = phase as Record<string, unknown>;
    if (!phase.roles) phase.roles = [];
    if (!phase.allocations) phase.allocations = {};
    if (!phase.notes) phase.notes = {};
    if (!phase.expenses) phase.expenses = [];
    // Migrate roles without location
    for (const role of phase.roles) {
      if (!(role as Record<string, unknown>).location) {
        (role as Record<string, unknown>).location = 'onshore';
      }
    }
    if (p.entries && !phase.roles.length) {
      delete p.entries;
    }
  }

  return e;
}

// ── Estimates ───────────────────────────────────────────────────

export function loadEstimates(): Estimate[] {
  const raw = localStorage.getItem(ESTIMATES_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as Record<string, unknown>[];
  return parsed.map(migrateEstimate);
}

export function saveEstimates(estimates: Estimate[]) {
  localStorage.setItem(ESTIMATES_KEY, JSON.stringify(estimates));
  persistToServer();
}

export function loadEstimate(id: string): Estimate | undefined {
  return loadEstimates().find((e) => e.id === id);
}

export function saveEstimate(estimate: Estimate) {
  const estimates = loadEstimates();
  const idx = estimates.findIndex((e) => e.id === estimate.id);
  if (idx >= 0) estimates[idx] = estimate;
  else estimates.push(estimate);
  saveEstimates(estimates);
}

export function deleteEstimate(id: string) {
  saveEstimates(loadEstimates().filter((e) => e.id !== id));
}

// ── Role Library ────────────────────────────────────────────────

const DEFAULT_ROLES: RoleLibraryEntry[] = [
  { id: 'sa', title: 'Strategic Advisor', defaultRate: 300, defaultSellRate: 390, offshoreRate: 150, offshoreSellRate: 195 },
  { id: 'pm', title: 'Project Manager', defaultRate: 250, defaultSellRate: 325, offshoreRate: 125, offshoreSellRate: 163 },
  { id: 'ssa', title: 'Senior Solution Architect', defaultRate: 275, defaultSellRate: 358, offshoreRate: 138, offshoreSellRate: 179 },
  { id: 'wl', title: 'Workstream Lead', defaultRate: 250, defaultSellRate: 325, offshoreRate: 125, offshoreSellRate: 163 },
  { id: 'sic', title: 'Senior Implementation Consultant', defaultRate: 225, defaultSellRate: 293, offshoreRate: 113, offshoreSellRate: 147 },
  { id: 'ic', title: 'Implementation Consultant', defaultRate: 200, defaultSellRate: 260, offshoreRate: 100, offshoreSellRate: 130 },
];

export function loadRoleLibrary(): RoleLibraryEntry[] {
  const raw = localStorage.getItem(ROLES_KEY);
  if (raw) return JSON.parse(raw);
  return DEFAULT_ROLES;
}

export function saveRoleLibrary(roles: RoleLibraryEntry[]) {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  persistToServer();
}

// ── Rate Cards ──────────────────────────────────────────────────

export function loadRateCards(): RateCard[] {
  const raw = localStorage.getItem(RATE_CARDS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRateCards(cards: RateCard[]) {
  localStorage.setItem(RATE_CARDS_KEY, JSON.stringify(cards));
  persistToServer();
}

// ── Role Templates ──────────────────────────────────────────────

const DEFAULT_TEMPLATES: RoleTemplate[] = [
  {
    id: 'standard-wfm',
    name: 'Standard WFM Implementation',
    roles: [
      { title: 'Strategic Advisor', hourlyRate: 300, sellRate: 390 },
      { title: 'Project Manager', hourlyRate: 250, sellRate: 325 },
      { title: 'Senior Solution Architect', hourlyRate: 275, sellRate: 358 },
      { title: 'Workstream Lead', hourlyRate: 250, sellRate: 325 },
      { title: 'Workstream Lead', hourlyRate: 250, sellRate: 325 },
      { title: 'Workstream Lead', hourlyRate: 250, sellRate: 325 },
      { title: 'Implementation Consultant', hourlyRate: 200, sellRate: 260 },
      { title: 'Implementation Consultant', hourlyRate: 200, sellRate: 260 },
      { title: 'Implementation Consultant', hourlyRate: 200, sellRate: 260 },
      { title: 'Implementation Consultant', hourlyRate: 200, sellRate: 260 },
    ],
  },
  {
    id: 'discovery-only',
    name: 'Discovery Only',
    roles: [
      { title: 'Senior Solution Architect', hourlyRate: 275, sellRate: 358 },
      { title: 'Senior Implementation Consultant', hourlyRate: 225, sellRate: 293 },
      { title: 'Implementation Consultant', hourlyRate: 200, sellRate: 260 },
    ],
  },
];

export function loadRoleTemplates(): RoleTemplate[] {
  const raw = localStorage.getItem(ROLE_TEMPLATES_KEY);
  if (raw) return JSON.parse(raw);
  return DEFAULT_TEMPLATES;
}

export function saveRoleTemplates(templates: RoleTemplate[]) {
  localStorage.setItem(ROLE_TEMPLATES_KEY, JSON.stringify(templates));
  persistToServer();
}
