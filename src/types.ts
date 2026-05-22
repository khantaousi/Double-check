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
  createdAt: string;
  isActive: boolean;    // For activating/deactivating users
  lastSeen?: string;    // ISO string of last activity
  isOnline?: boolean;   // Current online status
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

export interface AppNotification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'task_assigned' | 'task_approved' | 'task_needs_approval' | 'task_resent' | 'system';
  isRead: boolean;
  createdAt: string;
  taskId?: string;
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
}

export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  insideDhaka: 80,
  outsideDhaka: 140
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  companyName: 'Parcel Intelligence',
  amountTolerance: 5,
  permissionKeywords: ['permit', 'permit by', 'permitted by', 'permitted', 'authorized', 'boss ok', 'leader ok'],
  logoUrl: '',
  combineBaseRulesWithAI: false
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
