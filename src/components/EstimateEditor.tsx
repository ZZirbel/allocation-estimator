import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Settings,
  Save,
  Plus,
  Copy,
  Clock,
  GitBranch,
  FileText,
  Layers,
  Trash2,
  Eye,
  RotateCcw,
} from 'lucide-react';
import type { Estimate, EstimatePhase, EstimateStatus, EstimateVersion, RoleTemplate } from '../types';
import { loadEstimate, loadEstimates, saveEstimate, loadRoleTemplates } from '../lib/store';
import { getEstimateTotalCost, getEstimateTotalSell, getEstimateMargin, formatCurrency, formatPercent } from '../lib/calculations';
import { exportEstimateToXlsx } from '../lib/excelExport';
import { uid } from '../lib/ids';
import PhaseGrid from './PhaseGrid';
import RoleLibrary from './RoleLibrary';

const STATUS_OPTIONS: { value: EstimateStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: '#f59e0b' },
  { value: 'in_review', label: 'In Review', color: '#3b82f6' },
  { value: 'approved', label: 'Approved', color: '#10b981' },
  { value: 'won', label: 'Won', color: '#059669' },
  { value: 'lost', label: 'Lost', color: '#ef4444' },
];

function createPhase(name: string, startMonth?: string): EstimatePhase {
  const now = new Date();
  return {
    id: uid(),
    name,
    startMonth: startMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    monthCount: 12,
    roles: [],
    allocations: {},
    notes: {},
    expenses: [],
  };
}

