import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import EstimateEditor from './components/EstimateEditor';
import SummaryDashboard from './components/SummaryDashboard';
import './styles.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/estimate/:id" element={<EstimateEditor />} />
      <Route path="/summary" element={<SummaryDashboard />} />
    </Routes>
  );
}
