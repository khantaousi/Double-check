import { ApplicationTemplate } from '../types';

export const DEFAULT_APPLICATION_TEMPLATES: ApplicationTemplate[] = [
  {
    id: 'tpl_paid_leave',
    name: 'Paid Leave',
    typeKey: 'paid_leave',
    defaultRecipient: 'team_leader',
    subjectTemplate: 'Application for Paid Leave',
    fixedOpening: 'Dear Sir/Madam,\n\nI am writing to formally request approval for paid leave as per company leave policy.',
    fixedClosing: 'I will ensure that all my urgent responsibilities and pending deliverables are properly handed over or completed prior to my leave. I kindly request you to approve my leave application.\n\nThank you for your understanding and cooperation.',
    fields: [
      {
        id: 'f_start_date',
        key: 'startDate',
        label: 'Leave Start Date',
        type: 'date',
        required: true,
        helpText: 'First date of absence'
      },
      {
        id: 'f_end_date',
        key: 'endDate',
        label: 'Leave End Date',
        type: 'date',
        required: true,
        helpText: 'Last date of absence'
      },
      {
        id: 'f_total_days',
        key: 'totalDays',
        label: 'Total Days Count',
        type: 'number',
        required: true,
        placeholder: 'e.g. 3'
      },
      {
        id: 'f_reason',
        key: 'reason',
        label: 'Reason for Paid Leave',
        type: 'textarea',
        required: true,
        placeholder: 'Please provide the specific reason for requesting paid leave...'
      },
      {
        id: 'f_emergency_contact',
        key: 'emergencyContact',
        label: 'Emergency Contact & Phone',
        type: 'text',
        required: false,
        placeholder: 'e.g. +880 17XXXXXXXX'
      },
      {
        id: 'f_handover',
        key: 'handoverPlan',
        label: 'Work Handover / Backup Colleague',
        type: 'text',
        required: false,
        placeholder: 'Name of colleague covering tasks if applicable'
      }
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'tpl_casual_leave',
    name: 'Casual Leave',
    typeKey: 'casual_leave',
    defaultRecipient: 'squad_leader',
    subjectTemplate: 'Application for Casual Leave',
    fixedOpening: 'Dear Sir/Madam,\n\nI would like to request casual leave due to personal and urgent circumstances.',
    fixedClosing: 'I will make every effort to attend to any critical emergency communications if needed. I respectfully request your kind approval for this leave.\n\nThank you for your consideration.',
    fields: [
      {
        id: 'f_start_date',
        key: 'startDate',
        label: 'Leave Date / From',
        type: 'date',
        required: true
      },
      {
        id: 'f_end_date',
        key: 'endDate',
        label: 'Leave Until (End Date)',
        type: 'date',
        required: true
      },
      {
        id: 'f_total_days',
        key: 'totalDays',
        label: 'Total Number of Days',
        type: 'number',
        required: true,
        placeholder: 'e.g. 1'
      },
      {
        id: 'f_reason',
        key: 'reason',
        label: 'Reason for Casual Leave',
        type: 'textarea',
        required: true,
        placeholder: 'Explain the personal/family urgency...'
      },
      {
        id: 'f_emergency_phone',
        key: 'emergencyPhone',
        label: 'Emergency Phone Number',
        type: 'text',
        required: false,
        placeholder: '+880 1XXXXXXXXX'
      }
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'tpl_reassignment',
    name: 'Reassignment / Shift Change',
    typeKey: 'reassignment',
    defaultRecipient: 'team_leader',
    subjectTemplate: 'Application for Duty / Shift Reassignment',
    fixedOpening: 'Dear Sir/Madam,\n\nI am writing to formally request a reassignment of my current duty station / work shift.',
    fixedClosing: 'I assure you that this adjustment will not affect my performance and productivity. I hope you will kindly consider my request and approve the requested shift change.\n\nThank you for your support.',
    fields: [
      {
        id: 'f_current_shift',
        key: 'currentShift',
        label: 'Current Shift / Roster Slot',
        type: 'text',
        required: true,
        placeholder: 'e.g. Morning Shift (8 AM - 4 PM)'
      },
      {
        id: 'f_preferred_shift',
        key: 'preferredShift',
        label: 'Desired Shift / Roster Slot',
        type: 'text',
        required: true,
        placeholder: 'e.g. Evening Shift (4 PM - 12 AM)'
      },
      {
        id: 'f_effective_date',
        key: 'effectiveDate',
        label: 'Effective Date From',
        type: 'date',
        required: true
      },
      {
        id: 'f_reason',
        key: 'reason',
        label: 'Reason for Reassignment Request',
        type: 'textarea',
        required: true,
        placeholder: 'Detailed explanation of why this shift change is necessary...'
      }
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'tpl_day_off_exchange',
    name: 'Day Off Exchange',
    typeKey: 'day_off_exchange',
    defaultRecipient: 'squad_leader',
    subjectTemplate: 'Application for Day Off Exchange',
    fixedOpening: 'Dear Sir/Madam,\n\nI am writing to request a mutual or designated exchange of my weekly scheduled day off.',
    fixedClosing: 'Both parties agree to this schedule exchange, and all assigned desk obligations will be covered smoothly. I kindly request your authorization.\n\nThank you.',
    fields: [
      {
        id: 'f_scheduled_off',
        key: 'scheduledOffDate',
        label: 'Original Scheduled Day Off',
        type: 'date',
        required: true
      },
      {
        id: 'f_requested_off',
        key: 'requestedOffDate',
        label: 'Requested New Day Off',
        type: 'date',
        required: true
      },
      {
        id: 'f_colleague_name',
        key: 'colleagueName',
        label: 'Exchanging Colleague Name (if mutual)',
        type: 'text',
        required: false,
        placeholder: 'e.g. Md. Hasan (Agent ID: 1042)'
      },
      {
        id: 'f_reason',
        key: 'reason',
        label: 'Reason for Exchange',
        type: 'textarea',
        required: true,
        placeholder: 'State the personal necessity...'
      }
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'tpl_salary_advance',
    name: 'Salary Advance',
    typeKey: 'salary_advance',
    defaultRecipient: 'hr_admin',
    subjectTemplate: 'Application for Salary Advance',
    fixedOpening: 'Dear Sir/Madam,\n\nI am submitting this formal application to request an advance payment from my upcoming monthly salary.',
    fixedClosing: 'I hereby authorize the management to adjust and deduct this advance amount from my salary as per the agreed schedule. I would be deeply grateful for your kind approval in this urgent situation.\n\nThank you for your consideration.',
    fields: [
      {
        id: 'f_advance_amount',
        key: 'advanceAmount',
        label: 'Requested Advance Amount (BDT)',
        type: 'number',
        required: true,
        placeholder: 'e.g. 5000'
      },
      {
        id: 'f_adjustment_month',
        key: 'adjustmentMonth',
        label: 'Salary Month for Deduction',
        type: 'text',
        required: true,
        placeholder: 'e.g. Next Month Salary (October 2026)'
      },
      {
        id: 'f_reason',
        key: 'reason',
        label: 'Reason for Advance Request',
        type: 'textarea',
        required: true,
        placeholder: 'Detailed explanation of personal urgency or medical necessity...'
      }
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'tpl_permission_request',
    name: 'Permission Request / Short Leave',
    typeKey: 'permission_request',
    defaultRecipient: 'squad_leader',
    subjectTemplate: 'Application for Official Short Leave Permission',
    fixedOpening: 'Dear Sir/Madam,\n\nI am requesting official permission to be temporarily away from my desk during work hours.',
    fixedClosing: 'I will ensure all urgent issues are handled before I step out and will resume my full duties immediately upon returning. I respectfully ask for your permission.\n\nThank you.',
    fields: [
      {
        id: 'f_permission_date',
        key: 'permissionDate',
        label: 'Permission Date',
        type: 'date',
        required: true
      },
      {
        id: 'f_start_time',
        key: 'startTime',
        label: 'From Time',
        type: 'text',
        required: true,
        placeholder: 'e.g. 02:00 PM'
      },
      {
        id: 'f_end_time',
        key: 'endTime',
        label: 'To Time',
        type: 'text',
        required: true,
        placeholder: 'e.g. 04:00 PM'
      },
      {
        id: 'f_reason',
        key: 'reason',
        label: 'Purpose / Reason',
        type: 'textarea',
        required: true,
        placeholder: 'State the specific emergency reason...'
      }
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'tpl_resignation',
    name: 'Resignation Letter',
    typeKey: 'resignation',
    defaultRecipient: 'hr_admin',
    subjectTemplate: 'Formal Notice of Resignation',
    fixedOpening: 'Dear Sir/Madam,\n\nPlease accept this letter as formal notification that I am resigning from my position at the company.',
    fixedClosing: 'I am sincerely grateful for the opportunities and professional experience I have had during my tenure here. I intend to fulfill all required notice period requirements and provide complete handover support to ensure a seamless transition for the team.\n\nThank you for your guidance and support.\n\nRespectfully submitted,',
    fields: [
      {
        id: 'f_notice_date',
        key: 'noticeDate',
        label: 'Notice Submission Date',
        type: 'date',
        required: true
      },
      {
        id: 'f_last_working_day',
        key: 'lastWorkingDay',
        label: 'Proposed Last Working Day',
        type: 'date',
        required: true
      },
      {
        id: 'f_reason',
        key: 'reason',
        label: 'Reason for Resignation (Optional)',
        type: 'textarea',
        required: false,
        placeholder: 'e.g. Personal reasons, higher studies, or career transition...'
      },
      {
        id: 'f_handover_notes',
        key: 'handoverNotes',
        label: 'Handover & Knowledge Transfer Plan',
        type: 'textarea',
        required: false,
        placeholder: 'Overview of current assignments, documents, and transition steps...'
      }
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];
