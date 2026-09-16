/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ValidationRule {
  id: string;
  min: number;
  max: number;
  percentage: number;
}

export interface ProductPrice {
  id: string;
  name: string;
  price: number;
  wholesalePrice?: number;
  wholesaleThreshold?: number;
}

export interface UserProfile {
  id?: string;
  email: string;
  loginHandle?: string; // Custom ID or Name for login
  password?: string;    // Only if using custom simple login, but let's stick to status first
  role: 'admin' | 'user';
  displayName?: string;
  employeeId?: string;  // Employee ID for personnel
  photoURL?: string;
  birthday?: string; // Standard YYYY-MM-DD
  joiningDate?: string; // Standard YYYY-MM-DD custom joining date
  createdAt: string;
  isActive: boolean;    // For activating/deactivating users
  lastSeen?: string;    // ISO string of last activity
  isOnline?: boolean;   // Current online status
  department?: string;  // e.g. 'Data & Delivery', 'DA Team', 'HR & Admin', etc.
  designation?: string; // e.g. 'Senior Data Specialist', 'Team Leader', etc.
  userRoleType?: 'user' | 'squad_leader' | 'team_leader' | 'hr_admin'; // Authority tier for application approvals
  permissions?: {
    dashboard: 'none' | 'read' | 'write';
    rules: 'none' | 'read' | 'write';
    products: 'none' | 'read' | 'write';
    settings: 'none' | 'read' | 'write';
    tracker: 'none' | 'read' | 'write';
    printSlips: 'none' | 'read' | 'write';
  };
}

export interface GiftRule {
  id: string;
  name: string;
  triggerKeywords: string[];
  targetKeywords: string[];
  isActive: boolean;
}

export interface DataRow {
  id: string;
  InvoiceNo: string;
  ItemType: string;
  StoreName: string;
  MerchantOrderId: string;
  RecipientName: string;
  RecipientPhone: string;
  RecipientAddress: string;
  RecipientCity: string;
  RecipientZone: string;
  RecipientArea: string;
  AmountToCollect: number;
  ItemQuantity: number;
  ItemWeight: string;
  ItemDesc: string;
  SpecialInstruction: string;
  // Calculated fields
  extractedBasePrice?: number;
  calculatedTotal?: number;
  isMismatch?: boolean;
  isInvalid?: boolean;
  isDuplicate?: boolean;
  isWholesale?: boolean;
  isPermitted?: boolean;
  notes?: string[];
}

export interface TaskHistoryEntry {
  status: TeamTask['status'] | 'approved' | 'rejected' | 'created' | 'resent';
  timestamp: string;
  performerId: string;
  performerName: string;
  note?: string;
}

export interface AppNotice {
  id?: string;
  title: string;
  message: string;
  createdAt: string;
  expiresAt?: string;
  scrollSpeedSeconds?: number;
  createdBy: string;
  viewers: { userId: string; userName: string; viewedAt: string }[];
}

export interface PhoneDevice {
  id: string;
  name: string; // e.g. "Phone A (Redmi Note 12)", "Phone 1", "iPhone 13"
  modelNumber?: string;
  simNumber?: string;
  currentHolderId?: string; // userId of current active holder
  currentHolderName?: string;
  currentHolderEmpId?: string;
  status: 'available' | 'in_use' | 'pending_handover' | 'maintenance';
  pendingHandoverToId?: string;
  pendingHandoverToName?: string;
  pendingHandoverToEmpId?: string;
  pendingHandoverAt?: string;
  pendingHandoverNote?: string;
  pendingSenderMissedCalls?: number;
  pendingSenderReturnedCalls?: number;
  pendingRequestType?: 'holder_initiated' | 'receiver_requested';
  currentSessionStart?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PhoneUsageLog {
  id: string;
  phoneId: string;
  phoneName: string;
  userId: string;
  userName: string;
  userEmpId?: string;
  startTime: string; // ISO string
  endTime?: string; // ISO string when handed over or released
  durationMinutes?: number;
  status: 'active' | 'completed' | 'handed_over';
  handoverToId?: string;
  handoverToName?: string;
  handoverToEmpId?: string;
  handoverApprovedAt?: string;
  senderMissedCalls?: number;
  senderReturnedCalls?: number;
  receiverMissedCalls?: number;
  receiverReturnedCalls?: number;
  verificationMismatch?: boolean;
  receiverNote?: string;
  note?: string;
  createdAt: string;
}

export interface PhoneDeletionAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  adminEmpId?: string;
  adminEmail?: string;
  actionType: 'delete_history_log' | 'bulk_delete_history_logs' | 'delete_device';
  deletedSummary: string;
  deletedDetails?: string;
  itemCount: number;
  timestamp: string;
  createdAt: string;
}

