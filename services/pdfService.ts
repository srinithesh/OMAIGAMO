

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProcessedVehicleData, ReportSections } from '../types';

export const generateReport = (data: ProcessedVehicleData[], sections: ReportSections, summaries: Record<string, string>) => {
  const doc = new jsPDF();
  const totalScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / data.length;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text("AI Vehicle Compliance Report", 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
  doc.text(`Overall Compliance Score: ${totalScore.toFixed(2)} / 100`, 105, 36, { align: 'center' });

  let currentY = 50;

  // Compliance Details Table
  if (sections.includeComplianceDetails) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Unified Compliance Details", 14, currentY);
    autoTable(doc, {
      startY: currentY + 5,
      head: [['Plate', 'Vehicle', 'Helmet', 'Fine (₹)', 'Insurance', 'PUC', 'Tax', 'Fueling']],
      body: data.map(v => [
        v.plate,
        v.vehicleType,
        v.helmet === null ? 'N/A' : (v.helmet ? 'Yes' : 'No'),
        v.rto.pendingFine,
        v.compliance.insuranceStatus,
        v.compliance.pucStatus,
        v.compliance.taxStatus,
        v.fueling.discrepancyFlag,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [9, 98, 76] }, // #09624C (Bangladesh Green)
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }
  

  // Fueling Discrepancy Analysis Table
  const discrepancyData = data.filter(v => v.fueling.discrepancyFlag !== 'OK');
  if (sections.includeFuelingDiscrepancies && discrepancyData.length > 0) {
    if (currentY > 250) { // Check for page break
        doc.addPage();
        currentY = 20;
    }
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Fueling Discrepancy Analysis", 14, currentY);
    autoTable(doc, {
        startY: currentY + 5,
        head: [['Plate', 'Billed (L)', 'Detected (L)', 'Difference (L)', 'Flag']],
        body: discrepancyData.map(v => [
            v.plate,
            v.fueling.billed.toFixed(2),
            v.fueling.detected.toFixed(2),
            v.fueling.difference.toFixed(2),
            v.fueling.discrepancyFlag,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [9, 98, 76] }, // #09624C (Bangladesh Green)
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Micro Balance Recovery section
  const balances: Record<string, { total: number; count: number; lastSeen: string }> = {};
  data.forEach(v => {
      if (v.fueling.microBalance > 0.001) { // Ignore tiny floating point errors
          if (!balances[v.plate]) {
              balances[v.plate] = { total: 0, count: 0, lastSeen: '1970-01-01T00:00:00.000Z' };
          }
          balances[v.plate].total += v.fueling.microBalance;
          balances[v.plate].count += 1;
          if (new Date(v.timestamp) > new Date(balances[v.plate].lastSeen)) {
              balances[v.plate].lastSeen = v.timestamp;
          }
      }
  });

  const aggregatedBalances = Object.entries(balances)
      .map(([plate, info]) => ({ plate, ...info }))
      .filter(item => item.total > 0.01)
      .sort((a, b) => b.total - a.total);

  if (aggregatedBalances.length > 0) {
      if (currentY > 240) { // Check for page break
          doc.addPage();
          currentY = 20;
      }
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text("Micro Balance Recovery", 14, currentY);
      autoTable(doc, {
          startY: currentY + 5,
          head: [['Plate', 'Pending Amount (₹)', '# Transactions', 'Last Seen']],
          body: aggregatedBalances.map(item => [
              item.plate,
              `₹${item.total.toFixed(2)}`,
              item.count.toString(),
              new Date(item.lastSeen).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
              })
          ]),
          theme: 'grid',
          headStyles: { fillColor: [9, 98, 76] },
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Detailed Vehicle Insights Section
  if (sections.includeDetailedInsights && data.length > 0) {
    // Start on a new page if there isn't much space left
    if (currentY > 150) {
        doc.addPage();
        currentY = 20;
    } else if (currentY > 20) {
        currentY += 10;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("Detailed Vehicle Insights", 14, currentY);
    currentY += 10;

    data.forEach(v => {
        const detailHeight = 55 + (summaries[v.plate] ? (doc.splitTextToSize(summaries[v.plate], 180).length * 4) : 0);
        if (currentY + detailHeight > 280) { // Check for page break before each vehicle
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Vehicle: ${v.plate}`, 14, currentY);
        currentY += 8;

        autoTable(doc, {
            startY: currentY,
            body: [
                ['Owner', v.rto.owner],
                ['Registration', `${v.compliance.registrationStatus} (til ${v.rto.registrationValidTill})`],
                ['PUC', `${v.compliance.pucStatus} (til ${v.rto.pollutionValidTill})`],
                ['Insurance', v.compliance.insuranceStatus],
                ['Road Tax', v.compliance.taxStatus],
                ['Pending Fine', v.rto.pendingFine > 0 ? `₹${v.rto.pendingFine} (${v.rto.fineReason})` : 'None'],
                ['Micro Balance (this tx)', v.fueling.microBalance > 0.01 ? `₹${v.fueling.microBalance.toFixed(2)}` : 'None'],
            ],
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 1 },
            columnStyles: { 0: { fontStyle: 'bold' } },
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;

        if (summaries[v.plate]) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('AI Summary:', 14, currentY);
            currentY += 6;
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const splitSummary = doc.splitTextToSize(summaries[v.plate], 180);
            doc.text(splitSummary, 14, currentY);
            currentY += splitSummary.length * 4 + 5;
        }

        currentY += 5;
    });
  }

  doc.save(`compliance-report-${new Date().toISOString().split('T')[0]}.pdf`);
};