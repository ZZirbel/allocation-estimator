import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import type { EstimatePhase, Role, ExpenseLine, ResourceLocation } from '../types';
import { loadRoleLibrary } from '../lib/store';
import { uid } from '../lib/ids';
import {
  getMonthKeys,
  formatMonthLabel,
  getRoleMonthlyCost,
  getRoleMonthlySell,
  getPhaseRoleTotalCost,
  getPhaseRoleTotalSell,
  getPhaseRoleTotalAllocation,
  getPhaseMonthTotalAllocation,
  getPhaseMonthTotalCost,
  getPhaseMonthTotalSell,
  getPhaseTotalCost,
  getPhaseTotalSell,
  getPhaseExpensesTotal,
  formatCurrency,
  formatPercent,
} from '../lib/calculations';

interface Props {
  phase: EstimatePhase;
  onChange: (phase: EstimatePhase) => void;
  showMargin: boolean;
}

type ViewMode = 'pct' | 'cost' | 'both';

interface ContextMenuState {
  x: number;
  y: number;
  roleId?: string;
  monthKey?: string;
  type: 'role' | 'cell' | 'phase';
}

export default function PhaseGrid({ phase, onChange, showMargin }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleRate, setNewRoleRate] = useState(200);
  const [newRoleSellRate, setNewRoleSellRate] = useState(260);
  const [newRoleLocation, setNewRoleLocation] = useState<ResourceLocation>('onshore');
  const [showBulkApply, setShowBulkApply] = useState(false);
  const [bulkRoleId, setBulkRoleId] = useState('');
  const [bulkFromMonth, setBulkFromMonth] = useState('');
  const [bulkToMonth, setBulkToMonth] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showExpenses, setShowExpenses] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  // Drag-to-fill state
  const [dragSource, setDragSource] = useState<{ roleId: string; monthKey: string } | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const isDragging = useRef(false);

  const monthKeys = getMonthKeys(phase.startMonth, phase.monthCount);
  const library = loadRoleLibrary();

  // Close context menu on click elsewhere
  useEffect(() => {
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  function update(updates: Partial<EstimatePhase>) {
    onChange({ ...phase, ...updates });
  }

  function setAllocation(roleId: string, monthKey: string, value: number) {
    const allocs = { ...phase.allocations };
    if (!allocs[roleId]) allocs[roleId] = {};
    allocs[roleId] = { ...allocs[roleId], [monthKey]: value };
    update({ allocations: allocs });
  }

  function setRoleField(roleId: string, field: keyof Role, value: string | number) {
    const roles = phase.roles.map((r) =>
      r.id === roleId ? { ...r, [field]: value } : r
    );
    update({ roles });
  }

  function toggleRoleLocation(roleId: string) {
    const role = phase.roles.find((r) => r.id === roleId);
    if (!role) return;
    const newLocation: ResourceLocation = role.location === 'onshore' ? 'offshore' : 'onshore';
    const libEntry = library.find((e) => e.title === role.title);
    const roles = phase.roles.map((r) => {
      if (r.id !== roleId) return r;
      if (libEntry) {
        return {
          ...r,
          location: newLocation,
          hourlyRate: newLocation === 'offshore' ? (libEntry.offshoreRate || r.hourlyRate) : libEntry.defaultRate,
          sellRate: newLocation === 'offshore' ? (libEntry.offshoreSellRate || r.sellRate) : libEntry.defaultSellRate,
        };
      }
      return { ...r, location: newLocation };
    });
    update({ roles });
  }

  function addRole() {
    const libEntry = library.find((e) => e.title === newRoleTitle);
    const role: Role = {
      id: uid(),
      title: newRoleTitle || 'New Role',
      hourlyRate: newRoleLocation === 'offshore' && libEntry?.offshoreRate ? libEntry.offshoreRate : newRoleRate,
      sellRate: newRoleLocation === 'offshore' && libEntry?.offshoreSellRate ? libEntry.offshoreSellRate : newRoleSellRate,
      location: newRoleLocation,
    };
    update({ roles: [...phase.roles, role] });
    setShowAddRole(false);
    setNewRoleTitle('');
    setNewRoleRate(200);
    setNewRoleSellRate(260);
    setNewRoleLocation('onshore');
  }

  function addRoleFromLibrary(entry: { title: string; defaultRate: number; defaultSellRate?: number; offshoreRate?: number; offshoreSellRate?: number }, location: ResourceLocation = 'onshore') {
    const role: Role = {
      id: uid(),
      title: entry.title,
      hourlyRate: location === 'offshore' ? (entry.offshoreRate || entry.defaultRate) : entry.defaultRate,
      sellRate: location === 'offshore' ? (entry.offshoreSellRate || entry.defaultSellRate) : entry.defaultSellRate,
      location,
    };
    update({ roles: [...phase.roles, role] });
    setShowAddRole(false);
  }

  function removeRole(roleId: string) {
    const roles = phase.roles.filter((r) => r.id !== roleId);
    const allocs = { ...phase.allocations };
    delete allocs[roleId];
    update({ roles, allocations: allocs });
  }

  function duplicateRole(roleId: string) {
    const role = phase.roles.find((r) => r.id === roleId);
    if (!role) return;
    const newRole = { ...role, id: uid(), title: `${role.title} (Copy)` };
    const newAllocs = { ...phase.allocations };
    if (phase.allocations[roleId]) {
      newAllocs[newRole.id] = { ...phase.allocations[roleId] };
    }
    update({ roles: [...phase.roles, newRole], allocations: newAllocs });
  }

  function clearRoleAllocations(roleId: string) {
    const allocs = { ...phase.allocations };
    allocs[roleId] = {};
    update({ allocations: allocs });
  }

  function clearMonthAllocations(monthKey: string) {
    const allocs = { ...phase.allocations };
    for (const role of phase.roles) {
      if (allocs[role.id]) {
        allocs[role.id] = { ...allocs[role.id] };
        delete allocs[role.id][monthKey];
      }
    }
    update({ allocations: allocs });
  }

  function fillMonthAllocation(monthKey: string, pct: number) {
    const decimal = pct / 100;
    const allocs = { ...phase.allocations };
    for (const role of phase.roles) {
      if (!allocs[role.id]) allocs[role.id] = {};
      allocs[role.id] = { ...allocs[role.id], [monthKey]: decimal };
    }
    update({ allocations: allocs });
  }

  function handleCellInput(roleId: string, monthKey: string, raw: string) {
    const val = parseFloat(raw);
    if (raw === '' || raw === '-') {
      setAllocation(roleId, monthKey, 0);
    } else if (!isNaN(val)) {
      setAllocation(roleId, monthKey, Math.min(Math.max(val / 100, 0), 1));
    }
  }

  function applyBulk() {
    const val = parseFloat(bulkValue);
    if (isNaN(val) || !bulkRoleId) return;
    const decimal = Math.min(Math.max(val / 100, 0), 1);
    const fromIdx = monthKeys.indexOf(bulkFromMonth);
    const toIdx = monthKeys.indexOf(bulkToMonth);
    if (fromIdx < 0 || toIdx < 0) return;
    const allocs = { ...phase.allocations };
    if (!allocs[bulkRoleId]) allocs[bulkRoleId] = {};
    allocs[bulkRoleId] = { ...allocs[bulkRoleId] };
    for (let i = Math.min(fromIdx, toIdx); i <= Math.max(fromIdx, toIdx); i++) {
      allocs[bulkRoleId][monthKeys[i]] = decimal;
    }
    update({ allocations: allocs });
    setShowBulkApply(false);
    setBulkValue('');
  }

  // Drag-to-fill handlers
  const handleDragStart = useCallback((roleId: string, monthKey: string) => {
    isDragging.current = true;
    setDragSource({ roleId, monthKey });
  }, []);

  const handleDragOver = useCallback((monthKey: string) => {
    if (isDragging.current) setDragTarget(monthKey);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragSource && dragTarget) {
      const sourceValue = (phase.allocations[dragSource.roleId] || {})[dragSource.monthKey] || 0;
      const fromIdx = monthKeys.indexOf(dragSource.monthKey);
      const toIdx = monthKeys.indexOf(dragTarget);
      if (fromIdx >= 0 && toIdx >= 0) {
        const allocs = { ...phase.allocations };
        if (!allocs[dragSource.roleId]) allocs[dragSource.roleId] = {};
        allocs[dragSource.roleId] = { ...allocs[dragSource.roleId] };
        for (let i = Math.min(fromIdx, toIdx); i <= Math.max(fromIdx, toIdx); i++) {
          allocs[dragSource.roleId][monthKeys[i]] = sourceValue;
        }
        update({ allocations: allocs });
      }
    }
    isDragging.current = false;
    setDragSource(null);
    setDragTarget(null);
  }, [dragSource, dragTarget, phase, monthKeys]);

  // Notes
  function openNote(key: string) {
    setEditingNote(key);
    setNoteText(phase.notes[key] || '');
  }
  function saveNote() {
    if (editingNote === null) return;
    const notes = { ...phase.notes };
    if (noteText.trim()) notes[editingNote] = noteText.trim();
    else delete notes[editingNote];
    update({ notes });
    setEditingNote(null);
  }

  // Expenses
  function addExpense() {
    const exp: ExpenseLine = { id: uid(), description: 'New Expense', amount: 0 };
    update({ expenses: [...phase.expenses, exp] });
  }
  function updateExpense(expId: string, updates: Partial<ExpenseLine>) {
    update({
      expenses: phase.expenses.map((e) => (e.id === expId ? { ...e, ...updates } : e)),
    });
  }
  function removeExpense(expId: string) {
    update({ expenses: phase.expenses.filter((e) => e.id !== expId) });
  }

  // Context menu handlers
  function handleRoleContextMenu(e: React.MouseEvent, roleId: string) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, roleId, type: 'role' });
  }

  function handleCellContextMenu(e: React.MouseEvent, roleId: string, monthKey: string) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, roleId, monthKey, type: 'cell' });
  }

  function handleHeaderContextMenu(e: React.MouseEvent, monthKey: string) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, monthKey, type: 'phase' });
  }

  const phaseCost = getPhaseTotalCost(phase);
  const phaseSell = getPhaseTotalSell(phase);
  const phaseExpenses = getPhaseExpensesTotal(phase);

  return (
    <div className="detailed-grid">
      <div className="grid-toolbar">
        <div className="view-toggle">
          <button className={`btn btn-sm ${viewMode === 'pct' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('pct')}>%</button>
          <button className={`btn btn-sm ${viewMode === 'cost' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('cost')}>Cost</button>
          <button className={`btn btn-sm ${viewMode === 'both' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('both')}>Both</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkApply(true)}>Bulk Apply</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowExpenses(!showExpenses)}>
            <DollarSign size={14} /> T&E
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddRole(true)}>
            <Plus size={14} /> Add Role
          </button>
        </div>
      </div>

      {/* Bulk Apply Bar */}
      {showBulkApply && (
        <div className="bulk-apply-bar">
          <select value={bulkRoleId} onChange={(e) => setBulkRoleId(e.target.value)}>
            <option value="">Select role...</option>
            {phase.roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <input type="number" placeholder="%" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={{ width: 60 }} />
          <select value={bulkFromMonth} onChange={(e) => setBulkFromMonth(e.target.value)}>
            <option value="">From...</option>
            {monthKeys.map((mk) => <option key={mk} value={mk}>{formatMonthLabel(mk)}</option>)}
          </select>
          <select value={bulkToMonth} onChange={(e) => setBulkToMonth(e.target.value)}>
            <option value="">To...</option>
            {monthKeys.map((mk) => <option key={mk} value={mk}>{formatMonthLabel(mk)}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={applyBulk}>Apply</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkApply(false)}>Cancel</button>
        </div>
      )}

      {/* Add Role Modal */}
      {showAddRole && (
        <div className="modal-overlay" onClick={() => setShowAddRole(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Role</h2>
            <div className="role-library-pick">
              <h4>From Library</h4>
              <div className="location-toggle-row">
                <button className={`btn btn-sm ${newRoleLocation === 'onshore' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setNewRoleLocation('onshore')}>Onshore</button>
                <button className={`btn btn-sm ${newRoleLocation === 'offshore' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setNewRoleLocation('offshore')}>Offshore</button>
              </div>
              <div className="library-chips">
                {library.map((entry) => {
                  const rate = newRoleLocation === 'offshore' ? (entry.offshoreRate || entry.defaultRate) : entry.defaultRate;
                  return (
                    <button key={entry.id} className="btn btn-ghost btn-sm" onClick={() => addRoleFromLibrary(entry, newRoleLocation)}>
                      {entry.title} (${rate}/hr)
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="divider-text">or custom</div>
            <div className="form-row">
              <div className="form-group">
                <label>Title</label>
                <input value={newRoleTitle} onChange={(e) => setNewRoleTitle(e.target.value)} placeholder="Role title" />
              </div>
              <div className="form-group">
                <label>Sell Rate ($/hr)</label>
                <input type="number" value={newRoleSellRate} onChange={(e) => setNewRoleSellRate(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Cost Rate ($/hr)</label>
                <input type="number" value={newRoleRate} onChange={(e) => setNewRoleRate(Number(e.target.value))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAddRole(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addRole}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Note Editor */}
      {editingNote !== null && (
        <div className="modal-overlay" onClick={() => setEditingNote(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2>Cell Note</h2>
            <div className="form-group">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
                autoFocus
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setEditingNote(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNote}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <div className="context-menu" style={{ top: ctxMenu.y, left: ctxMenu.x }} onClick={(e) => e.stopPropagation()}>
          {ctxMenu.type === 'role' && ctxMenu.roleId && (() => {
            const role = phase.roles.find((r) => r.id === ctxMenu.roleId);
            return (
              <>
                <button onClick={() => { toggleRoleLocation(ctxMenu.roleId!); setCtxMenu(null); }}>
                  Switch to {role?.location === 'onshore' ? 'Offshore' : 'Onshore'}
                </button>
                <button onClick={() => { duplicateRole(ctxMenu.roleId!); setCtxMenu(null); }}>
                  Duplicate Role
                </button>
                <button onClick={() => { clearRoleAllocations(ctxMenu.roleId!); setCtxMenu(null); }}>
                  Clear All Allocations
                </button>
                <div className="ctx-divider" />
                <button className="ctx-danger" onClick={() => { removeRole(ctxMenu.roleId!); setCtxMenu(null); }}>
                  Remove Role
                </button>
              </>
            );
          })()}
          {ctxMenu.type === 'cell' && ctxMenu.roleId && ctxMenu.monthKey && (
            <>
              <button onClick={() => { openNote(`${ctxMenu.roleId}:${ctxMenu.monthKey}`); setCtxMenu(null); }}>
                Add/Edit Note
              </button>
              <button onClick={() => { setAllocation(ctxMenu.roleId!, ctxMenu.monthKey!, 1); setCtxMenu(null); }}>
                Set 100%
              </button>
              <button onClick={() => { setAllocation(ctxMenu.roleId!, ctxMenu.monthKey!, 0.5); setCtxMenu(null); }}>
                Set 50%
              </button>
              <button onClick={() => { setAllocation(ctxMenu.roleId!, ctxMenu.monthKey!, 0.25); setCtxMenu(null); }}>
                Set 25%
              </button>
              <button onClick={() => { setAllocation(ctxMenu.roleId!, ctxMenu.monthKey!, 0); setCtxMenu(null); }}>
                Clear Cell
              </button>
            </>
          )}
          {ctxMenu.type === 'phase' && ctxMenu.monthKey && (
            <>
              <button onClick={() => { fillMonthAllocation(ctxMenu.monthKey!, 100); setCtxMenu(null); }}>
                Fill All 100%
              </button>
              <button onClick={() => { fillMonthAllocation(ctxMenu.monthKey!, 50); setCtxMenu(null); }}>
                Fill All 50%
              </button>
              <button onClick={() => { clearMonthAllocations(ctxMenu.monthKey!); setCtxMenu(null); }}>
                Clear Column
              </button>
            </>
          )}
        </div>
      )}

      {phase.roles.length === 0 ? (
        <div className="empty-state small">
          <p>No roles added yet. Click &quot;Add Role&quot; to start building this phase.</p>
        </div>
      ) : (
        <div className="grid-scroll-wrapper">
          <table className="allocation-table">
            <thead>
              <tr>
                <th className="sticky-col col-role">Role</th>
                <th className="col-loc">Location</th>
                <th className="col-rate">Sell Rate</th>
                {showMargin && <th className="col-rate">Cost Rate</th>}
                {monthKeys.map((mk) => (
                  <th key={mk} className="col-month" onContextMenu={(e) => handleHeaderContextMenu(e, mk)}>{formatMonthLabel(mk)}</th>
                ))}
                <th className="col-total">Total</th>
                <th className="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              {phase.roles.map((role) => {
                const allocs = phase.allocations[role.id] || {};
                return (
                  <tr key={role.id}>
                    <td className="sticky-col col-role" onContextMenu={(e) => handleRoleContextMenu(e, role.id)}>
                      <input className="cell-input cell-text" value={role.title} onChange={(e) => setRoleField(role.id, 'title', e.target.value)} />
                    </td>
                    <td className="col-loc">
                      <button
                        className={`loc-badge loc-${role.location}`}
                        onClick={() => toggleRoleLocation(role.id)}
                        title={`Click to switch to ${role.location === 'onshore' ? 'offshore' : 'onshore'}`}
                      >
                        {role.location === 'onshore' ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td className="col-rate">
                      <input className="cell-input cell-number" type="number" value={role.sellRate || ''} placeholder="-" onChange={(e) => setRoleField(role.id, 'sellRate', Number(e.target.value))} />
                    </td>
                    {showMargin && (
                      <td className="col-rate">
                        <input className="cell-input cell-number" type="number" value={role.hourlyRate} onChange={(e) => setRoleField(role.id, 'hourlyRate', Number(e.target.value))} />
                      </td>
                    )}
                    {monthKeys.map((mk) => {
                      const decimal = allocs[mk] || 0;
                      const pctDisplay = decimal ? Math.round(decimal * 100) : '';
                      const cost = getRoleMonthlyCost(decimal, role.hourlyRate);
                      const noteKey = `${role.id}:${mk}`;
                      const hasNote = !!phase.notes[noteKey];
                      const isInDragRange = dragSource && dragSource.roleId === role.id && dragTarget && (() => {
                        const srcIdx = monthKeys.indexOf(dragSource.monthKey);
                        const tgtIdx = monthKeys.indexOf(dragTarget);
                        const curIdx = monthKeys.indexOf(mk);
                        return curIdx >= Math.min(srcIdx, tgtIdx) && curIdx <= Math.max(srcIdx, tgtIdx);
                      })();
                      return (
                        <td key={mk} className={`col-month ${isInDragRange ? 'cell-selected' : ''}`}
                          onMouseEnter={() => handleDragOver(mk)}
                          onMouseUp={handleDragEnd}
                          onContextMenu={(e) => handleCellContextMenu(e, role.id, mk)}
                        >
                          <div style={{ position: 'relative' }}>
                            {hasNote && <div className="cell-note-indicator" title={phase.notes[noteKey]} />}
                            {(viewMode === 'pct' || viewMode === 'both') && (
                              <span className="pct-input-wrapper">
                                <input
                                  className="cell-input cell-number cell-pct"
                                  type="number"
                                  step="5"
                                  min="0"
                                  max="100"
                                  value={pctDisplay}
                                  placeholder="-"
                                  onChange={(e) => handleCellInput(role.id, mk, e.target.value)}
                                />
                                <span className="pct-suffix">%</span>
                              </span>
                            )}
                            {viewMode === 'cost' && (
                              <span className="pct-input-wrapper">
                                <input
                                  className="cell-input cell-number cell-pct"
                                  type="number"
                                  step="5"
                                  min="0"
                                  max="100"
                                  value={pctDisplay}
                                  placeholder="-"
                                  onChange={(e) => handleCellInput(role.id, mk, e.target.value)}
                                />
                                <span className="pct-suffix">%</span>
                              </span>
                            )}
                            {(viewMode === 'cost' || viewMode === 'both') && role.sellRate && (
                              <span className="sell-label">{formatCurrency(getRoleMonthlySell(decimal, role.sellRate))}</span>
                            )}
                            {showMargin && (viewMode === 'cost' || viewMode === 'both') && (
                              <span className="cost-label">{formatCurrency(cost)}</span>
                            )}
                            <div className="drag-handle" onMouseDown={() => handleDragStart(role.id, mk)} />
                          </div>
                        </td>
                      );
                    })}
                    <td className="col-total">
                      <div className="total-cell">
                        <span className="fte-total">{formatPercent(getPhaseRoleTotalAllocation(role.id, phase) / phase.monthCount)} avg</span>
                        <span className="sell-total">{formatCurrency(getPhaseRoleTotalSell(role.id, phase))}</span>
                        {showMargin && <span className="cost-total">{formatCurrency(getPhaseRoleTotalCost(role.id, phase))}</span>}
                      </div>
                    </td>
                    <td className="col-actions">
                      <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => removeRole(role.id)} title="Remove role">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="totals-row">
                <td className="sticky-col col-role"><strong>Totals</strong></td>
                <td className="col-loc"></td>
                <td className="col-rate"></td>
                {showMargin && <td className="col-rate"></td>}
                {monthKeys.map((mk) => (
                  <td key={mk} className="col-month">
                    <strong>{formatPercent(getPhaseMonthTotalAllocation(phase, mk))}</strong>
                    {(viewMode === 'cost' || viewMode === 'both') && (
                      <div className="sell-label"><strong>{formatCurrency(getPhaseMonthTotalSell(phase, mk))}</strong></div>
                    )}
                    {showMargin && (viewMode === 'cost' || viewMode === 'both') && (
                      <div className="cost-label"><strong>{formatCurrency(getPhaseMonthTotalCost(phase, mk))}</strong></div>
                    )}
                  </td>
                ))}
                <td className="col-total">
                  <div className="total-cell grand-total">
                    <strong>{formatCurrency(phaseSell)}</strong>
                    {showMargin && <strong className="cost-total">{formatCurrency(phaseCost)}</strong>}
                  </div>
                </td>
                <td className="col-actions"></td>
              </tr>
              {showMargin && (
                <tr className="margin-row">
                  <td className="sticky-col col-role"><strong>Margin</strong></td>
                  <td className="col-loc"></td>
                  <td className="col-rate"></td>
                  <td className="col-rate"></td>
                  {monthKeys.map((mk) => {
                    const mc = getPhaseMonthTotalCost(phase, mk);
                    const ms = getPhaseMonthTotalSell(phase, mk);
                    const margin = ms > 0 ? (ms - mc) / ms : 0;
                    return <td key={mk} className="col-month"><span className="margin-value">{formatPercent(margin)}</span></td>;
                  })}
                  <td className="col-total">
                    <span className="margin-value">{phaseSell > 0 ? formatPercent((phaseSell - phaseCost) / phaseSell) : '-'}</span>
                  </td>
                  <td className="col-actions"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Expenses Section */}
      {showExpenses && (
        <div className="expenses-section">
          <h4>Travel & Expenses</h4>
          {phase.expenses.map((exp) => (
            <div key={exp.id} className="expense-row">
              <input className="cell-input cell-text" value={exp.description} onChange={(e) => updateExpense(exp.id, { description: e.target.value })} placeholder="Description" />
              <input className="cell-input cell-number" type="number" value={exp.amount} onChange={(e) => updateExpense(exp.id, { amount: Number(e.target.value) })} style={{ width: 120 }} />
              <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => removeExpense(exp.id)}><Trash2 size={14} /></button>
            </div>
          ))}
          <div className="expense-row">
            <button className="btn btn-ghost btn-sm" onClick={addExpense}><Plus size={14} /> Add Expense</button>
            <span className="expense-total">T&E Total: {formatCurrency(phaseExpenses)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
