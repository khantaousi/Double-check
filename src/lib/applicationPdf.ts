import { EmployeeApplication } from '../types';
import { formatOfficialDate } from './applicationFormatters';

/**
 * Helper to turn camelCase or snake_case keys into clean, human-readable labels
 */
function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/**
 * Downloads a high-fidelity, beautifully styled PDF of an official Employee Application.
 * Fixes blank/white PDF issues caused by off-screen positioning (-9999px).
 * Uses html2pdf with fallback to html-to-image + jsPDF and browser print.
 */
export async function downloadApplicationPdf(
  app: EmployeeApplication,
  companyName: string = 'Company Enterprise',
  companyLogoUrl?: string
): Promise<void> {
  // Attempt to resolve real company name & logo from cached settings if available
  let effectiveCompanyName = companyName;
  let effectiveLogoUrl = companyLogoUrl;

  try {
    const cachedSettings = localStorage.getItem('cached_site_settings');
    if (cachedSettings) {
      const parsed = JSON.parse(cachedSettings);
      if (parsed?.companyName && (!companyName || companyName === 'Company Enterprise' || companyName === 'Parcel Intelligence' || companyName === 'Company Office')) {
        effectiveCompanyName = parsed.companyName;
      }
      if (!effectiveLogoUrl && parsed?.logoUrl) {
        effectiveLogoUrl = parsed.logoUrl;
      }
    }
  } catch (e) {
    // Ignore localStorage errors
  }

  // Determine recipient display
  const recipientDisplay = 
    app.recipientTitle || 
    app.recipientName || 
    (app.recipientRole ? app.recipientRole.replace(/_/g, ' ').toUpperCase() : 'The Respected Authority');

  const recipientDeptDisplay = 
    app.recipientDepartment || 
    (app.department ? `${app.department} Department` : 'Management & Human Resources');

  const statusColor = 
    app.status === 'approved' ? '#059669' :
    app.status === 'rejected' ? '#dc2626' :
    app.status === 'draft' ? '#64748b' : '#d97706';

  const statusBg =
    app.status === 'approved' ? '#ecfdf5' :
    app.status === 'rejected' ? '#fef2f2' :
    app.status === 'draft' ? '#f8fafc' : '#fffbeb';

  const statusLabel =
    app.status === 'approved' ? 'OFFICIALLY APPROVED' :
    app.status === 'rejected' ? 'REJECTED / NOT APPROVED' :
    app.status === 'draft' ? 'DRAFT COPY' : 'PENDING APPROVAL';

  const submissionDate = formatOfficialDate(app.submittedAt || app.createdAt) || 'Recent';
  const reviewedDate = app.reviewedAt ? formatOfficialDate(app.reviewedAt) : '';

  // Filter valid field entries
  const fieldEntries = Object.entries(app.fieldValues || {}).filter(
    ([_, val]) => val !== undefined && val !== null && String(val).trim() !== ''
  );

  // Create isolated container positioned at (0, 0) behind viewport so html2canvas captures it accurately
  const container = document.createElement('div');
  container.id = `application-pdf-render-${app.applicationId || Date.now()}`;
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '794px'; // Standard A4 width at 96 DPI
  container.style.minHeight = '1120px'; // Standard A4 height at 96 DPI
  container.style.zIndex = '-999999';
  container.style.pointerEvents = 'none';
  container.style.opacity = '1';
  container.style.visibility = 'visible';
  container.style.boxSizing = 'border-box';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.padding = '44px 52px';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  container.style.lineHeight = '1.6';

  const cleanFilename = `${app.applicationId || 'Application'}_${(app.userName || 'Employee').replace(/\s+/g, '_')}.pdf`;

  container.innerHTML = `
    <!-- Top Accent Bar -->
    <div style="height: 5px; background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 50%, #0284c7 100%); margin: -44px -52px 32px -52px;"></div>

    <!-- Official Letterhead Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 26px;">
      <div style="max-width: 65%;">
        ${effectiveLogoUrl ? `
          <img 
            src="${effectiveLogoUrl}" 
            alt="${effectiveCompanyName}" 
            style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 8px; display: block;" 
            crossorigin="anonymous"
          />
        ` : ''}
        <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.3px; line-height: 1.2;">
          ${effectiveCompanyName}
        </h1>
        <div style="margin: 3px 0 0 0; font-size: 10.5px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
          Official Employee Request & Formal Application
        </div>
      </div>

      <div style="text-align: right; min-width: 220px;">
        <div style="display: inline-block; background: #0f172a; color: #ffffff; padding: 5px 12px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 6px;">
          ${app.applicationId || 'APP-RECORD'}
        </div>
        <div style="font-size: 11.5px; color: #334155; font-weight: 600;">
          Date: <strong style="color: #0f172a;">${submissionDate}</strong>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
          Category: <span style="font-weight: 700; color: #2563eb;">${app.applicationType || app.templateName || 'General Application'}</span>
        </div>
      </div>
    </div>

    <!-- Recipient Section -->
    <div style="margin-bottom: 24px; padding-left: 2px;">
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px; letter-spacing: 0.5px;">To,</div>
      <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.3;">${recipientDisplay}</div>
      <div style="font-size: 13px; color: #334155; font-weight: 600; margin-top: 2px;">${recipientDeptDisplay}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 1px;">${effectiveCompanyName}</div>
    </div>

    <!-- Subject Banner -->
    <div style="margin-bottom: 24px; padding: 12px 18px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-top: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; border-radius: 6px;">
      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #2563eb; letter-spacing: 0.8px; margin-bottom: 2px;">Subject:</div>
      <div style="font-size: 14.5px; font-weight: 800; color: #0f172a; line-height: 1.4;">${app.subject}</div>
    </div>

    <!-- Salutation -->
    <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 14px;">
      ${app.salutation || 'Dear Sir/Madam,'}
    </div>

    <!-- Main Letter Body -->
    <div style="margin-bottom: 26px; font-size: 13.5px; color: #1e293b; line-height: 1.8; white-space: pre-wrap; word-break: break-word; text-align: justify;">${app.body}</div>

    <!-- Field Details Table (Handover Plan, Leave Dates, Reasons, etc. if present) -->
    ${fieldEntries.length > 0 ? `
      <div style="margin-bottom: 28px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #ffffff;">
        <div style="background-color: #f1f5f9; padding: 8px 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; letter-spacing: 0.6px; border-bottom: 1px solid #e2e8f0;">
          Documented Application Particulars & Details
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          ${fieldEntries.map(([key, val], idx) => {
            const label = formatFieldLabel(key);
            const displayVal = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)
              ? formatOfficialDate(val)
              : String(val);
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            return `
              <tr style="background-color: ${rowBg}; border-bottom: 1px solid #edf2f7;">
                <td style="padding: 8px 14px; color: #475569; font-weight: 700; width: 35%; vertical-align: top;">${label}:</td>
                <td style="padding: 8px 14px; color: #0f172a; font-weight: 600; width: 65%; white-space: pre-wrap; line-height: 1.5;">${displayVal}</td>
              </tr>
            `;
          }).join('')}
        </table>
      </div>
    ` : ''}

    <!-- Formal Closing Sign-off -->
    <div style="font-size: 13.5px; font-weight: 600; color: #334155; margin-bottom: 18px;">
      ${app.closing || 'Sincerely,'}
    </div>

    <!-- Bottom Particulars & Decision Row -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 24px; padding-top: 18px; border-top: 1px dashed #cbd5e1; gap: 24px;">
      
      <!-- Applicant Credentials -->
      <div style="flex: 1; max-width: 52%;">
        <div style="font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.6px;">
          Applicant Signature & Credentials
        </div>
        <table style="border-collapse: collapse; font-size: 12px; width: 100%;">
          <tr>
            <td style="padding: 3px 8px 3px 0; color: #64748b; font-weight: 600; width: 110px;">Full Name:</td>
            <td style="padding: 3px 0; color: #0f172a; font-weight: 800;">${app.userName}</td>
          </tr>
          <tr>
            <td style="padding: 3px 8px 3px 0; color: #64748b; font-weight: 600;">Employee ID:</td>
            <td style="padding: 3px 0; color: #2563eb; font-weight: 800; font-family: ui-monospace, SFMono-Regular, monospace;">
              ${app.employeeId || app.userId}
            </td>
          </tr>
          <tr>
            <td style="padding: 3px 8px 3px 0; color: #64748b; font-weight: 600;">Department:</td>
            <td style="padding: 3px 0; color: #0f172a; font-weight: 600;">
              ${app.department || app.applicantDepartment || 'Not Assigned'}
            </td>
          </tr>
          ${app.designation ? `
          <tr>
            <td style="padding: 3px 8px 3px 0; color: #64748b; font-weight: 600;">Designation:</td>
            <td style="padding: 3px 0; color: #0f172a; font-weight: 600;">${app.designation}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 3px 8px 3px 0; color: #64748b; font-weight: 600;">Email:</td>
            <td style="padding: 3px 0; color: #475569; font-size: 11px;">${app.userEmail}</td>
          </tr>
        </table>

        <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10.5px; color: #64748b; font-style: italic;">
          ✓ Electronically Verified & Submitted on ${submissionDate}
        </div>
      </div>

      <!-- Authority Decision Block -->
      <div style="flex: 1; max-width: 45%; border: 2px solid ${statusColor}; background-color: ${statusBg}; border-radius: 8px; padding: 14px 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid ${statusColor}40; padding-bottom: 6px;">
          <span style="font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px;">Authority Status</span>
          <span style="font-size: 11px; font-weight: 900; color: ${statusColor}; letter-spacing: 0.4px;">${statusLabel}</span>
        </div>
        
        ${app.reviewedBy ? `
          <div style="font-size: 11.5px; color: #1e293b; margin-top: 4px;">
            Reviewed by: <strong style="color: #0f172a;">${app.reviewedBy}</strong>
          </div>
          ${app.reviewedAt ? `<div style="font-size: 10.5px; color: #64748b; margin-top: 1px;">On: ${reviewedDate}</div>` : ''}
        ` : `
          <div style="font-size: 11px; color: #64748b; font-style: italic; margin-top: 4px;">
            Awaiting Official Authorization & Review
          </div>
        `}

        ${app.adminComment ? `
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed ${statusColor}80; font-size: 11px; color: #0f172a;">
            <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Approver Remarks:</div>
            <div style="font-style: italic; margin-top: 3px; line-height: 1.4; color: #1e293b;">"${app.adminComment}"</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Official Document Security Footer -->
    <div style="margin-top: 38px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #94a3b8;">
      <div>Generated via ${effectiveCompanyName} Portal • Ref: ${app.applicationId || 'N/A'}</div>
      <div>Security Hash: ${(app.id || 'SEC-000').substring(0, 14)}... (Official Record)</div>
    </div>
  `;

  document.body.appendChild(container);

  // Allow styles, fonts, and DOM layout to paint cleanly
  await new Promise((resolve) => setTimeout(resolve, 150));

  let downloadSucceeded = false;

  // PRIMARY ATTEMPT: html2pdf.js with proper viewport and zero scroll offsets
  try {
    const html2pdfModule = await import('html2pdf.js');
    const html2pdfFn: any = (html2pdfModule as any).default || html2pdfModule;

    const opt = {
      margin: [10, 10, 10, 10],
      filename: cleanFilename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        x: 0,
        y: 0
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    await html2pdfFn().set(opt).from(container).save();
    downloadSucceeded = true;
  } catch (pdfErr) {
    console.warn('html2pdf execution error, attempting html-to-image + jsPDF fallback:', pdfErr);
  }

  // SECONDARY ATTEMPT: html-to-image + jsPDF direct generation
  if (!downloadSucceeded) {
    try {
      const { toPng } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      const dataUrl = await toPng(container, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(dataUrl);
      const renderedHeight = (imgProps.height * pageWidth) / imgProps.width;

      if (renderedHeight <= pageHeight) {
        pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, renderedHeight, undefined, 'FAST');
      } else {
        let heightLeft = renderedHeight;
        let position = 0;
        pdf.addImage(dataUrl, 'PNG', 0, position, pageWidth, renderedHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position -= pageHeight;
          pdf.addPage();
          pdf.addImage(dataUrl, 'PNG', 0, position, pageWidth, renderedHeight, undefined, 'FAST');
          heightLeft -= pageHeight;
        }
      }

      pdf.save(cleanFilename);
      downloadSucceeded = true;
    } catch (fallbackErr) {
      console.warn('Direct jsPDF export error, resorting to print dialog fallback:', fallbackErr);
    }
  }

  // TERTIARY FALLBACK: Browser Print Dialog
  if (!downloadSucceeded) {
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${app.applicationId} - ${app.subject}</title>
              <style>
                body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #0f172a; }
                @media print {
                  @page { margin: 12mm; size: A4 portrait; }
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              ${container.innerHTML}
              <script>
                window.onload = function() { window.print(); window.close(); };
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (printErr) {
      console.error('All PDF export options failed:', printErr);
    }
  }

  // Cleanup container safely
  if (document.body.contains(container)) {
    document.body.removeChild(container);
  }
}

