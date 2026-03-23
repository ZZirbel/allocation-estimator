import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Copy, FileSpreadsheet, GitBranch, Settings, Download, BookOpen } from 'lucide-react';
import type { Estimate, EstimateStatus } from '../types';
import { loadEstimates, deleteEstimate, saveEstimate } from '../lib/store';
import { getEstimateTotalSell, formatCurrency } from '../lib/calculations';
import { uid } from '../lib/ids';

// Electron API exposed via preload.js (only available in Electron)
interface ElectronAPI {
  checkForUpdates: () => Promise<{ available: boolean; commitsBehind?: number; error?: string }>;
  performUpdate: () => Promise<{ success: boolean; error?: string }>;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const STATUS_FILTERS: { value: EstimateStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

function createBlankEstimate(): Estimate {
  const now = new Date();
  const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    id: uid(),
    name: '',
    client: '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phases: [{
      id: uid(),
      name: 'Phase 1',
      startMonth,
      monthCount: 12,
      roles: [],
      allocations: {},
      notes: {},
      expenses: [],
    }],
    showMargin: false,
    versions: [],
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>(loadEstimates);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstimateStatus | 'all'>('all');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClient, setNewClient] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Refresh estimates when storage changes (from focus-based sync)
  const refreshEstimates = useCallback(() => {
    setEstimates(loadEstimates());
  }, []);

  useEffect(() => {
    window.addEventListener('storage', refreshEstimates);
    return () => window.removeEventListener('storage', refreshEstimates);
  }, [refreshEstimates]);

  // Check for updates on mount (only in Electron)
  useEffect(() => {
    const checkUpdates = async () => {
      if (!window.electronAPI?.isElectron) return;
      try {
        const result = await window.electronAPI.checkForUpdates();
        if (result.available) {
          setUpdateAvailable(true);
        }
      } catch (e) {
        console.log('[update] Check failed:', e);
      }
    };
    checkUpdates();
  }, []);

  async function handleUpdate() {
    if (!window.electronAPI) return;
    setUpdating(true);
    try {
      await window.electronAPI.performUpdate();
      // App will reload after update, so no need to handle success
    } catch (e) {
      console.error('[update] Failed:', e);
      setUpdating(false);
      setShowUpdateModal(false);
    }
  }

  const filtered = useMemo(() => {
    let list = estimates.filter((e) => !e.parentId); // exclude scenarios from main list
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q) || e.client.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [estimates, search, statusFilter]);

  function handleCreate() {
    const est = createBlankEstimate();
    est.name = newName || 'Untitled Estimate';
    est.client = newClient || 'Unknown Client';
    saveEstimate(est);
    setEstimates(loadEstimates());
    setShowNew(false);
    setNewName('');
    setNewClient('');
    navigate(`/estimate/${est.id}`);
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this estimate and all its scenarios?')) return;
    deleteEstimate(id);
    // Also delete scenarios
    const all = loadEstimates();
    all.filter((e) => e.parentId === id).forEach((e) => deleteEstimate(e.id));
    setEstimates(loadEstimates());
  }

  function handleDuplicate(est: Estimate) {
    const dup: Estimate = {
      ...JSON.parse(JSON.stringify(est)),
      id: uid(),
      name: `${est.name} (Copy)`,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentId: undefined,
      scenarioName: undefined,
    };
    saveEstimate(dup);
    setEstimates(loadEstimates());
  }

  function handleCreateScenario(est: Estimate) {
    const existingScenarios = estimates.filter((e) => e.parentId === est.id);
    const scenario: Estimate = {
      ...JSON.parse(JSON.stringify(est)),
      id: uid(),
      parentId: est.id,
      scenarioName: `Scenario ${existingScenarios.length + 2}`,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
    };
    saveEstimate(scenario);
    setEstimates(loadEstimates());
    navigate(`/estimate/${scenario.id}`);
  }

  function getScenarios(estId: string) {
    return estimates.filter((e) => e.parentId === estId);
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title">
          <FileSpreadsheet size={28} />
          <h1>Allocation Estimator</h1>
          {updateAvailable && (
            <button className="update-badge" onClick={() => setShowUpdateModal(true)}>
              <Download size={14} />
              New Version Available
            </button>
          )}
        </div>
        <div className="dashboard-actions">
          <div className="search-box">
            <Search size={16} />
            <input type="text" placeholder="Search estimates..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/summary')}>Summary</button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/guide')} title="User Guide">
            <BookOpen size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')} title="Settings">
            <Settings size={16} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New Estimate
          </button>
        </div>
      </header>

      <div className="status-filter-bar">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} className={statusFilter === f.value ? 'active' : ''} onClick={() => setStatusFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={() => setShowNew(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Estimate</h2>
            <div className="form-group">
              <label>Estimate Name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Acme Corp WFM Implementation" autoFocus />
            </div>
            <div className="form-group">
              <label>Client</label>
              <input type="text" value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="e.g. Acme Corporation" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showUpdateModal && (
        <div className="modal-overlay" onClick={() => !updating && setShowUpdateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2><Download size={20} /> Update Available</h2>
            <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>
              A new version of Allocation Estimator is available. Would you like to update now?
            </p>
            <p style={{ margin: '16px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              The app will pull the latest changes, rebuild, and reload automatically.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowUpdateModal(false)} disabled={updating}>
                Later
              </button>
              <button className="btn btn-primary" onClick={handleUpdate} disabled={updating}>
                {updating ? 'Updating...' : 'Update Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <FileSpreadsheet size={48} strokeWidth={1} />
          <h2>No estimates yet</h2>
          <p>Create your first allocation estimate to get started.</p>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New Estimate
          </button>
        </div>
      ) : (
        <div className="estimates-grid">
          {filtered.map((est) => {
            const total = getEstimateTotalSell(est);
            const scenarios = getScenarios(est.id);
            return (
              <div key={est.id} className="estimate-card" onClick={() => navigate(`/estimate/${est.id}`)}>
                <div className="card-header">
                  <h3>{est.name}</h3>
                  <span className={`badge badge-${est.status}`}>
                    {est.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="card-client">{est.client}</p>
                <div className="card-meta">
                  <span className="card-total">{formatCurrency(total)}</span>
                  <span className="card-roles">{est.phases.reduce((s, p) => s + p.roles.length, 0)} roles</span>
                  <span className="card-months">{est.phases.length} phase{est.phases.length !== 1 ? 's' : ''}</span>
                </div>
                {scenarios.length > 0 && (
                  <div className="card-scenarios">
                    <span className="badge badge-scenario-original" onClick={(e) => { e.stopPropagation(); navigate(`/estimate/${est.id}`); }}>
                      Original
                    </span>
                    {scenarios.map((s) => (
                      <span key={s.id} className="badge badge-draft" onClick={(e) => { e.stopPropagation(); navigate(`/estimate/${s.id}`); }}>
                        {s.scenarioName}
                      </span>
                    ))}
                  </div>
                )}
                <div className="card-date">Updated {new Date(est.updatedAt).toLocaleDateString()}</div>
                <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" title="Create Scenario" onClick={() => handleCreateScenario(est)}>
                    <GitBranch size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm" title="Duplicate" onClick={() => handleDuplicate(est)}>
                    <Copy size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-danger-text" title="Delete" onClick={() => handleDelete(est.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
