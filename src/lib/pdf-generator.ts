export interface JobReportData {
  reportNumber: string;
  jobNumber: string;
  generatedAt: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    postcode: string;
  };
  locksmith: {
    name: string;
    company: string;
    license: string;
    phone: string;
    rating: number;
  };
  job: {
    problemType: string;
    propertyType: string;
    description: string;
  };
  timeline: {
    time: string;
    event: string;
    gps?: { lat: number; lng: number; accuracy?: number } | null;
  }[];
  quote: {
    diagnostic: string;
    lockType: string;
    parts: { name: string; qty: number; price: number }[];
    labour: number;
    partsTotal: number;
    subtotal: number;
    vat: number;
    total: number;
  };
  signature: {
    name: string;
    timestamp: string;
    ip: string;
    confirms: string[];
    data?: string; // Base64 signature image
  };
}

export async function generateJobReportPDF(data: JobReportData) {
  // Dynamic import to avoid SSR issues
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Helper functions
  const drawLine = (startY: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, startY, pageWidth - margin, startY);
  };

  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > pageHeight - 20) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ========= HEADER =========
  // Orange header background
  doc.setFillColor(249, 115, 22); // Orange-500
  doc.rect(0, 0, pageWidth, 35, "F");

  // Company name and logo area
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("LockSafe", margin, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Official Job Report", margin, 22);

  // Report number on right
  doc.setFontSize(9);
  doc.text("Report Number", pageWidth - margin - 50, 12);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.reportNumber, pageWidth - margin - 50, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Job Number", pageWidth - margin - 50, 25);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.jobNumber, pageWidth - margin - 50, 31);

  y = 45;

  // ========= ANTI-FRAUD BADGE =========
  doc.setFillColor(254, 243, 199); // Amber-100
  doc.roundedRect(margin, y, pageWidth - margin * 2, 12, 2, 2, "F");
  doc.setTextColor(180, 83, 9); // Amber-700
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Anti-Fraud Protected: GPS Verified - Timestamped - Digitally Signed", margin + 5, y + 7.5);
  y += 20;

  // ========= CUSTOMER & LOCKSMITH DETAILS =========
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER DETAILS", margin, y);
  doc.text("LOCKSMITH DETAILS", pageWidth / 2 + 5, y);
  y += 5;

  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.customer.name, margin, y);
  doc.text(data.locksmith.name, pageWidth / 2 + 5, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105); // Slate-600
  doc.text(data.customer.phone, margin, y);
  doc.text(data.locksmith.company, pageWidth / 2 + 5, y);
  y += 4;

  doc.text(data.customer.address, margin, y);
  doc.text(`License: ${data.locksmith.license}`, pageWidth / 2 + 5, y);
  y += 4;

  doc.text(data.customer.postcode, margin, y);
  doc.text(`Rating: ${data.locksmith.rating}/5.0`, pageWidth / 2 + 5, y);
  y += 10;

  drawLine(y);
  y += 8;

  // ========= JOB DETAILS =========
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("JOB DETAILS", margin, y);
  y += 5;

  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(margin, y, pageWidth - margin * 2, 20, 2, 2, "F");
  y += 5;

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Problem: ${data.job.problemType}`, margin + 5, y);
  doc.text(`Property: ${data.job.propertyType}`, pageWidth / 2, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const descriptionLines = doc.splitTextToSize(data.job.description, pageWidth - margin * 2 - 10);
  doc.text(descriptionLines, margin + 5, y);
  y += 15;

  // ========= TIMELINE =========
  checkPageBreak(50);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("COMPLETE TIMELINE (All times UTC)", margin, y);
  y += 5;

  // Table header
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.rect(margin, y, pageWidth - margin * 2, 7, "F");
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.text("Time", margin + 3, y + 5);
  doc.text("Event", margin + 35, y + 5);
  doc.text("GPS Location", pageWidth - margin - 45, y + 5);
  y += 7;

  // Timeline rows
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  for (const item of data.timeline) {
    checkPageBreak(6);
    drawLine(y);
    y += 4;
    doc.text(item.time, margin + 3, y);
    doc.text(item.event, margin + 35, y);
    if (item.gps) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.text(
        `${item.gps.lat.toFixed(4)}, ${item.gps.lng.toFixed(4)} (${item.gps.accuracy || 0}m)`,
        pageWidth - margin - 45,
        y
      );
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8);
    } else {
      doc.setTextColor(203, 213, 225);
      doc.text("-", pageWidth - margin - 45, y);
      doc.setTextColor(15, 23, 42);
    }
    y += 3;
  }
  y += 8;

  // ========= ITEMISED INVOICE =========
  checkPageBreak(60);
  drawLine(y);
  y += 8;

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("ITEMISED INVOICE", margin, y);
  y += 6;

  // Diagnostic
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Diagnostic:", margin, y);
  y += 4;
  doc.setTextColor(15, 23, 42);
  const diagLines = doc.splitTextToSize(data.quote.diagnostic, pageWidth - margin * 2 - 10);
  doc.text(diagLines, margin, y);
  y += diagLines.length * 3.5 + 3;

  doc.text(`Lock Type: ${data.quote.lockType}`, margin, y);
  y += 6;

  // Parts table header
  if (data.quote.parts && data.quote.parts.length > 0) {
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, pageWidth - margin * 2, 6, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Item", margin + 3, y + 4);
    doc.text("Qty", pageWidth - margin - 45, y + 4);
    doc.text("Price", pageWidth - margin - 20, y + 4);
    y += 6;

    // Parts rows
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    for (const part of data.quote.parts) {
      checkPageBreak(6);
      drawLine(y);
      y += 4;
      doc.text(part.name, margin + 3, y);
      doc.text(part.qty.toString(), pageWidth - margin - 45, y);
      doc.text(`£${(part.price || 0).toFixed(2)}`, pageWidth - margin - 20, y);
      y += 2;
    }
  }

  // Labour row
  drawLine(y);
  y += 4;
  doc.text("Labour", margin + 3, y);
  doc.text("-", pageWidth - margin - 45, y);
  doc.text(`£${(data.quote.labour || 0).toFixed(2)}`, pageWidth - margin - 20, y);
  y += 6;

  // Totals
  drawLine(y);
  y += 4;
  doc.setFontSize(9);

  if (data.quote.partsTotal > 0) {
    doc.text("Parts Total", margin + 3, y);
    doc.text(`£${(data.quote.partsTotal || 0).toFixed(2)}`, pageWidth - margin - 20, y);
    y += 5;
  }

  doc.text("Subtotal", margin + 3, y);
  doc.text(`£${(data.quote.subtotal || 0).toFixed(2)}`, pageWidth - margin - 20, y);
  y += 5;

  doc.text("VAT (20%)", margin + 3, y);
  doc.text(`£${(data.quote.vat || 0).toFixed(2)}`, pageWidth - margin - 20, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total", margin + 3, y);
  doc.setTextColor(249, 115, 22); // Orange
  doc.text(`£${(data.quote.total || 0).toFixed(2)}`, pageWidth - margin - 20, y);
  y += 10;

  // ========= DIGITAL SIGNATURE =========
  checkPageBreak(50);
  drawLine(y);
  y += 8;

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DIGITAL SIGNATURE", margin, y);
  y += 6;

  // Signature box
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, 60, 25, 2, 2, "S");

  // Add signature image if available
  if (data.signature.data && data.signature.data.startsWith("data:image")) {
    try {
      doc.addImage(data.signature.data, "PNG", margin + 2, y + 2, 56, 21);
    } catch {
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.text("[Signature]", margin + 20, y + 14);
    }
  } else {
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("[Signature]", margin + 20, y + 14);
  }

  // Signature details on right
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.signature.name, margin + 70, y + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Signed at: ${data.signature.timestamp}`, margin + 70, y + 10);
  if (data.signature.ip && data.signature.ip !== "N/A") {
    doc.text(`IP: ${data.signature.ip}`, margin + 70, y + 14);
  }

  // Confirmations
  y += 18;
  doc.setTextColor(22, 163, 74); // Green-600
  doc.setFontSize(8);
  for (const confirm of data.signature.confirms) {
    doc.text(`[OK] ${confirm}`, margin + 70, y);
    y += 4;
  }
  y += 12;

  // ========= LEGAL FOOTER =========
  checkPageBreak(25);
  drawLine(y);
  y += 8;

  doc.setTextColor(148, 163, 184); // Slate-400
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const footerText1 = "This document is an official record of services provided by a LockSafe verified locksmith.";
  const footerText2 = "All timestamps are recorded automatically and GPS coordinates are captured at key events.";
  doc.text(footerText1, pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text(footerText2, pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(8);
  const generatedText = `Generated: ${new Date(data.generatedAt).toLocaleString()} | Job: ${data.jobNumber} | Report: ${data.reportNumber}`;
  doc.text(generatedText, pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(249, 115, 22);
  doc.text("LockSafe UK - www.locksafe.uk - 07818 333 989", pageWidth / 2, y, { align: "center" });

  return doc;
}

// Generate and download PDF
export async function downloadJobReportPDF(data: JobReportData) {
  try {
    const doc = await generateJobReportPDF(data);
    doc.save(`LockSafe-Report-${data.reportNumber}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}

// Generate PDF as blob
export async function getJobReportPDFBlob(data: JobReportData): Promise<Blob> {
  const doc = await generateJobReportPDF(data);
  return doc.output("blob");
}

// Generate PDF as base64
export async function getJobReportPDFBase64(data: JobReportData): Promise<string> {
  const doc = await generateJobReportPDF(data);
  return doc.output("datauristring");
}
