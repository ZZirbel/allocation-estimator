import * as XLSX from 'xlsx';
import type { Estimate } from '../types';
import {
  getMonthKeys,
  formatMonthLabel,
  getRoleMonthlySell,
  getRoleMonthlyCost,
  getPhaseExpensesTotal,
} from './calculations';

export function exportEstimateToXlsx(estimate: Estimate) {
  const wb = XLSX.utils.book_new();

  for (const phase of estimate.phases) {
    const monthKeys = getMonthKeys(phase.startMonth, phase.monthCount);
    const headers = ['Name', 'Sell Rate', ...monthKeys.map(formatMonthLabel), 'TOTAL'];
    const rows: (string | number)[][] = [headers];

    // Allocation rows (percentages)
    for (const role of phase.roles) {
      const allocs = phase.allocations[role.id] || {};
      const row: (string | number)[] = [role.title, role.sellRate || role.hourlyRate];
      let total = 0;
      for (const mk of monthKeys) {
        const v = allocs[mk] || 0;
        row.push(v ? Math.round(v * 100) + '%' : '-');
        total += v;
      }
      row.push(total.toFixed(2));
      rows.push(row);
    }

    rows.push([]);
    rows.push(['SELL AMOUNTS', '', ...monthKeys.map(formatMonthLabel), 'TOTAL']);

    // Sell rows
    for (const role of phase.roles) {
      const allocs = phase.allocations[role.id] || {};
      const row: (string | number)[] = [role.title, role.sellRate || role.hourlyRate];
      let total = 0;
      for (const mk of monthKeys) {
        const sell = getRoleMonthlySell(allocs[mk] || 0, role.sellRate || role.hourlyRate);
        row.push(sell);
        total += sell;
      }
      row.push(total);
      rows.push(row);
    }

    // Sell totals
    const sellTotals: (string | number)[] = ['TOTAL', ''];
    let sellGrand = 0;
    for (const mk of monthKeys) {
      const t = phase.roles.reduce((s, r) => {
        const alloc = (phase.allocations[r.id] || {})[mk] || 0;
        return s + getRoleMonthlySell(alloc, r.sellRate || r.hourlyRate);
      }, 0);
      sellTotals.push(t);
      sellGrand += t;
    }
    sellTotals.push(sellGrand);
    rows.push(sellTotals);

    rows.push([]);
    rows.push(['COST AMOUNTS', 'Cost Rate', ...monthKeys.map(formatMonthLabel), 'TOTAL']);

    // Cost rows
    for (const role of phase.roles) {
      const allocs = phase.allocations[role.id] || {};
      const row: (string | number)[] = [role.title, role.hourlyRate];
      let total = 0;
      for (const mk of monthKeys) {
        const cost = getRoleMonthlyCost(allocs[mk] || 0, role.hourlyRate);
        row.push(cost);
        total += cost;
      }
      row.push(total);
      rows.push(row);
    }

    // Cost totals
    const costTotals: (string | number)[] = ['TOTAL', ''];
    let costGrand = 0;
    for (const mk of monthKeys) {
      const t = phase.roles.reduce((s, r) => {
        const alloc = (phase.allocations[r.id] || {})[mk] || 0;
        return s + getRoleMonthlyCost(alloc, r.hourlyRate);
      }, 0);
      costTotals.push(t);
      costGrand += t;
    }
    costTotals.push(costGrand);
    rows.push(costTotals);

    // Expenses
    if (phase.expenses.length > 0) {
      rows.push([]);
      rows.push(['Travel & Expenses']);
      for (const exp of phase.expenses) {
        rows.push([exp.description, exp.amount]);
      }
      rows.push(['T&E Total', getPhaseExpensesTotal(phase)]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const sheetName = phase.name.slice(0, 31); // Excel sheet name max 31 chars
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const filename = `${estimate.name || 'Estimate'} - ${estimate.client || 'Client'}.xlsx`;
  XLSX.writeFile(wb, filename);
}
