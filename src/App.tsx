import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import EstimateEditor from './components/EstimateEditor';
import SummaryDashboard from './components/SummaryDashboard';
import Settings from './components/Settings';
import UserGuide from './components/UserGuide';
import { loadSettings, hydrateFromServer } from './lib/store';
import './styles.css';

export default function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const lastFocusCheck = useRef<number>(0);

  // Re-fetch data from server when window gains focus (to pick up team changes)
  const handleFocus = useCallback(async () => {
    // Debounce: only check once per 30 seconds
    const now = Date.now();
    if (now - lastFocusCheck.current < 30000) return;
    lastFocusCheck.current = now;

    try {
      await hydrateFromServer(true);
      // Force re-render by dispatching storage event (components can listen to this)
      window.dispatchEvent(new Event('storage'));
    } catch {
      // Ignore errors - user may be offline
    }
  }, []);

  useEffect(() => {
    loadSettings()
      .then((s) => setNeedsSetup(s.needsSetup))
      .catch(() => setNeedsSetup(false)); // If server unavailable, skip setup

    // Listen for window focus events
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [handleFocus]);

  // Still checking — show nothing (brief flash)
  if (needsSetup === null) return null;

  // First-run: show setup wizard
  if (needsSetup) {
    return <Settings setupMode onSetupComplete={() => setNeedsSetup(false)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/estimate/:id" element={<EstimateEditor />} />
      <Route path="/summary" element={<SummaryDashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/guide" element={<UserGuide />} />
    </Routes>
  );
}