export interface AppNotification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'task_approved' | 'task_needs_approval' | 'task_resent' | 'system' | 'phone_handover';
  isRead: boolean;
  createdAt: string;
  taskId?: string;
  phoneId?: string;
  logId?: string;
}

export interface TeamTask {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;
  assigneeName: string;
  status: 'pending' | 'in-progress' | 'completed' | 'paused';
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  totalPauseMinutes?: number;
  lastPausedAt?: string;
  resumedAt?: string;
  createdBy: string;
  order?: number;
  isEveryday?: boolean;
  isSelfAssigned?: boolean;
  isHistorySnapshot?: boolean;
  isApproved?: boolean;
  isRejected?: boolean;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  history?: TaskHistoryEntry[];
}

export interface DeliverySettings {
  insideDhaka: number;
  outsideDhaka: number;
}

export interface SiteSettings {
  companyName: string;
  amountTolerance: number;
  permissionKeywords: string[];
  logoUrl?: string;
  customAmountRule?: string;
  combineBaseRulesWithAI?: boolean;
  theme?: string;
  isDoubleCheckEnabled?: boolean;
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  insideDhaka: 80,
  outsideDhaka: 140
};

export interface SalaryApiConfig {
  apiUrl: string;
  apiKey: string;
  authHeaderType: 'Bearer' | 'ApiKey' | 'Token' | 'RawAuth' | 'QueryParam' | 'Custom' | 'None';
  customHeaderName?: string;
  queryParamName?: string;
  paramName: string;
  httpMethod: 'GET' | 'POST';
  idField: 'employeeId' | 'email' | 'loginHandle';
  isActive: boolean;
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_SALARY_API_CONFIG: SalaryApiConfig = {
  apiUrl: '',
  apiKey: '',
  authHeaderType: 'ApiKey',
  customHeaderName: 'X-API-KEY',
  queryParamName: 'api_key',
  paramName: 'employee_id',
  httpMethod: 'GET',
  idField: 'employeeId',
  isActive: true,
  notes: ''
};

export interface SalaryBreakdownItem {
  label: string;
  amount: number;
  type: 'earning' | 'deduction';
}

export interface SalaryRecord {
  employeeId: string;
  employeeName?: string;
  month?: string;
  year?: string | number;
  basicSalary?: number;
  grossSalary?: number;
  netSalary: number;
  totalEarnings?: number;
  totalDeductions?: number;
  bonuses?: number;
  allowances?: number;
  overtime?: number;
  deductions?: number;
  tax?: number;
  providentFund?: number;
  paymentStatus?: 'Paid' | 'Pending' | 'Processing' | 'On Hold';
  paymentDate?: string;
  paymentMethod?: string;
  bankAccountOrMfs?: string;
  breakdown?: SalaryBreakdownItem[];
  slipUrl?: string;
  remarks?: string;
  rawResponse?: any;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  companyName: 'Parcel Intelligence',
  amountTolerance: 5,
  permissionKeywords: ['permit', 'permit by', 'permitted by', 'permitted', 'authorized', 'boss ok', 'leader ok'],
  logoUrl: '',
  combineBaseRulesWithAI: false,
  theme: 'classic-blue',
  isDoubleCheckEnabled: true
};

export const DEFAULT_RULES: ValidationRule[] = [
  { id: '1', min: 1500, max: 2100, percentage: 11 },
  { id: '2', min: 2101, max: 3199, percentage: 12 },
];

export const REQUIRED_HEADERS = [
  'ItemType', 'StoreName', 'MerchantOrderId', 'RecipientName(*)', 
  'RecipientPhone(*)', 'RecipientAddress(*)', 'RecipientCity(*)', 
  'RecipientZone(*)', 'RecipientArea', 'AmountToCollect(*)', 
  'ItemQuantity', 'ItemWeight', 'ItemDesc', 'SpecialInstruction'
];

export type ButtonLogoType = 'preset' | 'upload' | 'url';

export interface CustomActionButton {
  id: string;
  title: string;
  description?: string;
  url: string;
  targetAudience: 'all' | 'specific';
  assignedUserEmails: string[];
  assignedUserIds?: string[];
  logoType?: ButtonLogoType;
  logoUrl?: string; // base64 or external image link
  icon?: string; // name of preset icon
  color?: 'blue' | 'emerald' | 'indigo' | 'purple' | 'amber' | 'rose' | 'sky' | 'slate';
  openInNewTab?: boolean;
  createdAt: string;
  createdBy?: string;
  isActive: boolean;
}

export const STANDARD_DEPARTMENTS = [
  'Data & Delivery',
  'DA Team',
  'HR & Admin',
  'Accounts',
  'Sales',
  'Operations',
  'Customer Support',
  'Quality Assurance',
  'IT & Engineering'
];

export type ApplicationRecipient = 'squad_leader' | 'team_leader' | 'hr_admin' | 'operation_lead' | 'management' | 'other' | string;

export type RecipientRoleType = ApplicationRecipient;

export type ApplicationCategory = 'Leave' | 'Shift' | 'Administrative' | 'Financial' | 'Permission' | 'other' | string;

export const RECIPIENT_LABELS: Record<string, string> = {
  squad_leader: 'Squad Leader',
  team_leader: 'Team Leader',
  hr_admin: 'HR & Admin',
  operation_lead: 'Operation Lead',
  management: 'Management',
  other: 'General Authority'
};

export type ApplicationStatus = 'draft' | 'submitted' | 'pending' | 'approved' | 'rejected' | 'archived';

export interface ApplicationTemplateField {
  id: string;
  key?: string;            // unique identifier e.g. 'startDate', 'endDate', 'reason'
  label: string;          // human readable e.g. 'Leave Start Date'
  type: 'text' | 'date' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];     // for select type
  defaultValue?: string;
  helpText?: string;
}