export default function EstimateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [activePhaseId, setActivePhaseId] = useState<string>('');
  const [showRoles, setShowRoles] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showStatusSelect, setShowStatusSelect] = useState(false);
  const [versionName, setVersionName] = useState('');
  const [saved, setSaved] = useState(true);
  const [showScenarioSwitch, setShowScenarioSwitch] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [compareVersionId, setCompareVersionId] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    if (id) {
      const est = loadEstimate(id);
      if (est) {
        // Migration: ensure new fields exist
        const migrated = {
          ...est,
          phases: est.phases || [],
          versions: est.versions || [],
          showMargin: est.showMargin ?? false,
        };
        // If old-style estimate with no phases, create a default one
        if (migrated.phases.length === 0) {
          const defaultPhase = createPhase('Phase 1');
          // Migrate old roles/allocations if they exist
          const estAny = est as unknown as Record<string, unknown>;
          if (estAny.roles) {
            defaultPhase.roles = estAny.roles as EstimatePhase['roles'];
            defaultPhase.allocations = (estAny.allocations || {}) as EstimatePhase['allocations'];
            if (estAny.startMonth) defaultPhase.startMonth = estAny.startMonth as string;
            if (estAny.monthCount) defaultPhase.monthCount = estAny.monthCount as number;
          }
          migrated.phases = [defaultPhase];
        }
        setEstimate(migrated as Estimate);
        setActivePhaseId(migrated.phases[0]?.id || '');
      } else navigate('/');
    }
  }, [id, navigate]);

  const handleChange = useCallback((updated: Estimate) => {
    setEstimate({ ...updated, updatedAt: new Date().toISOString() });
    setSaved(false);
  }, []);

  useEffect(() => {
    if (!estimate || saved) return;
    const timer = setTimeout(() => {
      saveEstimate(estimate);
      setSaved(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [estimate, saved]);

  if (!estimate) return null;

  const activePhase = estimate.phases.find((p) => p.id === activePhaseId);
  const totalCost = getEstimateTotalCost(estimate);
  const totalSell = getEstimateTotalSell(estimate);
  const margin = getEstimateMargin(estimate);
  const templates = loadRoleTemplates();

  // Scenario info
  const isScenario = !!estimate.parentId;
  const allEstimates = loadEstimates();
  const parentEstimate = isScenario ? allEstimates.find(e => e.id === estimate.parentId) : null;
  const relatedScenarios = isScenario
    ? allEstimates.filter(e => e.parentId === estimate.parentId || e.id === estimate.parentId)
    : allEstimates.filter(e => e.parentId === estimate.id);

  function handlePhaseChange(updated: EstimatePhase) {
    handleChange({
      ...estimate!,
      phases: estimate!.phases.map((p) => (p.id === updated.id ? updated : p)),
    });
  }

  function addPhase(duplicateFrom?: EstimatePhase) {
    const phase = duplicateFrom
      ? { ...JSON.parse(JSON.stringify(duplicateFrom)), id: uid(), name: `${duplicateFrom.name} (Copy)` }
      : createPhase(`Phase ${estimate!.phases.length + 1}`);
    handleChange({ ...estimate!, phases: [...estimate!.phases, phase] });
    setActivePhaseId(phase.id);
  }

  function removePhase(phaseId: string) {
    if (estimate!.phases.length <= 1) return;
    const phases = estimate!.phases.filter((p) => p.id !== phaseId);
    handleChange({ ...estimate!, phases });
    if (activePhaseId === phaseId) setActivePhaseId(phases[0].id);
  }

  function saveVersion() {
    if (!versionName.trim()) return;
    const snapshot = JSON.stringify({ ...estimate, versions: [] });
    const version: EstimateVersion = {
      id: uid(),
      name: versionName.trim(),
      createdAt: new Date().toISOString(),
      snapshot,
    };
    handleChange({ ...estimate!, versions: [...estimate!.versions, version] });
    setVersionName('');
    setActiveVersionId(version.id);
  }

  function updateVersion(versionId: string) {
    const snapshot = JSON.stringify({ ...estimate, versions: [] });
    const updatedVersions = estimate!.versions.map(v =>
      v.id === versionId
        ? { ...v, snapshot, createdAt: new Date().toISOString() }
        : v
    );
    handleChange({ ...estimate!, versions: updatedVersions });
  }

  function deleteVersion(versionId: string) {
    if (!confirm('Delete this version? This cannot be undone.')) return;
    const updatedVersions = estimate!.versions.filter(v => v.id !== versionId);
    handleChange({ ...estimate!, versions: updatedVersions });
    if (activeVersionId === versionId) setActiveVersionId(null);
    if (compareVersionId === versionId) setCompareVersionId(null);
  }

  function viewVersion(version: EstimateVersion) {
    const restored = JSON.parse(version.snapshot) as Estimate;
    restored.id = estimate!.id;
    restored.versions = estimate!.versions;
    restored.updatedAt = new Date().toISOString();
    handleChange(restored);
    setActivePhaseId(restored.phases[0]?.id || '');
    setActiveVersionId(version.id);
    setShowVersions(false);
  }

  function exitVersionView() {
    setActiveVersionId(null);
  }

  function getVersionTotals(version: EstimateVersion) {
    try {
      const data = JSON.parse(version.snapshot) as Estimate;
      return {
        sell: getEstimateTotalSell(data),
        cost: getEstimateTotalCost(data),
        phases: data.phases.length,
        roles: data.phases.reduce((sum, p) => sum + p.roles.length, 0),
      };
    } catch {
      return { sell: 0, cost: 0, phases: 0, roles: 0 };
    }
  }

  function applyTemplate(template: RoleTemplate) {
    if (!activePhase) return;
    const newRoles = template.roles.map((r) => ({
      id: uid(),
      title: r.title,
      hourlyRate: r.hourlyRate,
      sellRate: r.sellRate,
      location: 'onshore' as const,
    }));
    handlePhaseChange({ ...activePhase, roles: [...activePhase.roles, ...newRoles] });
    setShowTemplates(false);
  }

  function handleSave() {
    if (!estimate) return;
    saveEstimate(estimate);
    setSaved(true);
  }

  function handleExportPdf() {
    // Dynamic import to keep bundle lighter
    import('../lib/pdfExport').then(({ exportEstimateToPdf }) => {
      exportEstimateToPdf(estimate!);
    });
  }

  return (
    <div className="editor">
      <header className="editor-header">
        <div className="editor-nav">
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back
          </button>
          <div className="editor-title-group">
            <input className="editor-title" value={estimate.name} onChange={(e) => handleChange({ ...estimate, name: e.target.value })} placeholder="Estimate name" />
            <input className="editor-subtitle" value={estimate.client} onChange={(e) => handleChange({ ...estimate, client: e.target.value })} placeholder="Client name" />
          </div>
          {(isScenario || relatedScenarios.length > 0) && (
            <div className="scenario-switcher" style={{ position: 'relative' }}>
              <button className="scenario-indicator" onClick={() => setShowScenarioSwitch(!showScenarioSwitch)}>
                <GitBranch size={14} />
                {isScenario ? estimate.scenarioName : 'Original'}
              </button>
              {showScenarioSwitch && (
                <div className="scenario-dropdown" onClick={() => setShowScenarioSwitch(false)}>
                  {!isScenario && <div className="scenario-dropdown-item active">Original (current)</div>}
                  {isScenario && parentEstimate && (
                    <button className="scenario-dropdown-item" onClick={() => navigate(`/estimate/${parentEstimate.id}`)}>
                      Original
                    </button>
                  )}
                  {relatedScenarios.filter(s => s.id !== estimate.id && s.parentId).map((s) => (
                    <button key={s.id} className={`scenario-dropdown-item ${s.id === estimate.id ? 'active' : ''}`} onClick={() => navigate(`/estimate/${s.id}`)}>
                      {s.scenarioName}
                    </button>
                  ))}
                  {isScenario && <div className="scenario-dropdown-item active">{estimate.scenarioName} (current)</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="editor-meta">
          <div className="status-select" style={{ position: 'relative' }}>
            <button className={`badge badge-${estimate.status} badge-clickable`} onClick={() => setShowStatusSelect(!showStatusSelect)}>
              {STATUS_OPTIONS.find((s) => s.value === estimate.status)?.label}
            </button>
            {showStatusSelect && (
              <div className="status-dropdown" onClick={() => setShowStatusSelect(false)}>
                {STATUS_OPTIONS.map((opt) => (
                  <button key={opt.value} className={`status-option badge badge-${opt.value}`} onClick={() => handleChange({ ...estimate, status: opt.value })}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="editor-total">{formatCurrency(totalSell)}</span>
          {estimate.showMargin && (
            <span className="editor-margin" title="Margin">
              Cost: {formatCurrency(totalCost)} ({formatPercent(margin)} margin)
            </span>
          )}
          {activeVersionId && (
            <button className="version-badge" onClick={() => setShowVersions(true)}>
              <Clock size={12} />
              {estimate.versions.find(v => v.id === activeVersionId)?.name || 'Version'}
            </button>
          )}
          <div className="editor-actions">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleChange({ ...estimate, showMargin: !estimate.showMargin })} title={estimate.showMargin ? 'Hide cost & margin' : 'Show cost & margin'}>
              <Layers size={16} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowTemplates(true)} title="Role Templates">
              <GitBranch size={16} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowVersions(true)} title="Versions">
              <Clock size={16} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowRoles(true)} title="Role Library">
              <Settings size={16} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => exportEstimateToXlsx(estimate)} title="Export XLSX">
              <Download size={16} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={handleExportPdf} title="Export PDF">
              <FileText size={16} />
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saved}>
              <Save size={14} /> {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      {/* Phase Tabs */}
      <div className="phase-tabs">
        {estimate.phases.map((phase) => (
          <div key={phase.id} className={`phase-tab ${phase.id === activePhaseId ? 'phase-tab-active' : ''}`}>
            <button className="phase-tab-btn" onClick={() => setActivePhaseId(phase.id)}>
              {phase.name}
            </button>
            {estimate.phases.length > 1 && (
              <button className="phase-tab-close" onClick={() => removePhase(phase.id)} title="Remove phase">&times;</button>
            )}
          </div>
        ))}
        <div className="phase-tab-add-group">
          <button className="phase-tab-add" onClick={() => addPhase()} title="Add blank phase">
            <Plus size={14} />
          </button>
          {activePhase && (
            <button className="phase-tab-add" onClick={() => addPhase(activePhase)} title="Duplicate current phase">
              <Copy size={14} />
            </button>
          )}
        </div>
        {activePhase && (
          <div className="phase-config">
            <label>Start</label>
            <input type="month" value={activePhase.startMonth} onChange={(e) => handlePhaseChange({ ...activePhase, startMonth: e.target.value })} />
            <label>Months</label>
            <input type="number" min="1" max="36" value={activePhase.monthCount} onChange={(e) => handlePhaseChange({ ...activePhase, monthCount: Number(e.target.value) })} className="months-input" />
          </div>
        )}
      </div>

      {/* Phase Content */}
      <div className="editor-content">
        {activePhase ? (
          <PhaseGrid phase={activePhase} onChange={handlePhaseChange} showMargin={estimate.showMargin} />
        ) : (
          <div className="empty-state small"><p>No phase selected.</p></div>
        )}
      </div>

      {/* Modals */}
      {showRoles && <RoleLibrary onClose={() => setShowRoles(false)} />}

      {showVersions && (
        <div className="modal-overlay" onClick={() => setShowVersions(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2><Clock size={20} /> Version History</h2>

            {activeVersionId && (
              <div className="version-active-banner">
                <span>Viewing: <strong>{estimate.versions.find(v => v.id === activeVersionId)?.name}</strong></span>
                <button className="btn btn-ghost btn-sm" onClick={exitVersionView}>
                  <RotateCcw size={14} /> Exit Version View
                </button>
              </div>
            )}

            <div className="version-save-row">
              <input
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="Version name (e.g. v1 - Initial)"
              />
              <button className="btn btn-primary" onClick={saveVersion} disabled={!versionName.trim()}>
                <Save size={14} /> Save New Version
              </button>
            </div>

            {estimate.versions.length === 0 ? (
              <p className="modal-desc">No versions saved yet. Save a snapshot to preserve the current state.</p>
            ) : (
              <>
                <div className="version-compare-toggle">
                  <label className="settings-checkbox-label">
                    <input
                      type="checkbox"
                      checked={showCompare}
                      onChange={(e) => {
                        setShowCompare(e.target.checked);
                        if (!e.target.checked) setCompareVersionId(null);
                      }}
                    />
                    <span>Compare mode</span>
                  </label>
                  {showCompare && (
                    <select
                      value={compareVersionId || ''}
                      onChange={(e) => setCompareVersionId(e.target.value || null)}
                    >
                      <option value="">Select version to compare...</option>
                      {estimate.versions.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="version-list">
                  {estimate.versions.slice().reverse().map((v) => {
                    const totals = getVersionTotals(v);
                    const isActive = activeVersionId === v.id;
                    const compareWith = compareVersionId && compareVersionId !== v.id ? estimate.versions.find(cv => cv.id === compareVersionId) : null;
                    const compareTotals = compareWith ? getVersionTotals(compareWith) : null;

                    return (
                      <div key={v.id} className={`version-item ${isActive ? 'version-item-active' : ''}`}>
                        <div className="version-info">
                          <div className="version-header">
                            <strong>{v.name}</strong>
                            {isActive && <span className="badge badge-primary">Current</span>}
                          </div>
                          <span className="version-date">{new Date(v.createdAt).toLocaleString()}</span>
                          <div className="version-stats">
                            <span>{totals.phases} phases</span>
                            <span>{totals.roles} roles</span>
                            <span>{formatCurrency(totals.sell)}</span>
                            {showCompare && compareTotals && (
                              <span className={totals.sell > compareTotals.sell ? 'version-diff-up' : totals.sell < compareTotals.sell ? 'version-diff-down' : ''}>
                                {totals.sell > compareTotals.sell ? '+' : ''}{formatCurrency(totals.sell - compareTotals.sell)} vs {compareWith?.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="version-actions">
                          <button className="btn btn-ghost btn-sm" onClick={() => viewVersion(v)} title="View this version">
                            <Eye size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => updateVersion(v.id)} title="Update with current changes">
                            <Save size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => deleteVersion(v.id)} title="Delete version">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowVersions(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <div className="modal-overlay" onClick={() => setShowTemplates(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>Role Templates</h2>
            <p className="modal-desc">Apply a template to add roles to the current phase.</p>
            <div className="template-picker">
              {templates.map((t) => (
                <div key={t.id} className="template-card" onClick={() => applyTemplate(t)}>
                  <h4>{t.name}</h4>
                  <p>{t.roles.map((r) => r.title).join(', ')}</p>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowTemplates(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
