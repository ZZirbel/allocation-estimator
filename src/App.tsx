import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import EstimateEditor from './components/EstimateEditor';
import SummaryDashboard from './components/SummaryDashboard';
import Settings from './components/Settings';
import { loadSettings } from './lib/store';
import './styles.css';

export default function App() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings()
      .then((s) => setNeedsSetup(s.needsSetup))
      .catch(() => setNeedsSetup(false)); // If server unavailable, skip setup
  }, []);

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
    </Routes>
  );
}
