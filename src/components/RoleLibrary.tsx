import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import type { RoleLibraryEntry } from '../types';
import { loadRoleLibrary, saveRoleLibrary } from '../lib/store';
import { uid } from '../lib/ids';

interface Props {
  onClose: () => void;
}

export default function RoleLibrary({ onClose }: Props) {
  const [roles, setRoles] = useState<RoleLibraryEntry[]>(loadRoleLibrary);

  function addRole() {
    setRoles([...roles, { id: uid(), title: 'New Role', defaultRate: 200, defaultSellRate: 260, offshoreRate: 100, offshoreSellRate: 130 }]);
  }

  function removeRole(id: string) {
    setRoles(roles.filter((r) => r.id !== id));
  }

  function updateRole(id: string, updates: Partial<RoleLibraryEntry>) {
    setRoles(roles.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }

  function handleSave() {
    saveRoleLibrary(roles);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>Role Library</h2>
        <p className="modal-desc">
          Manage default roles and rates. These appear when adding roles to estimates.
        </p>
        <table className="simple-table">
          <thead>
            <tr>
              <th>Role Title</th>
              <th>Onshore Cost</th>
              <th>Onshore Sell</th>
              <th>Offshore Cost</th>
              <th>Offshore Sell</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>
                  <input className="cell-input cell-text" value={role.title} onChange={(e) => updateRole(role.id, { title: e.target.value })} />
                </td>
                <td>
                  <input className="cell-input cell-number" type="number" value={role.defaultRate} onChange={(e) => updateRole(role.id, { defaultRate: Number(e.target.value) })} />
                </td>
                <td>
                  <input className="cell-input cell-number" type="number" value={role.defaultSellRate || ''} placeholder="-" onChange={(e) => updateRole(role.id, { defaultSellRate: Number(e.target.value) })} />
                </td>
                <td>
                  <input className="cell-input cell-number" type="number" value={role.offshoreRate || ''} placeholder="-" onChange={(e) => updateRole(role.id, { offshoreRate: Number(e.target.value) })} />
                </td>
                <td>
                  <input className="cell-input cell-number" type="number" value={role.offshoreSellRate || ''} placeholder="-" onChange={(e) => updateRole(role.id, { offshoreSellRate: Number(e.target.value) })} />
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm btn-danger-text" onClick={() => removeRole(role.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-ghost btn-sm" onClick={addRole} style={{ marginTop: 8 }}>
          <Plus size={14} /> Add Role
        </button>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Save</button>
        </div>
      </div>
    </div>
  );
}
