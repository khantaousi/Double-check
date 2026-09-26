import { ApplicationRecipient, ApplicationTemplate, EmployeeApplication, RECIPIENT_LABELS } from '../types';

/**
 * Format date nicely for official letters
 */
export function formatOfficialDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Render complete official letter body based on template and user-entered field values
 */
export function renderApplicationBody(
  templateOrText: ApplicationTemplate | string | undefined,
  fieldValues: Record<string, any> = {},
  applicantDetails?: {
    userName?: string;
    userEmail?: string;
    employeeId?: string;
    department?: string;
    designation?: string;
  }
): string {
  if (!templateOrText) return '';

  if (typeof templateOrText === 'string') {
    let result = templateOrText;
    
    // Replace user profile placeholders
    if (applicantDetails) {
      result = result
        .replace(/\{userName\}/g, applicantDetails.userName || '')
        .replace(/\{name\}/g, applicantDetails.userName || '')
        .replace(/\{userEmail\}/g, applicantDetails.userEmail || '')
        .replace(/\{email\}/g, applicantDetails.userEmail || '')
        .replace(/\{employeeId\}/g, applicantDetails.employeeId || '')
        .replace(/\{department\}/g, applicantDetails.department || '')
        .replace(/\{designation\}/g, applicantDetails.designation || '');
    }

    // Replace field values
    Object.entries(fieldValues).forEach(([key, val]) => {
      const formatted = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)
        ? formatOfficialDate(val)
        : String(val ?? '');
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), formatted);
    });

    return result;
  }

  // If passed an ApplicationTemplate object
  const template = templateOrText;
  if (template.bodyTemplate) {
    return renderApplicationBody(template.bodyTemplate, fieldValues, applicantDetails);
  }

  const sections: string[] = [];

  // Opening
  if (template.fixedOpening) {
    sections.push(template.fixedOpening);
  }

  // Field details block
  const fieldLines: string[] = [];
  (template.fields || []).forEach(field => {
    const fieldKey = field.key || field.id;
    const rawVal = fieldValues[fieldKey];
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      let displayVal = String(rawVal);
      if (field.type === 'date') {
        displayVal = formatOfficialDate(displayVal);
      }
      fieldLines.push(`• ${field.label}: ${displayVal}`);
    }
  });

  if (fieldLines.length > 0) {
    sections.push('Particulars & Details:\n' + fieldLines.join('\n'));
  }

  // Closing
  if (template.fixedClosing) {
    sections.push(template.fixedClosing);
  }

  return sections.join('\n\n');
}

/**
 * Generate official recipient header
 */
export function formatRecipientBlock(
  recipient: ApplicationRecipient,
  userDepartment?: string,
  companyName: string = 'Vics Ventures'
): { title: string; subtitle: string } {
  const title = RECIPIENT_LABELS[recipient] || 'Team Leader';
  let subtitle = '';

  if (recipient === 'squad_leader') {
    subtitle = userDepartment ? `${userDepartment} Squad` : 'Operations Squad';
  } else if (recipient === 'team_leader') {
    subtitle = userDepartment ? `${userDepartment} Team` : 'Data & Delivery Team';
  } else {
    subtitle = `HR & Administration, ${companyName}`;
  }

  return { title, subtitle };
}

/**
 * Generate sequential Application ID
 * Format: APP-YYYY-000001
 */
export function generateNextApplicationId(currentMaxNumber: number = 0): string {
  const year = new Date().getFullYear();
  const nextNum = currentMaxNumber + 1;
  const padded = String(nextNum).padStart(6, '0');
  return `APP-${year}-${padded}`;
}

/**
 * Check if a user can approve/reject an application based on their role and recipient
 */
/**
 * Clean application category or template name to guarantee pure, crisp English text
 * and remove any Bengali text, Bengali Unicode characters (\u0980-\u09FF), or corrupted bracketed notes.
 */
export function cleanApplicationCategory(category?: string, fallbackName?: string): string {
  const target = (category || fallbackName || '').trim();
  if (/salary\s*advance/i.test(target) || target === 'salary_advance') {
    return 'Salary Advance';
  }
  if (/paid\s*leave/i.test(target) || target === 'paid_leave') {
    return 'Paid Leave';
  }
  if (/casual\s*leave/i.test(target) || target === 'casual_leave') {
    return 'Casual Leave';
  }
  if (/resignation/i.test(target) || target === 'resignation') {
    return 'Resignation';
  }
  if (/reassign/i.test(target) || target === 'reassignment') {
    return 'Reassignment';
  }
  if (/day\s*off/i.test(target) || target === 'day_off') {
    return 'Day Off Exchange';
  }
  if (/permission/i.test(target) || target === 'permission') {
    return 'Permission Request';
  }
  const cleaned = target
    .replace(/\s*\([^)]*[\u0980-\u09FF][^)]*\)/g, '')
    .replace(/[\u0980-\u09FF]/g, '')
    .replace(/\s*\(\s*\)/g, '')
    .replace(/[-_]/g, ' ')
    .trim();

  return cleaned || 'General Application';
}

export function cleanTemplateName(name?: string): string {
  if (!name) return 'Application';
  if (/salary\s*advance/i.test(name)) return 'Salary Advance';
  if (/paid\s*leave/i.test(name)) return 'Paid Leave';
  if (/casual\s*leave/i.test(name)) return 'Casual Leave';
  if (/resignation/i.test(name)) return 'Resignation';
  if (/reassign/i.test(name)) return 'Reassignment';
  if (/day\s*off/i.test(name)) return 'Day Off Exchange';
  if (/permission/i.test(name)) return 'Permission Request';
  const cleaned = name
    .replace(/\s*\([^)]*[\u0980-\u09FF][^)]*\)/g, '')
    .replace(/[\u0980-\u09FF]/g, '')
    .replace(/\s*\(\s*\)/g, '')
    .trim();
  return cleaned || 'Application';
}

export function canUserApproveApplication(
  userRole: 'admin' | 'user',
  userRoleType?: 'user' | 'squad_leader' | 'team_leader' | 'hr_admin',
  userDepartment?: string,
  applicationRecipient?: ApplicationRecipient,
  appDepartment?: string
): boolean {
  // Admin & HR can approve anything
  if (userRole === 'admin' || userRoleType === 'hr_admin' || userDepartment === 'HR & Admin') {
    return true;
  }

  // Team leader can approve applications addressed to Team Leader or Squad Leader
  if (userRoleType === 'team_leader') {
    if (applicationRecipient === 'team_leader' || applicationRecipient === 'squad_leader') {
      // If departments match or open
      return !appDepartment || !userDepartment || appDepartment === userDepartment;
    }
  }

  // Squad leader can approve applications addressed to Squad Leader
  if (userRoleType === 'squad_leader') {
    if (applicationRecipient === 'squad_leader') {
      return !appDepartment || !userDepartment || appDepartment === userDepartment;
    }
  }

  return false;
}
