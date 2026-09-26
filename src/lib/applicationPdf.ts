import { jsPDF } from 'jspdf';
import { EmployeeApplication } from '../types';
import { formatOfficialDate, cleanApplicationCategory, cleanTemplateName } from './applicationFormatters';

const FIELD_LABEL_MAP: Record<string, string> = {
  f_notice_date: 'Notice Date',
  notice_date: 'Notice Date',
  noticeDate: 'Notice Date',
  f_last_working_day: 'Proposed Last Working Day',
  last_working_day: 'Proposed Last Working Day',
  lastWorkingDay: 'Proposed Last Working Day',
  f_start_date: 'Leave Start Date',
  start_date: 'Leave Start Date',
  startDate: 'Leave Start Date',
  f_end_date: 'Leave End Date',
  end_date: 'Leave End Date',
  endDate: 'Leave End Date',
  f_total_days: 'Total Days Count',
  total_days: 'Total Days Count',
  totalDays: 'Total Days Count',
  f_advance_amount: 'Requested Advance Amount (BDT)',
  advance_amount: 'Requested Advance Amount (BDT)',
  advanceAmount: 'Requested Advance Amount (BDT)',
  f_adjustment_month: 'Salary Month for Deduction',
  adjustment_month: 'Salary Month for Deduction',
  adjustmentMonth: 'Salary Month for Deduction',
  f_reason: 'Reason for Request',
  reason: 'Reason for Request',
  f_handover_notes: 'Handover & Knowledge Transfer Plan',
  handover_notes: 'Handover & Knowledge Transfer Plan',
  handoverNotes: 'Handover & Knowledge Transfer Plan',
  f_handover: 'Handover & Knowledge Transfer Plan',
  handover_plan: 'Handover & Knowledge Transfer Plan',
  handoverPlan: 'Handover & Knowledge Transfer Plan',
  f_emergency_contact: 'Emergency Contact & Phone',
  emergency_contact: 'Emergency Contact & Phone',
  emergencyContact: 'Emergency Contact & Phone',
};

/**
 * Turns camelCase or snake_case keys into clean, human-readable labels.
 * Strips leading 'f_' or 'f-' prefix (e.g. 'f_notice_date' -> 'Notice Date', NOT 'F Notice Date').
 */
function formatFieldLabel(key: string): string {
  if (FIELD_LABEL_MAP[key]) {
    return FIELD_LABEL_MAP[key];
  }

  // Strip leading 'f_' or 'f-' prefix used in application template field IDs
  const cleanKey = key.replace(/^f[_-]/i, '');
  if (FIELD_LABEL_MAP[cleanKey]) {
    return FIELD_LABEL_MAP[cleanKey];
  }

  return cleanKey
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Strips any Bengali Unicode characters (\u0980-\u09FF) or Bengali currency signs (৳ -> BDT)
 * to ensure PDF renders 100% clean English text with zero corrupted font glyphs.
 */
function sanitizePdfString(str: string): string {
  if (!str) return '';
  return str
    .replace(/৳/g, 'BDT ')
    .replace(/\s*\([^)]*[\u0980-\u09FF][^)]*\)/g, '')
    .replace(/[\u0980-\u09FF]/g, '')
    .replace(/\s*\(\s*\)/g, '')
    .trim();
}

/**
 * Loads an image from a URL into base64 data URL for jsPDF embedding
 */
