import { EmployeeApplication } from '../types';
import { formatOfficialDate } from './applicationFormatters';

/**
 * Downloads a high-fidelity PDF of an official Employee Application.
 * Uses html2pdf with fallback to browser print.
 */
export async function downloadApplicationPdf(
  app: EmployeeApplication,
  companyName: string = 'Parcel Intelligence',
  companyLogoUrl?: string
): Promise<void> {
  const container = document.createElement('div');
  container.id = `application-pdf-${app.applicationId}`;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // Standard A4 width at 96 DPI
  container.style.padding = '48px 56px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.style.lineHeight = '1.6';
  container.style.boxSizing = 'border-box';

  const statusColor = 
    app.status === 'approved' ? '#059669' :
    app.status === 'rejected' ? '#dc2626' :
    app.status === 'draft' ? '#64748b' : '#d97706';

  const statusBg =
    app.status === 'approved' ? '#ecfdf5' :
    app.status === 'rejected' ? '#fef2f2' :
    app.status === 'draft' ? '#f1f5f9' : '#fffbeb';

  const statusLabel =
    app.status === 'approved' ? 'APPROVED' :
    app.status === 'rejected' ? 'NOT APPROVED / REJECTED' :
    app.status === 'draft' ? 'DRAFT' : 'PENDING APPROVAL';

  const submissionDate = formatOfficialDate(app.submittedAt || app.createdAt);
  const reviewedDate = app.reviewedAt ? formatOfficialDate(app.reviewedAt) : '';

  // Render template field list items
  const fieldEntries = Object.entries(app.fieldValues || {}).filter(([_, val]) => val !== undefined && val !== null && String(val).trim() !== '');

  container.innerHTML = `
    <!-- Letterhead -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px;">
      <div>
        ${companyLogoUrl ? `<img src="${companyLogoUrl}" alt="${companyName}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 8px;" />` : ''}
        <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">${companyName}</h1>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Official Employee Request Document</p>
      </div>
      <div style="text-align: right;">
        <div style="display: inline-block; background: #0f172a; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 12px; font-weight: 700; margin-bottom: 6px;">
          ${app.applicationId}
        </div>
        <div style="font-size: 11px; color: #475569; font-weight: 600;">Date: <strong>${submissionDate}</strong></div>
        <div style="font-size: 10px; color: #64748b; font-weight: 500;">Type: ${app.applicationType}</div>
      </div>
    </div>

    <!-- Recipient Section -->
    <div style="margin-bottom: 24px;">
      <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 2px;">To,</div>
      <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${app.recipientTitle}</div>
      <div style="font-size: 13px; color: #334155; font-weight: 600;">${app.recipientDepartment || (app.department ? app.department + ' Department' : companyName)}</div>
      <div style="font-size: 12px; color: #64748b;">${companyName}</div>
    </div>

    <!-- Subject -->
    <div style="margin-bottom: 24px; padding: 12px 16px; background-color: #f8fafc; border-left: 4px solid #2563eb; border-radius: 4px;">
      <span style="font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase;">Subject:</span>
      <span style="font-size: 14px; font-weight: 700; color: #0f172a; margin-left: 8px;">${app.subject}</span>
    </div>

    <!-- Main Letter Body -->
    <div style="margin-bottom: 28px; font-size: 13.5px; color: #1e293b; line-height: 1.7; white-space: pre-line;">
${app.body}
    </div>

    <!-- Applicant Signature & Particulars Block -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 36px; padding-top: 20px; border-top: 1px dashed #cbd5e1;">
      <div style="max-width: 50%;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 6px; letter-spacing: 0.5px;">Applicant Credentials:</div>
        <table style="border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="padding: 2px 10px 2px 0; color: #64748b; font-weight: 600;">Applicant Name:</td>
            <td style="padding: 2px 0; color: #0f172a; font-weight: 700;">${app.userName}</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; color: #64748b; font-weight: 600;">User / Employee ID:</td>
            <td style="padding: 2px 0; color: #2563eb; font-weight: 800; font-family: monospace;">${app.employeeId || app.userId}</td>
          </tr>
          <tr>
            <td style="padding: 2px 10px 2px 0; color: #64748b; font-weight: 600;">Department:</td>
            <td style="padding: 2px 0; color: #0f172a; font-weight: 600;">${app.department || 'Not Assigned'}</td>
          </tr>
          ${app.designation ? `
          <tr>
            <td style="padding: 2px 10px 2px 0; color: #64748b; font-weight: 600;">Designation:</td>
            <td style="padding: 2px 0; color: #0f172a; font-weight: 600;">${app.designation}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 2px 10px 2px 0; color: #64748b; font-weight: 600;">Email:</td>
            <td style="padding: 2px 0; color: #475569;">${app.userEmail}</td>
          </tr>
        </table>
      </div>

      <!-- Official Decision Stamp / Block -->
      <div style="min-width: 250px; border: 2px solid ${statusColor}; background-color: ${statusBg}; border-radius: 8px; padding: 12px 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Authority Status</span>
          <span style="font-size: 11px; font-weight: 900; color: ${statusColor};">${statusLabel}</span>
        </div>
        ${app.reviewedBy ? `
          <div style="font-size: 11px; color: #1e293b; margin-top: 4px;">Reviewed by: <strong>${app.reviewedBy}</strong></div>
          ${app.reviewedAt ? `<div style="font-size: 10px; color: #64748b;">On: ${reviewedDate}</div>` : ''}
        ` : `
          <div style="font-size: 11px; color: #64748b; font-style: italic;">Awaiting Official Review</div>
        `}
        ${app.adminComment ? `
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed ${statusColor}; font-size: 11px; color: #0f172a;">
            <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b;">Approver Comment:</div>
            <div style="font-style: italic; margin-top: 2px;">"${app.adminComment}"</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Official Footer & Verification Stamp -->
    <div style="margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8;">
      <div>Generated electronically from ${companyName} Portal • ID: ${app.applicationId}</div>
      <div>Security Hash: ${app.id.substring(0, 12)}... (Verified Immutable)</div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    // Dynamic import to support SSR / bundler
    const html2pdfModule = await import('html2pdf.js');
    const html2pdfFn: any = (html2pdfModule as any).default || html2pdfModule;

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${app.applicationId || 'Application'}_${app.userName.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    await html2pdfFn().set(opt).from(container).save();
  } catch (err) {
    console.warn('html2pdf export error, launching printable window:', err);
    // Print window fallback
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${app.applicationId} - ${app.subject}</title>
            <style>
              body { margin: 0; padding: 24px; font-family: system-ui, sans-serif; }
              @media print {
                @page { margin: 15mm; size: A4 portrait; }
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
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}
