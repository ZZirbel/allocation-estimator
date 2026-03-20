import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Estimate } from '../types';
import { loadEstimates } from '../lib/store';
import {
  getEstimateTotalCost,
  getEstimateTotalSell,
  getEstimateMargin,
  getMonthKeys,
  getPhaseMonthTotalAllocation,
  formatCurrency,
  formatPercent,
} from '../lib/calculations';

export default function SummaryDashboard() {
  const navigate = useNavigate();
  const [estimates] = useState<Estimate[]>(loadEstimates);

  const baseEstimates = useMemo(() => estimates.filter((e) => !e.parentId), [estimates]);

  const stats = useMemo(() => {
    const active = baseEstimates.filter((e) => !['won', 'lost'].includes(e.status));
    const won = baseEstimates.filter((e) => e.status === 'won');
    const totalPipeline = active.reduce((s, e) => s + getEstimateTotalCost(e), 0);
    const totalWon = won.reduce((s, e) => s + getEstimateTotalCost(e), 0);
    return { total: baseEstimates.length, active: active.length, won: won.length, totalPipeline, totalWon };
  }, [baseEstimates]);

  // Capacity by month (aggregate FTE across all active estimates)
  const capacityByMonth = useMemo(() => {
    const monthMap: Record<string, number> = {};
    baseEstimates
      .filter((e) => !['lost'].includes(e.status))
      .forEach((est) => {
        est.phases.forEach((phase) => {
          const keys = getMonthKeys(phase.startMonth, phase.monthCount);
          keys.forEach((mk) => {
            monthMap[mk] = (monthMap[mk] || 0) + getPhaseMonthTotalAllocation(phase, mk);
          });
        });
      });
    const entries = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b));
    const maxFTE = Math.max(...entries.map(([, v]) => v), 1);
    return { entries, maxFTE };
  }, [baseEstimates]);

  return (
    <div className="summary-dashboard">
      <div className="summary-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back
          </button>
          <h1>Pipeline Summary</h1>
        </div>
      </div>

      <div className="summary-cards">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Estimates</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.active}</div>
          <div className="stat-label">Active Pipeline</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.won}</div>
          <div className="stat-label">Won</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#3b82f6' }}>{formatCurrency(stats.totalPipeline)}</div>
          <div className="stat-label">Pipeline Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#10b981' }}>{formatCurrency(stats.totalWon)}</div>
          <div className="stat-label">Won Revenue</div>
        </div>
      </div>

      <h2 style={{ marginBottom: 16 }}>All Estimates</h2>
      <table className="pipeline-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Client</th>
            <th>Status</th>
            <th>Phases</th>
            <th>Cost</th>
            <th>Sell</th>
            <th>Margin</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {baseEstimates.map((est) => {
            const cost = getEstimateTotalCost(est);
            const sell = getEstimateTotalSell(est);
            const margin = getEstimateMargin(est);
            return (
              <tr key={est.id} onClick={() => navigate(`/estimate/${est.id}`)} style={{ cursor: 'pointer' }}>
                <td><strong>{est.name}</strong></td>
                <td>{est.client}</td>
                <td><span className={`badge badge-${est.status}`}>{est.status.replace('_', ' ')}</span></td>
                <td>{est.phases.length}</td>
                <td>{formatCurrency(cost)}</td>
                <td>{sell > 0 ? formatCurrency(sell) : '-'}</td>
                <td>{sell > 0 ? formatPercent(margin) : '-'}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{new Date(est.updatedAt).toLocaleDateString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {capacityByMonth.entries.length > 0 && (
        <>
          <h2 style={{ marginBottom: 16, marginTop: 32 }}>Resource Demand by Month (FTE)</h2>
          <div className="capacity-chart">
            {capacityByMonth.entries.slice(0, 18).map(([mk, fte]) => (
              <div key={mk} className="bar-row">
                <div className="bar-label">{mk}</div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(fte / capacityByMonth.maxFTE) * 100}%` }} />
                </div>
                <div className="bar-value">{fte.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
