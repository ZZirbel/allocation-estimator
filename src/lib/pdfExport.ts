import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Estimate } from '../types';
import {
  getMonthKeys,
  formatMonthLabel,
  getPhaseRoleTotalSell,
  getPhaseTotalSell,
  getPhaseExpensesTotal,
  getEstimateTotalCost,
  getEstimateTotalSell,
  getEstimateMargin,
  formatCurrency,
  formatPercent,
} from './calculations';

export function exportEstimateToPdf(estimate: Estimate) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(estimate.name, 14, 20);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(estimate.client, 14, 28);

  // Summary box
  const totalCost = getEstimateTotalCost(estimate);
  const totalSell = getEstimateTotalSell(estimate);
  const margin = getEstimateMargin(estimate);

  doc.setFontSize(10);
  doc.setTextColor(60);
  const summaryY = 36;
  doc.text(`Status: ${estimate.status.replace('_', ' ').toUpperCase()}`, 14, summaryY);
  doc.text(`Total: ${formatCurrency(totalSell)}`, 80, summaryY);
  if (estimate.showMargin && totalCost > 0) {
    doc.text(`Cost: ${formatCurrency(totalCost)}`, 160, summaryY);
    doc.text(`Margin: ${formatPercent(margin)}`, 230, summaryY);
  }
  doc.text(`Phases: ${estimate.phases.length}`, pageWidth - 40, summaryY);

  let yPos = summaryY + 10;

  // Phase tables
  for (const phase of estimate.phases) {
    const monthKeys = getMonthKeys(phase.startMonth, phase.monthCount);
    const phaseSell = getPhaseTotalSell(phase);
    const phaseExpenses = getPhaseExpensesTotal(phase);

    // Phase header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(`${phase.name}  —  ${formatCurrency(phaseSell + phaseExpenses)}`, 14, yPos);
    yPos += 6;

    // Allocation table
    const headers = ['Role', 'Rate', ...monthKeys.map(formatMonthLabel), 'Total'];
    const rows = phase.roles.map((role) => {
      const allocs = phase.allocations[role.id] || {};
      const cells = [
        role.title,
        `$${role.sellRate || role.hourlyRate}`,
        ...monthKeys.map((mk) => {
          const d = allocs[mk] || 0;
          return d ? `${Math.round(d * 100)}%` : '-';
        }),
        formatCurrency(getPhaseRoleTotalSell(role.id, phase)),
      ];
      return cells;
    });

    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 16, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos + 40;
    yPos += 8;

    // Expenses
    if (phase.expenses.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Expense', 'Amount']],
        body: [
          ...phase.expenses.map((e) => [e.description, formatCurrency(e.amount)]),
          ['Total T&E', formatCurrency(phaseExpenses)],
        ],
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 116, 139] },
        margin: { left: 14, right: pageWidth - 120 },
      });
      yPos = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos + 20;
      yPos += 8;
    }

    // Page break if needed
    if (yPos > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      yPos = 20;
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.getHeight() - 10);

  doc.save(`${estimate.name} - ${estimate.client}.pdf`);
}
