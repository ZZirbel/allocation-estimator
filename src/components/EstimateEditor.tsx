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
} from 'lucide-react';
import type { Estimate, EstimatePhase, EstimateStatus, EstimateVersion, RoleTemplate } from '../types';
import { loadEstimate, saveEstimate, loadRoleTemplates } from '../lib/store';
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
          if ((est as Record<string, unknown>).roles) {
            defaultPhase.roles = (est as Record<string, unknown>).roles as EstimatePhase['roles'];
            defaultPhase.allocations = ((est as Record<string, unknown>).allocations || {}) as EstimatePhase['allocations'];
            if ((est as Record<string, unknown>).startMonth) defaultPhase.startMonth = (est as Record<string, unknown>).startMonth as string;
            if ((est as Record<string, unknown>).monthCount) defaultPhase.monthCount = (est as Record<string, unknown>).monthCount as number;
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
    setShowVersions(false);
  }

  function restoreVersion(version: EstimateVersion) {
    const restored = JSON.parse(version.snapshot) as Estimate;
    restored.id = estimate!.id;
    restored.versions = estimate!.versions;
    restored.updatedAt = new Date().toISOString();
    handleChange(restored);
    setActivePhaseId(restored.phases[0]?.id || '');
    setShowVersions(false);
  }

  function applyTemplate(template: RoleTemplate) {
    if (!activePhase) return;
    const newRoles = template.roles.map((r) => ({
      id: uid(),
      title: r.title,
      hourlyRate: r.hourlyRate,
      sellRate: r.sellRate,
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
          <span className="editor-total">{formatCurrency(totalCost)}</span>
          {estimate.showMargin && (
            <span className="editor-margin" title="Margin">
              Sell: {formatCurrency(totalSell)} ({formatPercent(margin)} margin)
            </span>
          )}
          <div className="editor-actions">
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleChange({ ...estimate, showMargin: !estimate.showMargin })} title={estimate.showMargin ? 'Hide margin' : 'Show margin'}>
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
            <h2>Version History</h2>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="Version name (e.g. v1 - Initial)" />
              </div>
              <button className="btn btn-primary" onClick={saveVersion} style={{ alignSelf: 'flex-end' }}>Save Snapshot</button>
            </div>
            {estimate.versions.length === 0 ? (
              <p className="modal-desc">No versions saved yet. Save a snapshot to preserve the current state.</p>
            ) : (
              <div className="version-list">
                {estimate.versions.map((v) => (
                  <div key={v.id} className="version-item">
                    <div>
                      <strong>{v.name}</strong>
                      <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>{new Date(v.createdAt).toLocaleString()}</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => restoreVersion(v)}>Restore</button>
                  </div>
                ))}
              </div>
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