export type ApplicationCustomField = ApplicationTemplateField;

export interface ApplicationTemplate {
  id: string;
  name: string;           // e.g. 'Paid Leave', 'Casual Leave', 'Salary Advance'
  typeKey?: string;        // e.g. 'paid_leave', 'casual_leave', 'reassignment'
  category?: ApplicationCategory;
  defaultRecipient?: ApplicationRecipient;
  defaultRecipientRole?: ApplicationRecipient;
  subjectTemplate: string;// e.g. 'Application for Paid Leave'
  salutation?: string;    // Salutation e.g. 'Dear Sir/Madam,'
  fixedOpening?: string;   // Salutation and opening statement
  bodyTemplate?: string;   // Body template text
  fixedClosing?: string;   // Formal closing statement
  closing?: string;        // Formal closing statement e.g. 'Sincerely,'
  fields: ApplicationTemplateField[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface EmployeeApplication {
  id: string;                   // Firestore document ID
  applicationId: string;        // Official formatted human ID: e.g. 'APP-2026-000001' or 'DRAFT-...'
  templateId: string;
  templateName?: string;
  applicationType?: string;      // e.g. 'Paid Leave', 'Casual Leave', etc.
  category?: string;
  templateTypeKey?: string;
  
  // Recipient Information
  recipient?: ApplicationRecipient;
  recipientRole?: string;
  recipientName?: string;
  recipientTitle?: string;       // e.g. 'Team Leader', 'Squad Leader', 'HR & Admin'
  recipientDepartment?: string; // e.g. 'Data & Delivery Team' or Company Name
  
  // Read-only Applicant Details (Frozen Snapshot at submission time)
  userId: string;               // Auth UID
  employeeId: string;           // Employee ID / User ID
  userName: string;             // Full Name
  department?: string;          // Department (permanent snapshot)
  applicantDepartment?: string; // Synonym for department
  designation?: string;         // Designation (permanent snapshot)
  userEmail: string;
  
  // Application Letter Content
  subject: string;
  salutation?: string;
  body: string;                 // Full generated letter body text
  closing?: string;
  fieldValues: Record<string, any>; // Editable fields entered by applicant
  
  // Workflow & Status
  status: ApplicationStatus;
  isLocked: boolean;            // True once submitted (read-only forever for user)
  submittedAt?: string;         // ISO timestamp of submission
  createdAt: string;
  updatedAt?: string;
  
  // Approver Review & Audit
  reviewedBy?: string;          // Approver display name
  reviewerId?: string;          // Approver user UID
  reviewerRole?: string;        // Approver role/title
  reviewedAt?: string;          // ISO timestamp of review
  adminComment?: string;        // Official remark / note / feedback
  
  // Archive/Soft Delete flag
  isArchived?: boolean;
}