async function loadBase64Image(url: string): Promise<{ data: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve({
            data: dataUrl,
            width: canvas.width,
            height: canvas.height
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Downloads a high-fidelity, beautifully styled vector PDF of an official Employee Application.
 * Built with native vector jsPDF rendering to guarantee 100% crisp, selectable text and ZERO blank pages.
 */
export async function downloadApplicationPdf(
  app: EmployeeApplication,
  companyName: string = 'Vics Ventures',
  companyLogoUrl?: string
): Promise<void> {
  // Attempt to resolve real company name & logo from cached settings if available
  let effectiveCompanyName = companyName || 'Vics Ventures';
  let effectiveLogoUrl = companyLogoUrl;

  try {
    const cachedSettings = localStorage.getItem('cached_site_settings');
    if (cachedSettings) {
      const parsed = JSON.parse(cachedSettings);
      if (
        parsed?.companyName &&
        parsed.companyName !== 'Company Enterprise' &&
        parsed.companyName !== 'Company Office' &&
        parsed.companyName !== 'Parcel Intelligence'
      ) {
        effectiveCompanyName = parsed.companyName;
      }
      if (!effectiveLogoUrl && parsed?.logoUrl) {
        effectiveLogoUrl = parsed.logoUrl;
      }
    }
  } catch {
    // Ignore localStorage errors
  }

  // Ensure default company name is Vics Ventures if still placeholder
  if (
    !effectiveCompanyName ||
    effectiveCompanyName === 'Company Enterprise' ||
    effectiveCompanyName === 'Company Office' ||
    effectiveCompanyName === 'Parcel Intelligence'
  ) {
    effectiveCompanyName = 'Vics Ventures';
  }

  // Determine recipient display
  const recipientDisplay =
    app.recipientTitle ||
    app.recipientName ||
    (app.recipientRole ? app.recipientRole.replace(/_/g, ' ').toUpperCase() : 'The Respected Authority');

  const recipientDeptDisplay =
    app.recipientDepartment ||
    (app.department ? `${app.department} Department` : 'Management & Human Resources');

  const submissionDate = formatOfficialDate(app.submittedAt || app.createdAt) || 'Recent';
  const reviewedDate = app.reviewedAt ? formatOfficialDate(app.reviewedAt) : '';

  const cleanFilename = `${app.applicationId || 'Application'}_${(app.userName || 'Employee').replace(/\s+/g, '_')}.pdf`;

  // Initialize jsPDF A4 document (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2; // 178mm
  const bottomThreshold = 265; // Trigger page break if exceeded
  let currentY = 16;

  // Helper: check space and break page if needed
  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > bottomThreshold) {
      doc.addPage();
      currentY = 20;
      drawSubsequentHeader();
    }
  };

  // Helper: draw small header on page 2+
  const drawSubsequentHeader = () => {
    doc.setFillColor(30, 58, 138); // #1e3a8a
    doc.rect(0, 0, pageWidth, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139); // #64748b
    doc.text(effectiveCompanyName.toUpperCase(), marginX, 12);

    const refText = `${app.applicationId || 'APPLICATION'} (Continued)`;
    const refWidth = doc.getTextWidth(refText);
    doc.text(refText, pageWidth - marginX - refWidth, 12);

    doc.setDrawColor(226, 232, 240); // #e2e8f0
    doc.setLineWidth(0.3);
    doc.line(marginX, 15, pageWidth - marginX, 15);
    currentY = 22;
  };

  // Optional: load company logo
  let logoData: { data: string; width: number; height: number } | null = null;
  if (effectiveLogoUrl) {
    try {
      logoData = await loadBase64Image(effectiveLogoUrl);
    } catch {
      // Continue without logo
    }
  }

  // ==========================================
  // PAGE 1: OFFICIAL LETTERHEAD HEADER
  // ==========================================

  // Top accent bars
  doc.setFillColor(30, 58, 138); // Deep Navy #1e3a8a
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFillColor(37, 99, 235); // Royal Blue #2563eb
  doc.rect(0, 4, 130, 1.5, 'F');

  currentY = 16;

  // Logo if available
  if (logoData) {
    try {
      const maxLogoW = 38;
      const maxLogoH = 14;
      const aspect = logoData.width / logoData.height;
      let renderW = maxLogoW;
      let renderH = maxLogoW / aspect;
      if (renderH > maxLogoH) {
        renderH = maxLogoH;
        renderW = maxLogoH * aspect;
      }
      doc.addImage(logoData.data, 'PNG', marginX, currentY, renderW, renderH);
      currentY += renderH + 3;
    } catch {
      // If error rendering logo, ignore
    }
  }

  // Company Name & Portal Title (Left column)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text(effectiveCompanyName.toUpperCase(), marginX, currentY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text('OFFICIAL EMPLOYEE REQUEST & FORMAL APPLICATION', marginX, currentY + 8.5);

  // Application Reference & Metadata (Right column)
  const appIdText = app.applicationId || 'APP-RECORD';
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  const appIdWidth = doc.getTextWidth(appIdText) + 8;
  const badgeX = pageWidth - marginX - appIdWidth;

  // Dark badge for ID
  doc.setFillColor(15, 23, 42); // #0f172a
  doc.roundedRect(badgeX, currentY - 2, appIdWidth, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(appIdText, badgeX + 4, currentY + 2.8);

  // Submission Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // #475569
  const dateLabel = `Date: `;
  const dateVal = submissionDate;
  const dateFullW = doc.getTextWidth(dateLabel + dateVal);
  doc.text(dateLabel, pageWidth - marginX - dateFullW, currentY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dateVal, pageWidth - marginX - doc.getTextWidth(dateVal), currentY + 10.5);

  // Category - guaranteed clean English without any Bengali text or corrupted font glyphs
  const catText = cleanApplicationCategory(app.category, app.applicationType || app.templateName);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const catLabel = `Category: `;
  const catFullW = doc.getTextWidth(catLabel + catText);
  doc.text(catLabel, pageWidth - marginX - catFullW, currentY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(catText, pageWidth - marginX - doc.getTextWidth(catText), currentY + 15);

  currentY += 21;

  // Divider line
  doc.setDrawColor(15, 23, 42); // #0f172a
  doc.setLineWidth(0.6);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 8;

  // ==========================================
  // RECIPIENT SECTION
  // ==========================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text('TO,', marginX, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text(recipientDisplay, marginX, currentY);
  currentY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85); // #334155
  doc.text(recipientDeptDisplay, marginX, currentY);
  currentY += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(effectiveCompanyName, marginX, currentY);
  currentY += 8;

  // ==========================================
  // SUBJECT BANNER
  // ==========================================
  const subjectPrefix = 'Subject: ';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);

  const subjectText = app.subject || 'Application';
  const wrappedSubject = doc.splitTextToSize(`${subjectPrefix}${subjectText}`, contentWidth - 14);
  const subjectBoxHeight = Math.max(14, wrappedSubject.length * 5.2 + 6);

  ensureSpace(subjectBoxHeight + 6);

  // Background Box
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, currentY, contentWidth, subjectBoxHeight, 2, 2, 'FD');

  // Blue Left Accent Stripe
  doc.setFillColor(37, 99, 235); // #2563eb
  doc.rect(marginX, currentY, 2.5, subjectBoxHeight, 'F');

  // Text inside subject box
  doc.setTextColor(37, 99, 235);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('SUBJECT:', marginX + 6, currentY + 5.5);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);

  const subjectOnlyLines = doc.splitTextToSize(subjectText, contentWidth - 12);
  let subTextY = currentY + 10.5;
  subjectOnlyLines.forEach((line: string) => {
    doc.text(line, marginX + 6, subTextY);
    subTextY += 4.8;
  });

  currentY += subjectBoxHeight + 8;

  // ==========================================
  // SALUTATION
  // ==========================================
  ensureSpace(10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(app.salutation || 'Dear Sir/Madam,', marginX, currentY);
  currentY += 7;

  // ==========================================
  // MAIN BODY PARAGRAPHS
  // ==========================================
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.8);
  doc.setTextColor(30, 41, 59); // #1e293b

  const bodyText = app.body || 'I am writing to formally submit this application.';
  const paragraphs = bodyText.split(/\n+/);

  paragraphs.forEach((para) => {
    const trimmed = para.trim();
    if (!trimmed) {
      currentY += 3;
      return;
    }

    const lines = doc.splitTextToSize(trimmed, contentWidth);
    lines.forEach((line: string) => {
      ensureSpace(5.5);
      doc.text(line, marginX, currentY);
      currentY += 5.2;
    });
    currentY += 3.5; // Spacing after paragraph
  });

  currentY += 3;

  // ==========================================
  // APPLICATION PARTICULARS TABLE (Field Values)
  // ==========================================
  const fieldEntries = Object.entries(app.fieldValues || {}).filter(
    ([_, val]) => val !== undefined && val !== null && String(val).trim() !== ''
  );

  if (fieldEntries.length > 0) {
    ensureSpace(22);

    // Section Header
    doc.setFillColor(241, 245, 249); // #f1f5f9
    doc.setDrawColor(226, 232, 240); // #e2e8f0
    doc.setLineWidth(0.3);
    doc.rect(marginX, currentY, contentWidth, 7, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85); // #334155
    doc.text('DOCUMENTED APPLICATION PARTICULARS & DETAILS', marginX + 4, currentY + 4.8);
    currentY += 7;

    const labelColW = 58;
    const valueColW = contentWidth - labelColW;

    fieldEntries.forEach(([key, val], idx) => {
      const rawLabel = formatFieldLabel(key);
      const label = sanitizePdfString(rawLabel);
      const rawVal =
        typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)
          ? formatOfficialDate(val)
          : String(val);
      const displayVal = sanitizePdfString(rawVal);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const labelLines = doc.splitTextToSize(label, labelColW - 6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const valLines = doc.splitTextToSize(displayVal, valueColW - 6);

      const maxLines = Math.max(labelLines.length, valLines.length);
      const rowHeight = Math.max(7, maxLines * 4.4 + 3);

      ensureSpace(rowHeight);

      // Row background (alternating)
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252); // #f8fafc
        doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
      }

      // Row borders
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'S');
      doc.line(marginX + labelColW, currentY, marginX + labelColW, currentY + rowHeight);

      // Label Text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // #475569
      let lblY = currentY + 4.6;
      labelLines.forEach((l: string) => {
        doc.text(l, marginX + 3.5, lblY);
        lblY += 4.2;
      });

      // Value Text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42); // #0f172a
      let valY = currentY + 4.6;
      valLines.forEach((v: string) => {
        doc.text(v, marginX + labelColW + 3.5, valY);
        valY += 4.2;
      });

      currentY += rowHeight;
    });

    currentY += 8;
  }

  // ==========================================
  // CLOSING SIGN-OFF
  // ==========================================
  ensureSpace(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(app.closing || 'Sincerely,', marginX, currentY);
  currentY += 8;

  // ==========================================
  // CREDENTIALS & DECISION BLOCK (TWO COLUMNS)
  // ==========================================
  // Calculate dynamic decision box height based on actual content
  let decisionBoxHeight = 24;
  if (app.reviewedBy && app.reviewedAt) {
    decisionBoxHeight = 29;
  }
  if (app.adminComment) {
    decisionBoxHeight = 42;
  }

  const bottomBlockNeeded = Math.max(38, decisionBoxHeight) + 12;
  ensureSpace(bottomBlockNeeded);

  // Top dashed divider
  doc.setDrawColor(203, 213, 225); // #cbd5e1
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  doc.setLineDashPattern([], 0); // Reset dash

  currentY += 6;

  const leftColWidth = 85;
  const rightColWidth = 85;
  const leftColX = marginX; // 16mm
  const rightColX = marginX + leftColWidth + 8; // 16 + 85 + 8 = 109mm (8mm clear buffer)

  // LEFT COLUMN: APPLICANT DETAILS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('APPLICANT SIGNATURE & CREDENTIALS', leftColX, currentY);

  let credY = currentY + 5;
  const printCred = (lbl: string, val: string, isMono: boolean = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(lbl, leftColX, credY);

    if (isMono) {
      doc.setFont('courier', 'bold');
      doc.setTextColor(37, 99, 235);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
    }

    // Ensure value text is bounded within the left column width
    const maxValW = leftColWidth - 28;
    const truncatedVal = doc.getTextWidth(val) > maxValW ? val.substring(0, 26) + '...' : val;
    doc.text(truncatedVal, leftColX + 26, credY);
    credY += 4.5;
  };

  printCred('Full Name:', app.userName || 'Employee');
  printCred('Employee ID:', app.employeeId || app.userId || 'N/A', true);
  printCred('Department:', app.department || app.applicantDepartment || 'General');
  if (app.designation) {
    printCred('Designation:', app.designation);
  }
  printCred('Email:', app.userEmail || '');

  // Verified & Submitted line - wrapped strictly inside left column so it NEVER overflows into right column
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const verifyLines = doc.splitTextToSize(`Electronically Verified & Submitted on ${submissionDate}`, leftColWidth - 4);
  credY += 1.5;
  verifyLines.forEach((vl: string) => {
    doc.text(vl, leftColX, credY);
    credY += 3.8;
  });

  // RIGHT COLUMN: AUTHORITY DECISION STAMP
  const statusColorRgb =
    app.status === 'approved' ? [5, 150, 105] :
    app.status === 'rejected' ? [220, 38, 38] :
    app.status === 'draft' ? [100, 116, 139] : [217, 119, 6];

  const statusBgRgb =
    app.status === 'approved' ? [236, 253, 245] :
    app.status === 'rejected' ? [254, 242, 242] :
    app.status === 'draft' ? [248, 250, 252] : [255, 251, 235];

  const statusLabel =
    app.status === 'approved' ? 'OFFICIALLY APPROVED' :
    app.status === 'rejected' ? 'REJECTED / NOT APPROVED' :
    app.status === 'draft' ? 'DRAFT COPY' : 'PENDING APPROVAL';

  // Decision box background & border
  doc.setFillColor(statusBgRgb[0], statusBgRgb[1], statusBgRgb[2]);
  doc.setDrawColor(statusColorRgb[0], statusColorRgb[1], statusColorRgb[2]);
  doc.setLineWidth(0.6);
  doc.roundedRect(rightColX, currentY - 2, rightColWidth, decisionBoxHeight, 2, 2, 'FD');

  // Header of box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('AUTHORITY STATUS', rightColX + 4, currentY + 3.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(statusColorRgb[0], statusColorRgb[1], statusColorRgb[2]);
  const statusLblW = doc.getTextWidth(statusLabel);
  doc.text(statusLabel, rightColX + rightColWidth - statusLblW - 4, currentY + 3.5);

  // Divider inside box
  doc.setDrawColor(statusColorRgb[0], statusColorRgb[1], statusColorRgb[2]);
  doc.setLineWidth(0.2);
  doc.line(rightColX + 3, currentY + 6, rightColX + rightColWidth - 3, currentY + 6);

  let decY = currentY + 11;
  if (app.reviewedBy) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Reviewed by:', rightColX + 4, decY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(app.reviewedBy, rightColX + 24, decY);
    decY += 4.5;

    if (app.reviewedAt) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`On: ${reviewedDate}`, rightColX + 4, decY);
      decY += 5;
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Awaiting Official Authorization & Review', rightColX + 4, decY);
    decY += 6;
  }

  // Approver comment if present
  if (app.adminComment) {
    doc.setDrawColor(statusColorRgb[0], statusColorRgb[1], statusColorRgb[2]);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(rightColX + 3, decY, rightColX + rightColWidth - 3, decY);
    doc.setLineDashPattern([], 0);
    decY += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text('APPROVER REMARKS:', rightColX + 4, decY);
    decY += 4;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const commentLines = doc.splitTextToSize(`"${app.adminComment}"`, rightColWidth - 8);
    commentLines.slice(0, 3).forEach((line: string) => {
      doc.text(line, rightColX + 4, decY);
      decY += 3.8;
    });
  }

  // ==========================================
  // FOOTER ON ALL PAGES
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    const footerY = pageHeight - 12;

    // Footer divider line
    doc.setDrawColor(226, 232, 240); // #e2e8f0
    doc.setLineWidth(0.3);
    doc.line(marginX, footerY - 3, pageWidth - marginX, footerY - 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // #94a3b8

    const leftFooter = `Generated via ${effectiveCompanyName} Portal • Ref: ${app.applicationId || 'N/A'}`;
    doc.text(leftFooter, marginX, footerY);

    const rightFooter = `Official Record • Page ${i} of ${totalPages}`;
    const rfWidth = doc.getTextWidth(rightFooter);
    doc.text(rightFooter, pageWidth - marginX - rfWidth, footerY);
  }

  // Save the PDF file - triggers instant, crisp download in browser
  doc.save(cleanFilename);
}
