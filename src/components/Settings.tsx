import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Save, RotateCcw, CheckCircle, AlertCircle, Info, Rocket, ChevronDown, ChevronUp } from 'lucide-react';
import type { AppSettings } from '../lib/store';
import { loadSettings, saveSettings } from '../lib/store';

interface Props {
  /** When true, renders as a first-run setup wizard instead of a settings page */
  setupMode?: boolean;
  onSetupComplete?: () => void;
}

function SharePointGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="setup-guide">
      <button className="setup-guide-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        How to set up shared team access via SharePoint
      </button>
      {expanded && (
        <div className="setup-guide-content">
          <div className="setup-step">
            <span className="setup-step-num">1</span>
            <div>
              <strong>Create a SharePoint folder</strong>
              <p>
                Go to your team's SharePoint site and create a folder called
                "Allocation Estimator" (or any name) in the Documents library.
              </p>
            </div>
          </div>
          <div className="setup-step">
            <span className="setup-step-num">2</span>
            <div>
              <strong>Sync the folder to your machine</strong>
              <p>
                In SharePoint, click <strong>Sync</strong> on the document library.
                OneDrive will create a local folder on your computer, typically at:
              </p>
              <code className="settings-code-block">
                C:\Users\YourName\YourOrg\SiteName - Documents\Allocation Estimator
              </code>
              <p className="setup-step-note">
                The exact path depends on your organization. Open File Explorer and look
                under your user folder for a folder with your org name.
              </p>
            </div>
          </div>
          <div className="setup-step">
            <span className="setup-step-num">3</span>
            <div>
              <strong>Paste the local path below</strong>
              <p>
                Copy the full path from File Explorer's address bar and paste it into
                the Data Directory field. The app reads and writes files to this folder.
              </p>
            </div>
          </div>
          <div className="setup-step">
            <span className="setup-step-num">4</span>
            <div>
              <strong>Each team member repeats steps 2-3</strong>
              <p>
                Everyone syncs the same SharePoint folder and pastes their own local path.
                The paths will differ (different usernames), but they all point to the same
                SharePoint location. OneDrive handles sync and authentication automatically.
              </p>
            </div>
          </div>
          <div className="setup-note">
            <Info size={13} />
            <span>
              <strong>No extra login required.</strong> Since the app runs locally and reads
              files from the synced folder, OneDrive (already signed in on your device) handles
              all authentication and sync in the background. Estimates are stored as individual
              files, so multiple people can work on different estimates simultaneously.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings({ setupMode, onSetupComplete }: Props) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [dataDir, setDataDir] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings()
      .then((s) => {
        setSettings(s);
        setDataDir(s.dataDir);
      })
      .catch(() => setError('Could not load settings. Is the server running?'));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await saveSettings(dataDir);
      if (result.ok) {
        if (setupMode && onSetupComplete) {
          onSetupComplete();
        } else {
          setMessage({ type: 'success', text: 'Data directory updated. New data will be stored at this location.' });
          setSettings((prev) => prev ? { ...prev, dataDir, dataDirExists: true, needsSetup: false } : prev);
        }
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save settings.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not reach server.' });
    }
    setSaving(false);
  }

  function handleUseDefault() {
    if (settings) {
      setDataDir(settings.defaultDataDir);
    }
  }

  if (error) {
    return (
      <div className="settings-page">
        <div className="settings-card">
          <div className="settings-message error"><AlertCircle size={16} /> {error}</div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="settings-page">
        <div className="settings-card">
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Setup Wizard Mode ─────────────────────────────────────────
  if (setupMode) {
    return (
      <div className="settings-page">
        <div className="settings-card setup-card">
          <div className="setup-icon"><Rocket size={36} /></div>
          <h2>Welcome to Allocation Estimator</h2>
          <p className="settings-desc">
            Choose where to store your data. For shared team access, point to a synced SharePoint
            folder. For personal use, the default local folder works fine.
          </p>

          <SharePointGuide />

          <div className="settings-field">
            <label>Data Directory</label>
            <div className="settings-input-row">
              <input
                type="text"
                value={dataDir}
                onChange={(e) => setDataDir(e.target.value)}
                placeholder="Paste a folder path from File Explorer..."
                spellCheck={false}
                autoFocus
              />
            </div>
            <span className="settings-hint">
              Paste the full local path to your synced SharePoint folder, or use the local default.
            </span>
          </div>

          {message && (
            <div className={`settings-message ${message.type}`}>
              {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          <div className="setup-actions">
            <button className="btn btn-ghost" onClick={handleUseDefault}>
              Use Local Default
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dataDir.trim()}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal Settings Page ──────────────────────────────────────
  const isDirty = dataDir !== settings.dataDir;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Back
        </button>
        <h1>Settings</h1>
      </header>

      <div className="settings-card">
        <h2><FolderOpen size={18} /> Data Storage</h2>
        <p className="settings-desc">
          Configure where estimate data is stored. Point this to a shared synced SharePoint
          folder so your team can all access the same estimates, role library, and rate cards.
        </p>

        <SharePointGuide />

        <div className="settings-field">
          <label>Data Directory</label>
          <div className="settings-input-row">
            <input
              type="text"
              value={dataDir}
              onChange={(e) => setDataDir(e.target.value)}
              placeholder="Path to data folder..."
              spellCheck={false}
            />
            <button
              className="btn btn-ghost btn-sm"
              title="Reset to local default"
              onClick={handleUseDefault}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <span className="settings-hint">
            Local default: <code>{settings.defaultDataDir}</code>
          </span>
        </div>

        {message && (
          <div className={`settings-message ${message.type}`}>
            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {message.text}
          </div>
        )}

        <div className="settings-actions">
          <button className="btn btn-ghost" onClick={() => navigate('/')}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="settings-card settings-card-secondary">
        <h3>Current Configuration</h3>
        <div className="settings-detail">
          <span className="settings-detail-label">Config location</span>
          <code>{settings.configDir}</code>
        </div>
        <div className="settings-detail">
          <span className="settings-detail-label">Data location</span>
          <code>{settings.dataDir}</code>
          {settings.dataDirExists
            ? <span className="settings-badge-ok"><CheckCircle size={12} /> exists</span>
            : <span className="settings-badge-warn"><AlertCircle size={12} /> will be created</span>
          }
        </div>
        <div className="settings-detail">
          <span className="settings-detail-label">Storage format</span>
          <span>Per-estimate JSON files + shared role library, rate cards, templates</span>
        </div>
      </div>
    </div>
  );
}
