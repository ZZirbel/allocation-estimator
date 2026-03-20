import type { Estimate, EstimatePhase } from '../types';

const HOURS_PER_MONTH = 160;

export function getMonthKeys(startMonth: string, count: number): string[] {
  const [y, m] = startMonth.split('-').map(Number);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(y, m - 1 + i, 1);
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    keys.push(ym);
  }
  return keys;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function getRoleMonthlyCost(allocationDecimal: number, hourlyRate: number): number {
  return allocationDecimal * hourlyRate * HOURS_PER_MONTH;
}

export function getRoleMonthlySell(allocationDecimal: number, sellRate: number): number {
  return allocationDecimal * sellRate * HOURS_PER_MONTH;
}

export function getPhaseRoleTotalCost(roleId: string, phase: EstimatePhase): number {
  const role = phase.roles.find((r) => r.id === roleId);
  if (!role) return 0;
  const allocs = phase.allocations[roleId] || {};
  const months = getMonthKeys(phase.startMonth, phase.monthCount);
  return months.reduce((sum, mk) => sum + getRoleMonthlyCost(allocs[mk] || 0, role.hourlyRate), 0);
}

export function getPhaseRoleTotalSell(roleId: string, phase: EstimatePhase): number {
  const role = phase.roles.find((r) => r.id === roleId);
  if (!role || !role.sellRate) return 0;
  const allocs = phase.allocations[roleId] || {};
  const months = getMonthKeys(phase.startMonth, phase.monthCount);
  return months.reduce((sum, mk) => sum + getRoleMonthlySell(allocs[mk] || 0, role.sellRate!), 0);
}

export function getPhaseRoleTotalAllocation(roleId: string, phase: EstimatePhase): number {
  const allocs = phase.allocations[roleId] || {};
  const months = getMonthKeys(phase.startMonth, phase.monthCount);
  return months.reduce((sum, mk) => sum + (allocs[mk] || 0), 0);
}

export function getPhaseMonthTotalAllocation(phase: EstimatePhase, monthKey: string): number {
  return phase.roles.reduce((sum, role) => {
    return sum + ((phase.allocations[role.id] || {})[monthKey] || 0);
  }, 0);
}

export function getPhaseMonthTotalCost(phase: EstimatePhase, monthKey: string): number {
  return phase.roles.reduce((sum, role) => {
    const alloc = (phase.allocations[role.id] || {})[monthKey] || 0;
    return sum + getRoleMonthlyCost(alloc, role.hourlyRate);
  }, 0);
}

export function getPhaseMonthTotalSell(phase: EstimatePhase, monthKey: string): number {
  return phase.roles.reduce((sum, role) => {
    const alloc = (phase.allocations[role.id] || {})[monthKey] || 0;
    return sum + getRoleMonthlySell(alloc, role.sellRate || 0);
  }, 0);
}

export function getPhaseTotalCost(phase: EstimatePhase): number {
  const months = getMonthKeys(phase.startMonth, phase.monthCount);
  return months.reduce((sum, mk) => sum + getPhaseMonthTotalCost(phase, mk), 0);
}

export function getPhaseTotalSell(phase: EstimatePhase): number {
  const months = getMonthKeys(phase.startMonth, phase.monthCount);
  return months.reduce((sum, mk) => sum + getPhaseMonthTotalSell(phase, mk), 0);
}

export function getPhaseExpensesTotal(phase: EstimatePhase): number {
  return phase.expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function getEstimateTotalCost(estimate: Estimate): number {
  return estimate.phases.reduce(
    (sum, phase) => sum + getPhaseTotalCost(phase) + getPhaseExpensesTotal(phase),
    0
  );
}

export function getEstimateTotalSell(estimate: Estimate): number {
  return estimate.phases.reduce(
    (sum, phase) => sum + getPhaseTotalSell(phase) + getPhaseExpensesTotal(phase),
    0
  );
}

export function getEstimateMargin(estimate: Estimate): number {
  const sell = getEstimateTotalSell(estimate);
  if (sell === 0) return 0;
  const cost = getEstimateTotalCost(estimate);
  return (sell - cost) / sell;
}

export function formatCurrency(n: number): string {
  if (n === 0) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(decimal: number): string {
  return `${Math.round(decimal * 100)}%`;
}
