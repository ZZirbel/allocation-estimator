import type { Estimate, RoleLibraryEntry, RateCard, RoleTemplate } from '../types';

const ESTIMATES_KEY = 'allocation-estimator-estimates';
const ROLES_KEY = 'allocation-estimator-roles';
const RATE_CARDS_KEY = 'allocation-estimator-rate-cards';
const ROLE_TEMPLATES_KEY = 'allocation-estimator-role-templates';
const HYDRATED_KEY = 'allocation-estimator-hydrated';

// ── Server sync ─────────────────────────────────────────────────

function postJson(url: string, data: unknown) {
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch((err) => console.warn('[store] Server persist failed:', err));
}

function putJson(url: string, data: unknown) {
  fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch((err) => console.warn('[store] Server persist failed:', err));
}

function deleteRequest(url: string) {
  fetch(url, { method: 'DELETE' }).catch((err) => console.warn('[store] Server delete failed:', err));
}

/**
 * On startup, pull data from the server files and populate localStorage.
 * This ensures data persists across Electron rebuilds and is shared
 * when pointing to a OneDrive/SharePoint folder.
 */
export async function hydrateFromServer(): Promise<void> {
  if (sessionStorage.getItem(HYDRATED_KEY)) return;

  try {
    const [estRes, rolesRes, cardsRes, tmplRes] = await Promise.all([
      fetch('/api/estimates'),
      fetch('/api/role-library'),
      fetch('/api/rate-cards'),
      fetch('/api/role-templates'),
    ]);

    if (estRes.ok) {
      const estimates = await estRes.json();
      if (estimates && estimates.length > 0) {
        localStorage.setItem(ESTIMATES_KEY, JSON.stringify(estimates));
      }
    }
    if (rolesRes.ok) {
      const roles = await rolesRes.json();
      if (roles && roles.length > 0) {
        localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
      }
    }
    if (cardsRes.ok) {
      const cards = await cardsRes.json();
      if (cards && cards.length > 0) {
        localStorage.setItem(RATE_CARDS_KEY, JSON.stringify(cards));
      }
    }
    if (tmplRes.ok) {
      const templates = await tmplRes.json();
      if (templates && templates.length > 0) {
        localStorage.setItem(ROLE_TEMPLATES_KEY, JSON.stringify(templates));
      }
    }

    sessionStorage.setItem(HYDRATED_KEY, '1');
    console.log('[store] Hydrated localStorage from server files');
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

  for (const phase of e.phases) {
    const p = phase as Record<string, unknown>;
    if (!phase.roles) phase.roles = [];
    if (!phase.allocations) phase.allocations = {};
    if (!phase.notes) phase.notes = {};
    if (!phase.expenses) phase.expenses = [];
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
  // Persist this individual estimate to server
  putJson(`/api/estimates/${estimate.id}`, estimate);
}

export function deleteEstimate(id: string) {
  saveEstimates(loadEstimates().filter((e) => e.id !== id));
  deleteRequest(`/api/estimates/${id}`);
}

// ── Role Library ────────────────────────────────────────────────

export function loadRoleLibrary(): RoleLibraryEntry[] {
  const raw = localStorage.getItem(ROLES_KEY);
  if (raw) return JSON.parse(raw);
  return [];
}

export function saveRoleLibrary(roles: RoleLibraryEntry[]) {
  localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  postJson('/api/role-library', roles);
}

// ── Rate Cards ──────────────────────────────────────────────────

export function loadRateCards(): RateCard[] {
  const raw = localStorage.getItem(RATE_CARDS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveRateCards(cards: RateCard[]) {
  localStorage.setItem(RATE_CARDS_KEY, JSON.stringify(cards));
  postJson('/api/rate-cards', cards);
}

// ── Role Templates ──────────────────────────────────────────────

export function loadRoleTemplates(): RoleTemplate[] {
  const raw = localStorage.getItem(ROLE_TEMPLATES_KEY);
  if (raw) return JSON.parse(raw);
  return [];
}

export function saveRoleTemplates(templates: RoleTemplate[]) {
  localStorage.setItem(ROLE_TEMPLATES_KEY, JSON.stringify(templates));
  postJson('/api/role-templates', templates);
}

// ── Settings ────────────────────────────────────────────────────

export interface AppSettings {
  dataDir: string;
  defaultDataDir: string;
  configDir: string;
  dataDirExists: boolean;
  needsSetup: boolean;
}

export async function loadSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings');
  return res.json();
}

export async function saveSettings(dataDir: string, initializeData?: boolean): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataDir, initializeData }),
  });
  return res.json();
}
