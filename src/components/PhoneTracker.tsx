import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  PhoneDevice, 
  PhoneUsageLog, 
  PhoneDeletionAuditLog,
  UserProfile 
} from '../types';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDocs,
  where,
  writeBatch
} from 'firebase/firestore';
import { getBSTISOString, formatBST, cleanObject } from '../lib/utils';
import { 
  Smartphone, 
  Plus, 
  ArrowRightLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Search, 
  UserCheck, 
  History, 
  PowerOff, 
  Trash2, 
  Edit3, 
  SmartphoneCharging, 
  PhoneForwarded,
  Timer,
  PhoneMissed,
  PhoneCall,
  AlertTriangle,
  CheckCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

interface PhoneTrackerProps {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  isAdmin: boolean;
}

export const PhoneTracker: React.FC<PhoneTrackerProps> = ({
  currentUser,
  allUsers,
  isAdmin
}) => {
  const [devices, setDevices] = useState<PhoneDevice[]>(() => {
    try {
      const saved = localStorage.getItem('cached_phone_devices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [logs, setLogs] = useState<PhoneUsageLog[]>(() => {
    try {
      const saved = localStorage.getItem('cached_phone_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [deletionLogs, setDeletionLogs] = useState<PhoneDeletionAuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('cached_phone_deletion_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'devices' | 'history' | 'my_phones' | 'deletion_logs'>('devices');

  // Super-Admin 2146 Identity Check (Only this user can delete the audit logs)
  const isSuperAdmin2146 = useMemo(() => {
    if (!currentUser) return false;
    const empId = String(currentUser.employeeId || '').trim();
    const handle = String(currentUser.loginHandle || '').trim();
    const email = String(currentUser.email || '').trim().toLowerCase();
    return empId === '2146' || handle === '2146' || email === 'khantaousi@gmail.com';
  }, [currentUser]);

  // Modal States - Add/Edit Device (Admin Only)
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PhoneDevice | null>(null);
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [deviceModelInput, setDeviceModelInput] = useState('');
  const [deviceSimInput, setDeviceSimInput] = useState('');
  const [deviceActionLoading, setDeviceActionLoading] = useState(false);

  // Modal States - Sender Handover Modal
  const [handoverDevice, setHandoverDevice] = useState<PhoneDevice | null>(null);
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>('');
  const [targetEmpIdInput, setTargetEmpIdInput] = useState('');
  const [senderMissedCallsInput, setSenderMissedCallsInput] = useState<string>('0');
  const [senderReturnedCallsInput, setSenderReturnedCallsInput] = useState<string>('0');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverLoading, setHandoverLoading] = useState(false);

  // Modal States - Receiver Approval Verification Modal
  const [approvingDevice, setApprovingDevice] = useState<PhoneDevice | null>(null);
  const [receiverMissedCallsInput, setReceiverMissedCallsInput] = useState<string>('0');
  const [receiverReturnedCallsInput, setReceiverReturnedCallsInput] = useState<string>('0');
  const [receiverVerificationNote, setReceiverVerificationNote] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  // Modal States - Agent Requests/Claims a Phone Currently In Use
  const [claimDevice, setClaimDevice] = useState<PhoneDevice | null>(null);
  const [claimRequestNote, setClaimRequestNote] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // Modal States - Current Holder Approves Claim Request from another Agent
  const [approvingClaimDevice, setApprovingClaimDevice] = useState<PhoneDevice | null>(null);
  const [holderMissedCallsInput, setHolderMissedCallsInput] = useState<string>('0');
  const [holderReturnedCallsInput, setHolderReturnedCallsInput] = useState<string>('0');
  const [holderApprovalNote, setHolderApprovalNote] = useState('');
  const [holderApproveLoading, setHolderApproveLoading] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoneFilter, setSelectedPhoneFilter] = useState<string>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Realtime Live Timer Tick & 24h Auto-Unassign Check
  const [, setTick] = useState(0);
  const isAutoUnassigningRef = useRef(false);

  // Helper: Auto-unassign phones after 24 hours of usage so that any agent can take/assign them
  const checkAndAutoUnassignExpiredDevices = useCallback(async (devList: PhoneDevice[]) => {
    if (!currentUser || !isAdmin || isAutoUnassigningRef.current) return;
    const nowMs = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    const expired = devList.filter(dev => {
      if (dev.status === 'available') return false;
      if (!dev.currentSessionStart) return false;
      const startMs = new Date(dev.currentSessionStart).getTime();
      return !isNaN(startMs) && (nowMs - startMs >= TWENTY_FOUR_HOURS_MS);
    });

    if (expired.length === 0) return;

    try {
      isAutoUnassigningRef.current = true;
      const now = getBSTISOString();
      const batch = writeBatch(db);

      for (const dev of expired) {
        const devRef = doc(db, 'phone_devices', dev.id);
        batch.update(devRef, {
          status: 'available',
          currentHolderId: null,
          currentHolderName: null,
          currentHolderEmpId: null,
          currentSessionStart: null,
          pendingHandoverToId: null,
          pendingHandoverToName: null,
          pendingHandoverToEmpId: null,
          pendingHandoverAt: null,
          pendingHandoverNote: null,
          pendingSenderMissedCalls: null,
          pendingSenderReturnedCalls: null,
          updatedAt: now
        });

        const activeLogsSnap = await getDocs(query(
          collection(db, 'phone_usage_logs'),
          where('phoneId', '==', dev.id),
          where('status', '==', 'active')
        ));

        activeLogsSnap.forEach(docSnap => {
          const logData = docSnap.data() as PhoneUsageLog;
          const startMs = new Date(logData.startTime).getTime();
          const endMs = new Date(now).getTime();
          const durationMins = Math.round(Math.max(0, endMs - startMs) / 60000);

          batch.update(docSnap.ref, cleanObject({
            endTime: now,
            durationMinutes: durationMins,
            status: 'completed',
            note: logData.note 
              ? `${logData.note} (Auto-unassigned after 24h)` 
              : 'Auto-unassigned after 24 hours'
          }));
        });
      }

      await batch.commit();
    } catch (err: any) {
      const errStr = String(err?.message || err).toLowerCase();
      if (!errStr.includes('quota') && !errStr.includes('resource-exhausted')) {
        console.warn("Auto-unassign check note:", err);
      }
    } finally {
      setTimeout(() => {
        isAutoUnassigningRef.current = false;
      }, 60000); // Debounce at least 1 minute
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to Phone Devices
  useEffect(() => {
    const unsubDevices = onSnapshot(collection(db, 'phone_devices'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhoneDevice[];
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setDevices(list);
      try { localStorage.setItem('cached_phone_devices', JSON.stringify(list)); } catch (e) {}
      setLoading(false);
    }, (err: any) => {
      try {
        const cached = localStorage.getItem('cached_phone_devices');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setDevices(parsed);
        }
      } catch (e) {}
      const errStr = String(err?.message || err).toLowerCase();
      if (!errStr.includes('quota') && !errStr.includes('resource-exhausted')) {
        console.warn("Phone devices note:", err);
      }
      setLoading(false);
    });

    return () => unsubDevices();
  }, []);

  // Listen to Phone Usage Logs
  useEffect(() => {
    const unsubLogs = onSnapshot(collection(db, 'phone_usage_logs'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhoneUsageLog[];
      list.sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());
      setLogs(list);
      try { localStorage.setItem('cached_phone_logs', JSON.stringify(list)); } catch (e) {}
    }, (err: any) => {
      try {
        const cached = localStorage.getItem('cached_phone_logs');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setLogs(parsed);
        }
      } catch (e) {}
      const errStr = String(err?.message || err).toLowerCase();
      if (!errStr.includes('quota') && !errStr.includes('resource-exhausted')) {
        console.warn("Phone usage logs note:", err);
      }
    });

    return () => unsubLogs();
  }, []);

  // Listen to Deletion Audit Logs (Admin only)
  useEffect(() => {
    if (!isAdmin) return;
    const unsubAudit = onSnapshot(collection(db, 'phone_deletion_logs'), (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhoneDeletionAuditLog[];
      list.sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime());
      setDeletionLogs(list);
      try { localStorage.setItem('cached_phone_deletion_logs', JSON.stringify(list)); } catch (e) {}
    }, (err: any) => {
      try {
        const cached = localStorage.getItem('cached_phone_deletion_logs');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setDeletionLogs(parsed);
        }
      } catch (e) {}
      const errStr = String(err?.message || err).toLowerCase();
      if (!errStr.includes('quota') && !errStr.includes('resource-exhausted')) {
        console.warn("Phone deletion logs note:", err);
      }
    });

    return () => unsubAudit();
  }, [isAdmin]);

  // Helper: calculate live duration in minutes and format
  const formatDuration = (startTimeStr: string, endTimeStr?: string) => {
    try {
      const start = new Date(startTimeStr).getTime();
      const end = endTimeStr ? new Date(endTimeStr).getTime() : Date.now();
      const diffMs = Math.max(0, end - start);
      const totalMinutes = Math.floor(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m (${totalMinutes} min)`;
      }
      return `${totalMinutes} min`;
    } catch {
      return '--';
    }
  };

  // 1. Admin: Create or Update Phone Device (Admin Only)
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("Only admins are authorized to add or edit phone devices.");
      return;
    }
    if (!deviceNameInput.trim()) return;
    setDeviceActionLoading(true);

    try {
      if (editingDevice) {
        // Update
        const ref = doc(db, 'phone_devices', editingDevice.id);
        await updateDoc(ref, cleanObject({
          name: deviceNameInput.trim(),
          modelNumber: deviceModelInput.trim() || undefined,
          simNumber: deviceSimInput.trim() || undefined,
          updatedAt: getBSTISOString()
        }));
      } else {
        // Create new
        const newDocRef = doc(collection(db, 'phone_devices'));
        const newDevice: PhoneDevice = {
          id: newDocRef.id,
          name: deviceNameInput.trim(),
          modelNumber: deviceModelInput.trim() || undefined,
          simNumber: deviceSimInput.trim() || undefined,
          status: 'available',
          createdAt: getBSTISOString()
        };
        await setDoc(newDocRef, cleanObject(newDevice));
      }

      setShowAddDeviceModal(false);
      setEditingDevice(null);
      setDeviceNameInput('');
      setDeviceModelInput('');
      setDeviceSimInput('');
    } catch (err) {
      console.error("Error saving phone device:", err);
      alert("Failed to save device. Please try again.");
    } finally {
      setDeviceActionLoading(false);
    }
  };

  // Helper: Record an Audit Log when an Admin Deletes Something
  const recordDeletionAudit = async (
    actionType: 'delete_history_log' | 'bulk_delete_history_logs' | 'delete_device',
    deletedSummary: string,
    deletedDetails?: string,
    itemCount: number = 1
  ) => {
    if (!currentUser) return;
    try {
      const auditRef = doc(collection(db, 'phone_deletion_logs'));
      const adminName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
      const adminEmpId = currentUser.employeeId || currentUser.loginHandle || '';
      const now = getBSTISOString();
      const auditLog: PhoneDeletionAuditLog = {
        id: auditRef.id,
        adminId: currentUser.id || currentUser.email,
        adminName,
        adminEmpId,
        adminEmail: currentUser.email,
        actionType,
        deletedSummary,
        deletedDetails: deletedDetails || '',
        itemCount,
        timestamp: now,
        createdAt: now
      };
      await setDoc(auditRef, cleanObject(auditLog));
    } catch (err) {
      console.error("Error recording deletion audit log:", err);
    }
  };

  const handleDeleteDevice = async (deviceId: string, name: string) => {
    if (!isAdmin) {
      alert("Only admins are authorized to delete phone devices.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete "${name}" from devices?`)) return;
    try {
      const targetDev = devices.find(d => d.id === deviceId);
      const summary = `Deleted Phone Device: "${name}" (Model: ${targetDev?.modelNumber || 'N/A'}, SIM: ${targetDev?.simNumber || 'N/A'}, Status: ${targetDev?.status || 'N/A'})`;
      const details = targetDev ? `Device ID: ${targetDev.id} | Holder: ${targetDev.currentHolderName || 'None'} (${targetDev.currentHolderEmpId || 'N/A'})` : '';

      // Optimistically update local state & cache
      setDevices(prev => {
        const updated = prev.filter(d => d.id !== deviceId);
        try { localStorage.setItem('cached_phone_devices', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });

      await deleteDoc(doc(db, 'phone_devices', deviceId));

      await recordDeletionAudit('delete_device', summary, details, 1);
    } catch (err) {
      console.error("Error deleting device:", err);
      alert("Failed to delete device.");
    }
  };

  // Admin: Delete History Usage Log
  const handleDeleteLog = async (logId: string, phoneName?: string, agentName?: string) => {
    if (!isAdmin) {
      alert("Only admins can delete history logs.");
      return;
    }
    const targetLog = logs.find(l => l.id === logId);
    if (!window.confirm(`Are you sure you want to delete this history log for "${phoneName || targetLog?.phoneName || 'Phone'}" (${agentName || targetLog?.userName || 'Agent'})?`)) {
      return;
    }
    try {
      const pName = targetLog?.phoneName || phoneName || 'Phone';
      const aName = targetLog?.userName || agentName || 'Agent';
      const aId = targetLog?.userEmpId || 'N/A';
      const durationStr = targetLog?.durationMinutes ? `${Math.floor(targetLog.durationMinutes / 60)}h ${targetLog.durationMinutes % 60}m` : 'N/A';
      const startStr = targetLog?.startTime ? formatBST(targetLog.startTime) : 'N/A';
      const summary = `Deleted History Record: [${pName}] Used by ${aName} (ID: ${aId}) | Duration: ${durationStr} | Start: ${startStr}`;
      
      const details = targetLog 
        ? `Handover To: ${targetLog.handoverToName || 'None'} (${targetLog.handoverToEmpId || 'N/A'}) | Status: ${targetLog.status} | Sender Missed/Back: ${targetLog.senderMissedCalls ?? '-'}/${targetLog.senderReturnedCalls ?? '-'} | Receiver Missed/Back: ${targetLog.receiverMissedCalls ?? '-'}/${targetLog.receiverReturnedCalls ?? '-'}`
        : '';

      // Optimistically update local state & cache
      setLogs(prev => {
        const updated = prev.filter(l => l.id !== logId);
        try { localStorage.setItem('cached_phone_logs', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });

      await deleteDoc(doc(db, 'phone_usage_logs', logId));

      await recordDeletionAudit('delete_history_log', summary, details, 1);
    } catch (err) {
      console.error("Error deleting history log:", err);
      alert("Failed to delete history log.");
    }
  };

  // Admin: Bulk Delete Filtered History Logs
  const handleBulkDeleteFilteredLogs = async () => {
    if (!isAdmin) return;
    if (filteredLogs.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete all ${filteredLogs.length} filtered history logs? This action cannot be undone.`)) {
      return;
    }
    try {
      const count = filteredLogs.length;
      const sampleNames = filteredLogs.slice(0, 3).map(l => `${l.phoneName} (${l.userName})`).join(', ') + (count > 3 ? ` and ${count - 3} more...` : '');
      const summary = `Bulk Deleted ${count} History Records: Including ${sampleNames}`;
      const details = filteredLogs.map(l => `[${l.phoneName} | Agent: ${l.userName} (${l.userEmpId}) | Start: ${formatBST(l.startTime)} | Duration: ${l.durationMinutes || 0}m]`).join('\n');

      const idsToDelete = new Set(filteredLogs.map(l => l.id));
      
      // Optimistically update local state & cache
      setLogs(prev => {
        const updated = prev.filter(l => !idsToDelete.has(l.id));
        try { localStorage.setItem('cached_phone_logs', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });

      const batch = writeBatch(db);
      filteredLogs.forEach(log => {
        batch.delete(doc(db, 'phone_usage_logs', log.id));
      });
      await batch.commit();

      await recordDeletionAudit('bulk_delete_history_logs', summary, details, count);
    } catch (err) {
      console.error("Error deleting filtered history logs:", err);
      alert("Failed to delete history logs.");
    }
  };

  // Super-Admin 2146 ONLY: Delete a Deletion Audit Log
  const handleDeleteAuditLog = async (auditLogId: string) => {
    if (!isSuperAdmin2146) {
      alert("Permission Denied: Only user 2146 is authorized to delete deletion audit records.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this deletion audit record?")) return;
    try {
      setDeletionLogs(prev => {
        const updated = prev.filter(l => l.id !== auditLogId);
        try { localStorage.setItem('cached_phone_deletion_logs', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });

      await deleteDoc(doc(db, 'phone_deletion_logs', auditLogId));
    } catch (err) {
      console.error("Error deleting audit log:", err);
      alert("Failed to delete audit record.");
    }
  };

  // Super-Admin 2146 ONLY: Bulk Delete All Deletion Audit Logs
  const handleBulkDeleteAuditLogs = async () => {
    if (!isSuperAdmin2146) {
      alert("Permission Denied: Only user 2146 is authorized to delete deletion audit records.");
      return;
    }
    if (deletionLogs.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete all ${deletionLogs.length} deletion audit records?`)) return;
    try {
      setDeletionLogs([]);
      try { localStorage.setItem('cached_phone_deletion_logs', JSON.stringify([])); } catch (e) {}

      const batch = writeBatch(db);
      deletionLogs.forEach(l => {
        batch.delete(doc(db, 'phone_deletion_logs', l.id));
      });
      await batch.commit();
    } catch (err) {
      console.error("Error clearing audit logs:", err);
      alert("Failed to delete audit logs.");
    }
  };

  // 2. Action: Take/Pick up an Available Phone
  const handleTakePhone = async (device: PhoneDevice) => {
    if (!currentUser) return;
    if (device.status !== 'available') {
      alert("This device is currently not available.");
      return;
    }

    try {
      const now = getBSTISOString();
      const currentUserName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
      const currentUserEmpId = currentUser.employeeId || currentUser.loginHandle || '';

      // Create new usage log
      const logRef = doc(collection(db, 'phone_usage_logs'));
      const newLog: PhoneUsageLog = {
        id: logRef.id,
        phoneId: device.id,
        phoneName: device.name,
        userId: currentUser.id || '',
        userName: currentUserName,
        userEmpId: currentUserEmpId,
        startTime: now,
        status: 'active',
        createdAt: now
      };

      const batch = writeBatch(db);
      batch.set(logRef, cleanObject(newLog));

      // Update Device status
      const devRef = doc(db, 'phone_devices', device.id);
      batch.update(devRef, cleanObject({
        status: 'in_use',
        currentHolderId: currentUser.id || '',
        currentHolderName: currentUserName,
        currentHolderEmpId: currentUserEmpId,
        currentSessionStart: now,
        pendingHandoverToId: null,
        pendingHandoverToName: null,
        pendingHandoverToEmpId: null,
        pendingHandoverAt: null,
        pendingHandoverNote: null,
        pendingSenderMissedCalls: null,
        pendingSenderReturnedCalls: null,
        updatedAt: now
      }));

      await batch.commit();
    } catch (err) {
      console.error("Error taking device:", err);
      alert("Failed to start session with this phone.");
    }
  };

  // 3. Action: Initiate Handover to another Agent (by Employee ID or Selection) with Missed Calls & Back Given count
  const handleInitiateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverDevice || !currentUser) return;

    // Resolve target agent
    let targetUser: UserProfile | undefined;
    if (selectedTargetUser) {
      targetUser = allUsers.find(u => u.id === selectedTargetUser);
    } else if (targetEmpIdInput.trim()) {
      const searchKey = targetEmpIdInput.trim().toLowerCase();
      targetUser = allUsers.find(u => 
        (u.employeeId && u.employeeId.toLowerCase() === searchKey) ||
        (u.loginHandle && u.loginHandle.toLowerCase() === searchKey) ||
        (u.email && u.email.toLowerCase() === searchKey)
      );
    }

    if (!targetUser) {
      alert("Employee not found with the specified Employee ID / Selection. Please verify.");
      return;
    }

    if (targetUser.id === currentUser.id) {
      alert("You cannot handover the phone to yourself.");
      return;
    }

    const missedCallsNum = Math.max(0, parseInt(senderMissedCallsInput, 10) || 0);
    const returnedCallsNum = Math.max(0, parseInt(senderReturnedCallsInput, 10) || 0);

    setHandoverLoading(true);
    try {
      const now = getBSTISOString();
      const targetName = targetUser.displayName || targetUser.loginHandle || targetUser.email.split('@')[0];
      const targetEmpId = targetUser.employeeId || targetUser.loginHandle || '';
      const currentSenderName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];

      const batch = writeBatch(db);

      // 1. Update Device status to pending_handover with Missed Calls & Back given info
      const devRef = doc(db, 'phone_devices', handoverDevice.id);
      batch.update(devRef, cleanObject({
        status: 'pending_handover',
        pendingHandoverToId: targetUser.id,
        pendingHandoverToName: targetName,
        pendingHandoverToEmpId: targetEmpId,
        pendingHandoverAt: now,
        pendingHandoverNote: handoverNote.trim() || null,
        pendingSenderMissedCalls: missedCallsNum,
        pendingSenderReturnedCalls: returnedCallsNum,
        pendingRequestType: 'holder_initiated',
        updatedAt: now
      }));

      // 2. Send in-app notification to the target recipient with call details
      if (targetUser.id) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: targetUser.id,
          title: `📱 Phone Handover: ${handoverDevice.name}`,
          message: `${currentSenderName} wants to hand over ${handoverDevice.name} to you (Missed Calls: ${missedCallsNum}, Back Given: ${returnedCallsNum}). Open Phone Tracker to verify & accept.`,
          type: 'phone_handover',
          isRead: false,
          createdAt: now,
          phoneId: handoverDevice.id
        });
      }

      await batch.commit();

      setHandoverDevice(null);
      setSelectedTargetUser('');
      setTargetEmpIdInput('');
      setSenderMissedCallsInput('0');
      setSenderReturnedCallsInput('0');
      setHandoverNote('');
    } catch (err) {
      console.error("Error initiating handover:", err);
      alert("Failed to submit handover request.");
    } finally {
      setHandoverLoading(false);
    }
  };

  // Open Receiver Verification Dialog
  const openApproveModal = (device: PhoneDevice) => {
    setApprovingDevice(device);
    setReceiverMissedCallsInput(String(device.pendingSenderMissedCalls ?? 0));
    setReceiverReturnedCallsInput(String(device.pendingSenderReturnedCalls ?? 0));
    setReceiverVerificationNote('');
  };

  // 4. Action: Target Agent Approves Handover after Verifying Missed Calls & Back Given
  const handleConfirmApproveHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingDevice || !currentUser) return;
    if (approvingDevice.pendingHandoverToId !== currentUser.id && !isAdmin) {
      alert("You are not authorized to approve this handover.");
      return;
    }

    setApproveLoading(true);
    try {
      const now = getBSTISOString();
      const batch = writeBatch(db);

      const senderMissed = approvingDevice.pendingSenderMissedCalls ?? 0;
      const senderReturned = approvingDevice.pendingSenderReturnedCalls ?? 0;
      const receiverMissed = Math.max(0, parseInt(receiverMissedCallsInput, 10) || 0);
      const receiverReturned = Math.max(0, parseInt(receiverReturnedCallsInput, 10) || 0);
      const isMismatch = (senderMissed !== receiverMissed) || (senderReturned !== receiverReturned);

      // 1. Find the active log for the old holder and close it with complete handover details
      const oldHolderId = approvingDevice.currentHolderId;
      if (oldHolderId) {
        const activeLogsSnap = await getDocs(query(
          collection(db, 'phone_usage_logs'),
          where('phoneId', '==', approvingDevice.id),
          where('status', '==', 'active')
        ));

        activeLogsSnap.forEach(docSnap => {
          const logData = docSnap.data() as PhoneUsageLog;
          const startMs = new Date(logData.startTime).getTime();
          const endMs = new Date(now).getTime();
          const durationMins = Math.round(Math.max(0, endMs - startMs) / 60000);

          batch.update(docSnap.ref, cleanObject({
            endTime: now,
            durationMinutes: durationMins,
            status: 'handed_over',
            handoverToId: currentUser.id,
            handoverToName: currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0],
            handoverToEmpId: currentUser.employeeId || currentUser.loginHandle || '',
            handoverApprovedAt: now,
            senderMissedCalls: senderMissed,
            senderReturnedCalls: senderReturned,
            receiverMissedCalls: receiverMissed,
            receiverReturnedCalls: receiverReturned,
            verificationMismatch: isMismatch,
            receiverNote: receiverVerificationNote.trim() || undefined
          }));
        });
      }

      // 2. Create new active usage log for the new holder
      const newLogRef = doc(collection(db, 'phone_usage_logs'));
      const newReceiverName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
      const newReceiverEmpId = currentUser.employeeId || currentUser.loginHandle || '';

      const newLog: PhoneUsageLog = {
        id: newLogRef.id,
        phoneId: approvingDevice.id,
        phoneName: approvingDevice.name,
        userId: currentUser.id || '',
        userName: newReceiverName,
        userEmpId: newReceiverEmpId,
        startTime: now,
        status: 'active',
        note: approvingDevice.pendingHandoverNote ? `Handover note: ${approvingDevice.pendingHandoverNote}` : undefined,
        createdAt: now
      };
      batch.set(newLogRef, cleanObject(newLog));

      // 3. Update device document with new holder
      const devRef = doc(db, 'phone_devices', approvingDevice.id);
      batch.update(devRef, cleanObject({
        status: 'in_use',
        currentHolderId: currentUser.id || '',
        currentHolderName: newReceiverName,
        currentHolderEmpId: newReceiverEmpId,
        currentSessionStart: now,
        pendingHandoverToId: null,
        pendingHandoverToName: null,
        pendingHandoverToEmpId: null,
        pendingHandoverAt: null,
        pendingHandoverNote: null,
        pendingSenderMissedCalls: null,
        pendingSenderReturnedCalls: null,
        updatedAt: now
      }));

      // 4. Notify old holder with verification confirmation
      if (oldHolderId) {
        const notifRef = doc(collection(db, 'notifications'));
        const mismatchMsg = isMismatch 
          ? ` (⚠️ Verification note: Receiver verified Missed: ${receiverMissed}, Back: ${receiverReturned})` 
          : ' (✅ Call counts verified & matched)';

        batch.set(notifRef, {
          userId: oldHolderId,
          title: `✅ Handover Accepted: ${approvingDevice.name}`,
          message: `${newReceiverName} has accepted ${approvingDevice.name}.${mismatchMsg}`,
          type: 'system',
          isRead: false,
          createdAt: now,
          phoneId: approvingDevice.id
        });
      }

      await batch.commit();
      setApprovingDevice(null);
    } catch (err) {
      console.error("Error approving handover:", err);
      alert("Failed to complete handover approval.");
    } finally {
      setApproveLoading(false);
    }
  };

  // 4b. Action: Agent requests to claim a phone currently with another agent
  const handleRequestClaimPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimDevice || !currentUser) return;
    if (claimDevice.currentHolderId === currentUser.id) {
      alert("You already hold this phone.");
      return;
    }
    setClaimLoading(true);
    try {
      const now = getBSTISOString();
      const requesterName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
      const requesterEmpId = currentUser.employeeId || currentUser.loginHandle || '';

      const batch = writeBatch(db);
      const devRef = doc(db, 'phone_devices', claimDevice.id);

      batch.update(devRef, cleanObject({
        status: 'pending_handover',
        pendingHandoverToId: currentUser.id,
        pendingHandoverToName: requesterName,
        pendingHandoverToEmpId: requesterEmpId,
        pendingHandoverAt: now,
        pendingHandoverNote: claimRequestNote.trim() || null,
        pendingRequestType: 'receiver_requested',
        pendingSenderMissedCalls: null,
        pendingSenderReturnedCalls: null,
        updatedAt: now
      }));

      // Send notification to current holder
      if (claimDevice.currentHolderId) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: claimDevice.currentHolderId,
          title: `📱 Phone Handover Request: ${claimDevice.name}`,
          message: `${requesterName} (ID: ${requesterEmpId || 'N/A'}) requested to take ${claimDevice.name} from you. Open Phone Tracker to approve & handover.`,
          type: 'phone_handover',
          isRead: false,
          createdAt: now,
          phoneId: claimDevice.id
        });
      }

      await batch.commit();
      setClaimDevice(null);
      setClaimRequestNote('');
    } catch (err) {
      console.error("Error requesting phone claim:", err);
      alert("Failed to submit handover request.");
    } finally {
      setClaimLoading(false);
    }
  };

  // 4c. Action: Current holder approves handing over the phone to the requesting agent
  const handleConfirmHolderApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingClaimDevice || !currentUser) return;
    if (approvingClaimDevice.currentHolderId !== currentUser.id && !isAdmin) {
      alert("You are not the current holder of this phone.");
      return;
    }
    const requesterId = approvingClaimDevice.pendingHandoverToId;
    const requesterName = approvingClaimDevice.pendingHandoverToName || 'Agent';
    const requesterEmpId = approvingClaimDevice.pendingHandoverToEmpId || '';
    if (!requesterId) return;

    setHolderApproveLoading(true);
    try {
      const now = getBSTISOString();
      const holderName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
      const holderEmpId = currentUser.employeeId || currentUser.loginHandle || '';
      const missedCallsNum = Math.max(0, parseInt(holderMissedCallsInput, 10) || 0);
      const returnedCallsNum = Math.max(0, parseInt(holderReturnedCallsInput, 10) || 0);

      const batch = writeBatch(db);

      // 1. Close current holder's active log
      const activeLogsSnap = await getDocs(query(
        collection(db, 'phone_usage_logs'),
        where('phoneId', '==', approvingClaimDevice.id),
        where('status', '==', 'active')
      ));

      activeLogsSnap.forEach(docSnap => {
        const logData = docSnap.data() as PhoneUsageLog;
        const startMs = new Date(logData.startTime).getTime();
        const endMs = new Date(now).getTime();
        const durationMins = Math.round(Math.max(0, endMs - startMs) / 60000);

        batch.update(docSnap.ref, cleanObject({
          endTime: now,
          durationMinutes: durationMins,
          status: 'handed_over',
          handoverToId: requesterId,
          handoverToName: requesterName,
          handoverToEmpId: requesterEmpId,
          handoverApprovedAt: now,
          senderMissedCalls: missedCallsNum,
          senderReturnedCalls: returnedCallsNum,
          receiverMissedCalls: missedCallsNum,
          receiverReturnedCalls: returnedCallsNum,
          verificationMismatch: false,
          note: approvingClaimDevice.pendingHandoverNote ? `Request note: ${approvingClaimDevice.pendingHandoverNote}` : undefined
        }));
      });

      // 2. Create new active log for the requester
      const newLogRef = doc(collection(db, 'phone_usage_logs'));
      const newLog: PhoneUsageLog = {
        id: newLogRef.id,
        phoneId: approvingClaimDevice.id,
        phoneName: approvingClaimDevice.name,
        userId: requesterId,
        userName: requesterName,
        userEmpId: requesterEmpId,
        startTime: now,
        status: 'active',
        note: approvingClaimDevice.pendingHandoverNote ? `Claimed with note: ${approvingClaimDevice.pendingHandoverNote}` : undefined,
        createdAt: now
      };
      batch.set(newLogRef, cleanObject(newLog));

      // 3. Update device document with new holder
      const devRef = doc(db, 'phone_devices', approvingClaimDevice.id);
      batch.update(devRef, cleanObject({
        status: 'in_use',
        currentHolderId: requesterId,
        currentHolderName: requesterName,
        currentHolderEmpId: requesterEmpId,
        currentSessionStart: now,
        pendingHandoverToId: null,
        pendingHandoverToName: null,
        pendingHandoverToEmpId: null,
        pendingHandoverAt: null,
        pendingHandoverNote: null,
        pendingSenderMissedCalls: null,
        pendingSenderReturnedCalls: null,
        pendingRequestType: null,
        updatedAt: now
      }));

      // 4. Notify the requester that handover is approved and active
      const notifRef = doc(collection(db, 'notifications'));
      batch.set(notifRef, {
        userId: requesterId,
        title: `✅ Handover Approved: ${approvingClaimDevice.name}`,
        message: `${holderName} (ID: ${holderEmpId || 'N/A'}) has approved your handover request for ${approvingClaimDevice.name}. The phone is now active under your name.`,
        type: 'phone_handover',
        isRead: false,
        createdAt: now,
        phoneId: approvingClaimDevice.id
      });

      await batch.commit();
      setApprovingClaimDevice(null);
      setHolderMissedCallsInput('0');
      setHolderReturnedCallsInput('0');
    } catch (err) {
      console.error("Error approving holder claim request:", err);
      alert("Failed to complete handover approval.");
    } finally {
      setHolderApproveLoading(false);
    }
  };

  // 5. Action: Decline/Cancel Handover
  const handleCancelOrDeclineHandover = async (device: PhoneDevice) => {
    if (!currentUser) return;
    try {
      const now = getBSTISOString();
      const devRef = doc(db, 'phone_devices', device.id);
      const batch = writeBatch(db);

      batch.update(devRef, {
        status: 'in_use',
        pendingHandoverToId: null,
        pendingHandoverToName: null,
        pendingHandoverToEmpId: null,
        pendingHandoverAt: null,
        pendingHandoverNote: null,
        pendingSenderMissedCalls: null,
        pendingSenderReturnedCalls: null,
        pendingRequestType: null,
        updatedAt: now
      });

      // If receiver_requested and current holder declined, notify requester
      if (device.pendingRequestType === 'receiver_requested') {
        if (device.pendingHandoverToId) {
          const notifRef = doc(collection(db, 'notifications'));
          const currentUserName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
          batch.set(notifRef, {
            userId: device.pendingHandoverToId,
            title: `❌ Handover Request Declined: ${device.name}`,
            message: `${currentUserName} declined your request for ${device.name}.`,
            type: 'system',
            isRead: false,
            createdAt: now,
            phoneId: device.id
          });
        }
      } else {
        // If holder_initiated and target declined, notify the current holder
        if (device.currentHolderId && device.pendingHandoverToId === currentUser.id) {
          const notifRef = doc(collection(db, 'notifications'));
          const rejectorName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
          batch.set(notifRef, {
            userId: device.currentHolderId,
            title: `❌ Handover Declined: ${device.name}`,
            message: `${rejectorName} declined the handover request for ${device.name}. You remain the active holder.`,
            type: 'system',
            isRead: false,
            createdAt: now,
            phoneId: device.id
          });
        }
      }

      await batch.commit();
    } catch (err) {
      console.error("Error cancelling handover:", err);
      alert("Failed to cancel handover.");
    }
  };

  // 6. Action: End Session / Release Phone (Mark Available)
  const handleEndSession = async (device: PhoneDevice) => {
    if (!currentUser) return;
    if (device.currentHolderId !== currentUser.id && !isAdmin) {
      alert("Only the current holder or an Admin can end this session.");
      return;
    }

    if (!window.confirm(`Are you sure you want to END usage of "${device.name}" and return it to office storage (Available)?`)) {
      return;
    }

    try {
      const now = getBSTISOString();
      const batch = writeBatch(db);

      // 1. Close active log
      const activeLogsSnap = await getDocs(query(
        collection(db, 'phone_usage_logs'),
        where('phoneId', '==', device.id),
        where('status', '==', 'active')
      ));

      activeLogsSnap.forEach(docSnap => {
        const logData = docSnap.data() as PhoneUsageLog;
        const startMs = new Date(logData.startTime).getTime();
        const endMs = new Date(now).getTime();
        const durationMins = Math.round(Math.max(0, endMs - startMs) / 60000);

        batch.update(docSnap.ref, cleanObject({
          endTime: now,
          durationMinutes: durationMins,
          status: 'completed'
        }));
      });

      // 2. Set device to available
      const devRef = doc(db, 'phone_devices', device.id);
      batch.update(devRef, {
        status: 'available',
        currentHolderId: null,
        currentHolderName: null,
        currentHolderEmpId: null,
        currentSessionStart: null,
        pendingHandoverToId: null,
        pendingHandoverToName: null,
        pendingHandoverToEmpId: null,
        pendingHandoverAt: null,
        pendingHandoverNote: null,
        pendingSenderMissedCalls: null,
        pendingSenderReturnedCalls: null,
        updatedAt: now
      });

      await batch.commit();
    } catch (err) {
      console.error("Error ending phone session:", err);
      alert("Failed to end session.");
    }
  };

  // 7. Base Accessible Logs (AGENT ONLY SEES OWN HISTORY; ADMIN SEES ALL)
  const accessibleLogs = useMemo(() => {
    if (isAdmin) return logs;
    if (!currentUser) return [];
    return logs.filter(log => log.userId === currentUser.id || log.handoverToId === currentUser.id);
  }, [logs, isAdmin, currentUser]);

  // 8. Filtered Logs for History Table
  const filteredLogs = useMemo(() => {
    return accessibleLogs.filter(log => {
      // Search query (phone name, agent name, emp id, handover target)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = log.phoneName?.toLowerCase().includes(q);
        const matchUser = log.userName?.toLowerCase().includes(q);
        const matchEmp = log.userEmpId?.toLowerCase().includes(q);
        const matchTarget = log.handoverToName?.toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchEmp && !matchTarget) return false;
      }

      // Phone Filter
      if (selectedPhoneFilter !== 'all' && log.phoneId !== selectedPhoneFilter) {
        return false;
      }

      // User Filter (Admin only can filter by other users)
      if (isAdmin && selectedUserFilter !== 'all' && log.userId !== selectedUserFilter) {
        return false;
      }

      // Date Range Filter
      if (startDateFilter) {
        const logDate = formatBST(log.startTime, 'yyyy-MM-dd');
        if (logDate < startDateFilter) return false;
      }
      if (endDateFilter) {
        const logDate = formatBST(log.startTime, 'yyyy-MM-dd');
        if (logDate > endDateFilter) return false;
      }

      return true;
    });
  }, [accessibleLogs, searchQuery, selectedPhoneFilter, selectedUserFilter, startDateFilter, endDateFilter, isAdmin]);

  // 9. Excel Export Functionality
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      alert("No records to export.");
      return;
    }

    const exportData = filteredLogs.map((log, index) => {
      const durationFormatted = log.durationMinutes !== undefined 
        ? `${Math.floor(log.durationMinutes / 60)}h ${log.durationMinutes % 60}m (${log.durationMinutes} mins)`
        : formatDuration(log.startTime, log.endTime);

      const hasCallData = log.senderMissedCalls !== undefined || log.receiverMissedCalls !== undefined;
      const matchStatus = log.verificationMismatch 
        ? '⚠️ Discrepancy' 
        : hasCallData 
          ? '✅ Matched' 
          : 'N/A';

      return {
        'SL': index + 1,
        'Device Name': log.phoneName || 'Unknown Phone',
        'Agent Name': log.userName || 'N/A',
        'Employee ID': log.userEmpId || 'N/A',
        'Start Time (BST)': formatBST(log.startTime, 'yyyy-MM-dd hh:mm:ss a'),
        'End Time (BST)': log.endTime ? formatBST(log.endTime, 'yyyy-MM-dd hh:mm:ss a') : 'Currently In Use',
        'Total Duration': durationFormatted,
        'Session Status': log.status === 'active' ? 'Active (In Use)' : log.status === 'handed_over' ? 'Handed Over' : 'Returned / Completed',
        'Handed Over To': log.handoverToName ? `${log.handoverToName} (${log.handoverToEmpId || 'N/A'})` : 'N/A',
        'Sender Missed Calls': log.senderMissedCalls !== undefined ? log.senderMissedCalls : '-',
        'Sender Back Given Calls': log.senderReturnedCalls !== undefined ? log.senderReturnedCalls : '-',
        'Receiver Verified Missed': log.receiverMissedCalls !== undefined ? log.receiverMissedCalls : '-',
        'Receiver Verified Back': log.receiverReturnedCalls !== undefined ? log.receiverReturnedCalls : '-',
        'Count Match Status': matchStatus,
        'Receiver Verification Note': log.receiverNote || '',
        'Handover Approved Time': log.handoverApprovedAt ? formatBST(log.handoverApprovedAt, 'yyyy-MM-dd hh:mm:ss a') : 'N/A',
        'General Notes': log.note || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const columnWidths = [
      { wch: 6 },  // SL
      { wch: 22 }, // Device Name
      { wch: 20 }, // Agent Name
      { wch: 14 }, // Employee ID
      { wch: 24 }, // Start Time
      { wch: 24 }, // End Time
      { wch: 18 }, // Total Duration
      { wch: 18 }, // Session Status
      { wch: 22 }, // Handed Over To
      { wch: 18 }, // Sender Missed Calls
      { wch: 20 }, // Sender Back Given Calls
      { wch: 22 }, // Receiver Verified Missed
      { wch: 22 }, // Receiver Verified Back
      { wch: 20 }, // Count Match Status
      { wch: 26 }, // Receiver Note
      { wch: 24 }, // Handover Approved Time
      { wch: 22 }  // General Notes
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isAdmin ? 'All Phone Usage Report' : 'My Phone Usage Report');

    const fileName = isAdmin 
      ? `Phone_Handover_History_Admin_${formatBST(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`
      : `My_Phone_Handover_History_${currentUser?.loginHandle || 'agent'}_${formatBST(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
  };

  // 1. Pending incoming handovers initiated by sender for the current logged-in user
  const incomingHandovers = useMemo(() => {
    if (!currentUser) return [];
    return devices.filter(d => 
      d.status === 'pending_handover' && 
      d.pendingHandoverToId === currentUser.id && 
      d.pendingRequestType !== 'receiver_requested'
    );
  }, [devices, currentUser]);

  // 2. Pending claim requests sent by another agent to the current holder (current user)
  const incomingClaimRequests = useMemo(() => {
    if (!currentUser) return [];
    return devices.filter(d => 
      d.status === 'pending_handover' && 
      d.currentHolderId === currentUser.id && 
      d.pendingRequestType === 'receiver_requested'
    );
  }, [devices, currentUser]);

  // Devices currently held by the logged-in user
  const myCurrentPhones = useMemo(() => {
    if (!currentUser) return [];
    return devices.filter(d => d.currentHolderId === currentUser.id);
  }, [devices, currentUser]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-black tracking-widest uppercase">
              <Smartphone size={14} className="text-cyan-200" />
              <span>Device & Phone Handover Tracker</span>
              {!isAdmin && (
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] text-white">
                  Agent View (My Records)
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Phone Handover & Duty Tracking System
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Keep verified records of missed calls and returned calls during handovers with mutual verification.
            </p>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setEditingDevice(null);
                  setDeviceNameInput('');
                  setDeviceModelInput('');
                  setDeviceSimInput('');
                  setShowAddDeviceModal(true);
                }}
                className="flex items-center gap-2 bg-white text-blue-700 hover:bg-blue-50 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
              >
                <Plus size={16} />
                <span>Add New Phone</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
              >
                <Download size={16} />
                <span>Export All (Excel)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Incoming Handover Alert Notification Banner */}
      {incomingHandovers.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <PhoneForwarded size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-900 dark:text-amber-300 tracking-tight">
                You have incoming phone handover requests ({incomingHandovers.length})
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                Verify the sender's missed and returned calls count to approve and accept the handover.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incomingHandovers.map(dev => (
              <div 
                key={dev.id} 
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm flex flex-col justify-between gap-3.5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-800 dark:text-slate-100">{dev.name}</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                      Pending Verification
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 space-y-1">
                    <p>Sender: <strong className="text-slate-700 dark:text-slate-200">{dev.currentHolderName}</strong> (ID: {dev.currentHolderEmpId || 'N/A'})</p>
                    
                    {/* Sender Declared Missed / Back Calls */}
                    <div className="mt-2 grid grid-cols-2 gap-2 p-2.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-900/30">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                        <PhoneMissed size={13} />
                        <span>Missed Calls: {dev.pendingSenderMissedCalls ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <PhoneCall size={13} />
                        <span>Returned Calls: {dev.pendingSenderReturnedCalls ?? 0}</span>
                      </div>
                    </div>

                    {dev.pendingHandoverNote && (
                      <p className="italic text-slate-600 dark:text-slate-300 pt-1">Note: "{dev.pendingHandoverNote}"</p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      Requested at: {dev.pendingHandoverAt ? formatBST(dev.pendingHandoverAt, 'hh:mm a, dd MMM') : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => openApproveModal(dev)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={15} />
                    <span>Verify & Accept</span>
                  </button>
                  <button
                    onClick={() => handleCancelOrDeclineHandover(dev)}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Incoming Claim Request Alert Notification Banner (When someone requests a phone currently in user's hand) */}
      {incomingClaimRequests.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-500/10 border-2 border-blue-500/30 rounded-3xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-blue-900 dark:text-blue-300 tracking-tight">
                Incoming Phone Handover Requests ({incomingClaimRequests.length})
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">
                Another agent requested to take this phone from you. Click Approve to proceed with handover.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incomingClaimRequests.map(dev => (
              <div 
                key={dev.id} 
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-blue-200 dark:border-blue-900/40 shadow-sm flex flex-col justify-between gap-3.5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-800 dark:text-slate-100">{dev.name}</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                      Handover Requested
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 space-y-1">
                    <p>Requester: <strong className="text-slate-700 dark:text-slate-200">{dev.pendingHandoverToName}</strong> (ID: {dev.pendingHandoverToEmpId || 'N/A'})</p>
                    {dev.pendingHandoverNote && (
                      <p className="italic text-slate-600 dark:text-slate-300 pt-1">Note: "{dev.pendingHandoverNote}"</p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      Requested at: {dev.pendingHandoverAt ? formatBST(dev.pendingHandoverAt, 'hh:mm a, dd MMM') : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setApprovingClaimDevice(dev);
                      setHolderMissedCallsInput('0');
                      setHolderReturnedCallsInput('0');
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={15} />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleCancelOrDeclineHandover(dev)}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveSubTab('devices')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeSubTab === 'devices'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Smartphone size={16} />
          <span>All Devices & Live Status ({devices.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('my_phones')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all relative ${
            activeSubTab === 'my_phones'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck size={16} />
          <span>My Assigned Phones ({myCurrentPhones.length})</span>
          {myCurrentPhones.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
            activeSubTab === 'history'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History size={16} />
          <span>
            {isAdmin ? `Handover History (All: ${accessibleLogs.length})` : `My History (${accessibleLogs.length})`}
          </span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveSubTab('deletion_logs')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all relative ${
              activeSubTab === 'deletion_logs'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/25'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShieldAlert size={16} />
            <span>Deletion Audit Logs ({deletionLogs.length})</span>
            {deletionLogs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            )}
          </button>
        )}
      </div>

      {/* TAB 1: ALL DEVICES / LIVE STATUS */}
      {activeSubTab === 'devices' && (
        <div className="space-y-6">
          {devices.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
                <Smartphone size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">No devices registered yet</h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 max-w-md mx-auto">
                Click "Add New Phone" from the admin panel to add office devices.
              </p>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingDevice(null);
                    setDeviceNameInput('');
                    setDeviceModelInput('');
                    setDeviceSimInput('');
                    setShowAddDeviceModal(true);
                  }}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                >
                  <Plus size={16} />
                  <span>Add First Device</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => {
                const isHeldByMe = device.currentHolderId === currentUser?.id;
                const isAvailable = device.status === 'available';
                const isPendingHandover = device.status === 'pending_handover';
                const isInUse = device.status === 'in_use';

                return (
                  <div
                    key={device.id}
                    className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                      isHeldByMe 
                        ? 'border-blue-500/40 ring-2 ring-blue-500/10' 
                        : isAvailable 
                          ? 'border-emerald-500/30' 
                          : isPendingHandover
                            ? 'border-amber-500/40'
                            : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0 ${
                            isAvailable 
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                              : isPendingHandover
                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                          }`}>
                            <Smartphone size={24} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-base tracking-tight">
                              {device.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-300 font-medium">
                              {device.modelNumber && <span>{device.modelNumber}</span>}
                              {device.simNumber && <span>• SIM: {device.simNumber}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isAvailable && (
                            <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap inline-flex items-center">
                              Available
                            </span>
                          )}
                          {isInUse && (
                            <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 whitespace-nowrap inline-flex items-center">
                              In Use
                            </span>
                          )}
                          {isPendingHandover && (
                            <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 animate-pulse whitespace-nowrap inline-flex items-center">
                              Handover Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Current Status Body */}
                      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-700">
                        {isAvailable ? (
                          <div className="text-center py-2 text-xs font-bold text-slate-500 dark:text-slate-300">
                            ফোনটি বর্তমানে অফিসে জমা আছে। যে কেউ কাজ শুরু করতে এটি নিজের কাছে নিতে পারেন।
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-300 font-semibold">Current Holder:</span>
                              <span className="font-black text-slate-800 dark:text-slate-100">
                                {device.currentHolderName} {device.currentHolderEmpId ? `(${device.currentHolderEmpId})` : ''}
                                {isHeldByMe && <span className="ml-1 text-blue-600 dark:text-blue-400 font-bold">(You)</span>}
                              </span>
                            </div>

                            {device.currentSessionStart && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 dark:text-slate-300 flex items-center gap-1 font-semibold">
                                  <Clock size={13} />
                                  <span>Started:</span>
                                </span>
                                <span className="font-bold text-slate-700 dark:text-slate-200">
                                  {formatBST(device.currentSessionStart, 'hh:mm a')}
                                </span>
                              </div>
                            )}

                            {device.currentSessionStart && (
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700/60">
                                <span className="text-slate-500 dark:text-slate-300 flex items-center gap-1 font-semibold">
                                  <Timer size={13} className="text-blue-500" />
                                  <span>Total Duration:</span>
                                </span>
                                <span className="font-black text-blue-600 dark:text-blue-400">
                                  {formatDuration(device.currentSessionStart)}
                                </span>
                              </div>
                            )}

                            {isPendingHandover && (
                              <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 space-y-1.5">
                                <p className="font-bold">
                                  {device.pendingRequestType === 'receiver_requested' 
                                    ? `Handover requested by: ${device.pendingHandoverToName} (${device.pendingHandoverToEmpId || 'N/A'})`
                                    : `Handover pending: ${device.pendingHandoverToName} (${device.pendingHandoverToEmpId || 'N/A'})`
                                  }
                                </p>
                                {device.pendingRequestType !== 'receiver_requested' && (
                                  <div className="flex items-center gap-3 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                                    <span className="text-rose-600 dark:text-rose-400">Missed: {device.pendingSenderMissedCalls ?? 0}</span>
                                    <span>•</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">Returned: {device.pendingSenderReturnedCalls ?? 0}</span>
                                  </div>
                                )}
                                {device.pendingHandoverNote && (
                                  <p className="italic text-slate-600 dark:text-slate-300">"{device.pendingHandoverNote}"</p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                      {/* Scenario 1: Phone is available -> Anyone can take it */}
                      {isAvailable && (
                        <button
                          onClick={() => handleTakePhone(device)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                          <SmartphoneCharging size={16} />
                          <span>Take Phone</span>
                        </button>
                      )}

                      {/* Scenario 2: Phone is held by current logged-in user */}
                      {isHeldByMe && !isPendingHandover && (
                        <div className="w-full flex items-center gap-2">
                          <button
                            onClick={() => {
                              setHandoverDevice(device);
                              setSelectedTargetUser('');
                              setTargetEmpIdInput('');
                              setSenderMissedCallsInput('0');
                              setSenderReturnedCallsInput('0');
                              setHandoverNote('');
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          >
                            <ArrowRightLeft size={15} />
                            <span>Handover</span>
                          </button>

                          <button
                            onClick={() => handleEndSession(device)}
                            className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                          >
                            <PowerOff size={15} />
                            <span>End Session</span>
                          </button>
                        </div>
                      )}

                      {/* Scenario 2b: Phone held by current user and someone requested it (receiver_requested) */}
                      {isHeldByMe && isPendingHandover && device.pendingRequestType === 'receiver_requested' && (
                        <div className="w-full flex items-center gap-2">
                          <button
                            onClick={() => {
                              setApprovingClaimDevice(device);
                              setHolderMissedCallsInput('0');
                              setHolderReturnedCallsInput('0');
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
                          >
                            <CheckCircle2 size={15} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleCancelOrDeclineHandover(device)}
                            className="px-3 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {/* Scenario 2c: Phone held by current user and current user initiated handover */}
                      {isHeldByMe && isPendingHandover && device.pendingRequestType !== 'receiver_requested' && (
                        <button
                          onClick={() => handleCancelOrDeclineHandover(device)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <XCircle size={15} />
                          <span>Cancel Handover Request</span>
                        </button>
                      )}

                      {/* Scenario 3a: Phone held by someone else, but currentUser requested to claim it */}
                      {!isHeldByMe && isPendingHandover && device.pendingHandoverToId === currentUser?.id && device.pendingRequestType === 'receiver_requested' && (
                        <div className="w-full flex items-center gap-2">
                          <div className="flex-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 py-2 px-3 rounded-xl text-[11px] font-bold text-center border border-amber-200 dark:border-amber-800">
                            Awaiting Approval...
                          </div>
                          <button
                            onClick={() => handleCancelOrDeclineHandover(device)}
                            className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Scenario 3b: Phone held by someone else, sender sent handover to currentUser */}
                      {!isHeldByMe && isPendingHandover && device.pendingHandoverToId === currentUser?.id && device.pendingRequestType !== 'receiver_requested' && (
                        <div className="w-full flex items-center gap-2">
                          <button
                            onClick={() => openApproveModal(device)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                          >
                            <CheckCircle2 size={15} />
                            <span>Verify & Approve</span>
                          </button>
                          <button
                            onClick={() => handleCancelOrDeclineHandover(device)}
                            className="px-3 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {/* Scenario 4: Phone held by someone else, NOT pending handover -> Agent can request this phone */}
                      {!isHeldByMe && isInUse && !isPendingHandover && (
                        <button
                          onClick={() => {
                            setClaimDevice(device);
                            setClaimRequestNote('');
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                          <ArrowRightLeft size={15} />
                          <span>Request Phone</span>
                        </button>
                      )}

                      {/* Scenario 5: Phone held by someone else, pending handover to a 3rd person */}
                      {!isHeldByMe && isPendingHandover && device.pendingHandoverToId !== currentUser?.id && (
                        <div className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[11px] font-bold text-center">
                          Handover In Progress ({device.pendingHandoverToName})
                        </div>
                      )}

                      {/* Admin Force Actions */}
                      {!isHeldByMe && !isAvailable && isAdmin && (
                        <div className="w-full flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => handleEndSession(device)}
                            className="text-red-600 hover:underline font-bold"
                          >
                            Force End (Admin)
                          </button>
                          {isPendingHandover && (
                            <button
                              onClick={() => {
                                if (device.pendingRequestType === 'receiver_requested') {
                                  setApprovingClaimDevice(device);
                                } else {
                                  openApproveModal(device);
                                }
                              }}
                              className="text-emerald-600 hover:underline font-bold"
                            >
                              Force Approve
                            </button>
                          )}
                        </div>
                      )}

                      {/* Admin edit/delete buttons */}
                      {isAdmin && (
                        <div className="w-full pt-2 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                          <button
                            onClick={() => {
                              setEditingDevice(device);
                              setDeviceNameInput(device.name);
                              setDeviceModelInput(device.modelNumber || '');
                              setDeviceSimInput(device.simNumber || '');
                              setShowAddDeviceModal(true);
                            }}
                            className="hover:text-blue-600 flex items-center gap-1"
                          >
                            <Edit3 size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDevice(device.id, device.name)}
                            className="hover:text-red-600 flex items-center gap-1"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY CURRENT PHONES */}
      {activeSubTab === 'my_phones' && (
        <div className="space-y-6">
          {myCurrentPhones.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <UserCheck size={28} />
              </div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">You currently have no active devices</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Go to the "All Devices" tab and click "Take Phone" on an available device, or accept a pending handover from another agent.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myCurrentPhones.map(device => (
                <div 
                  key={device.id} 
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-blue-500/40 shadow-lg space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Smartphone size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{device.name}</h3>
                        <p className="text-xs text-slate-400">{device.modelNumber || 'Office Device'}</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      Active In Hand
                    </span>
                  </div>

                  <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Session Started:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {device.currentSessionStart ? formatBST(device.currentSessionStart, 'hh:mm a, dd MMM yyyy') : '--'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Duration:</span>
                      <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                        {device.currentSessionStart ? formatDuration(device.currentSessionStart) : '--'}
                      </span>
                    </div>
                  </div>

                  {device.status === 'pending_handover' ? (
                    device.pendingRequestType === 'receiver_requested' ? (
                      <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/40 space-y-3">
                        <div>
                          <p className="text-xs font-black text-blue-900 dark:text-blue-300">
                            🔔 {device.pendingHandoverToName} ({device.pendingHandoverToEmpId || 'N/A'}) requested to take this phone.
                          </p>
                          {device.pendingHandoverNote && (
                            <p className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-1">
                              Note: "{device.pendingHandoverNote}"
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setApprovingClaimDevice(device);
                              setHolderMissedCallsInput('0');
                              setHolderReturnedCallsInput('0');
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          >
                            <CheckCircle2 size={15} />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleCancelOrDeclineHandover(device)}
                            className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-3">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                          Handover request sent to: {device.pendingHandoverToName} ({device.pendingHandoverToEmpId || 'N/A'})
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                          <span className="text-rose-600">Missed: {device.pendingSenderMissedCalls ?? 0}</span>
                          <span className="text-emerald-600">Returned: {device.pendingSenderReturnedCalls ?? 0}</span>
                        </div>
                        <button
                          onClick={() => handleCancelOrDeclineHandover(device)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider"
                        >
                          Cancel Handover Request
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setHandoverDevice(device);
                          setSelectedTargetUser('');
                          setTargetEmpIdInput('');
                          setSenderMissedCallsInput('0');
                          setSenderReturnedCallsInput('0');
                          setHandoverNote('');
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                      >
                        <ArrowRightLeft size={16} />
                        <span>Handover Phone</span>
                      </button>

                      <button
                        onClick={() => handleEndSession(device)}
                        className="flex-1 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <PowerOff size={16} />
                        <span>End & Return</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HANDOVER & USAGE HISTORY (ACCESS RESTRICTED: AGENT SEES ONLY OWN HISTORY) */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={16} />
                <input
                  type="text"
                  placeholder={isAdmin ? "Search by Agent, Phone, Emp ID..." : "Search in your records..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Phone Dropdown Filter */}
                <select
                  value={selectedPhoneFilter}
                  onChange={(e) => setSelectedPhoneFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                >
                  <option value="all">All Devices</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                {/* User Dropdown Filter - ADMIN ONLY */}
                {isAdmin && (
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">All Agents</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || u.loginHandle || u.email} {u.employeeId ? `(${u.employeeId})` : ''}
                      </option>
                    ))}
                  </select>
                )}

                {/* Start Date */}
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                  title="Filter From Date"
                />

                {/* End Date */}
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-2 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                  title="Filter To Date"
                />

                {(searchQuery || selectedPhoneFilter !== 'all' || (isAdmin && selectedUserFilter !== 'all') || startDateFilter || endDateFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPhoneFilter('all');
                      setSelectedUserFilter('all');
                      setStartDateFilter('');
                      setEndDateFilter('');
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline px-2"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {!isAdmin && (
              <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                <Shield size={14} className="text-blue-500" />
                <span>For privacy protection, only your own device usage and handover records are displayed here.</span>
              </div>
            )}
          </div>

          {/* History Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                  {isAdmin ? 'Full Handover & Missed Call Verification History' : 'My Device Usage & Handover History'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total {filteredLogs.length} logs recorded</p>
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && filteredLogs.length > 0 && (
                  <button
                    onClick={handleBulkDeleteFilteredLogs}
                    title="Delete all filtered history records"
                    className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 px-3 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
                  >
                    <Trash2 size={14} />
                    <span>Clear Filtered ({filteredLogs.length})</span>
                  </button>
                )}
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
                >
                  <Download size={14} />
                  <span>Export Excel</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-4 px-5">Device</th>
                    <th className="py-4 px-5">Agent</th>
                    <th className="py-4 px-5">Time & Duration</th>
                    <th className="py-4 px-5">Handover To</th>
                    <th className="py-4 px-5">Sender (Missed / Back)</th>
                    <th className="py-4 px-5">Receiver Verification</th>
                    <th className="py-4 px-5">Status</th>
                    {isAdmin && <th className="py-4 px-5 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="text-center py-10 text-slate-500 dark:text-slate-300 text-xs font-semibold">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const isStillActive = log.status === 'active';
                      const hasCallCounts = log.senderMissedCalls !== undefined || log.receiverMissedCalls !== undefined;

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-4 px-5 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <Smartphone size={14} className="text-blue-500 shrink-0" />
                              <span>{log.phoneName}</span>
                            </div>
                          </td>

                          <td className="py-4 px-5">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100">{log.userName}</p>
                              {log.userEmpId && <p className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold">ID: {log.userEmpId}</p>}
                            </div>
                          </td>

                          <td className="py-4 px-5 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <p className="text-slate-700 dark:text-slate-200 font-semibold">
                                {formatBST(log.startTime, 'dd MMM, hh:mm a')}
                              </p>
                              <p className="text-[11px] font-black text-blue-600 dark:text-blue-400">
                                Duration: {log.durationMinutes !== undefined 
                                  ? `${Math.floor(log.durationMinutes / 60)}h ${log.durationMinutes % 60}m`
                                  : formatDuration(log.startTime, log.endTime)}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 px-5">
                            {log.handoverToName ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                  <ArrowRightLeft size={12} />
                                  <span>{log.handoverToName}</span>
                                </p>
                                {log.handoverToEmpId && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-300 font-semibold">ID: {log.handoverToEmpId}</p>
                                )}
                              </div>
                            ) : log.note ? (
                              <span className="italic text-slate-600 dark:text-slate-300">{log.note}</span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-300">Returned to Storage</span>
                            )}
                          </td>

                          {/* Sender Declared Counts */}
                          <td className="py-4 px-5 whitespace-nowrap">
                            {log.senderMissedCalls !== undefined || log.senderReturnedCalls !== undefined ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg">
                                  <PhoneMissed size={11} />
                                  <span>Missed: {log.senderMissedCalls ?? 0}</span>
                                </span>
                                <br />
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg mt-0.5">
                                  <PhoneCall size={11} />
                                  <span>Back: {log.senderReturnedCalls ?? 0}</span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>

                          {/* Receiver Verified Counts */}
                          <td className="py-4 px-5">
                            {log.receiverMissedCalls !== undefined || log.receiverReturnedCalls !== undefined ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
                                    Missed: {log.receiverMissedCalls ?? 0} | Back: {log.receiverReturnedCalls ?? 0}
                                  </span>
                                  {log.verificationMismatch ? (
                                    <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center gap-0.5">
                                      <AlertTriangle size={10} />
                                      Mismatch
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 text-[9px] font-black rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                                      <CheckCheck size={10} />
                                      Matched
                                    </span>
                                  )}
                                </div>
                                {log.receiverNote && (
                                  <p className="text-[10px] italic text-slate-600 dark:text-slate-300">Note: "{log.receiverNote}"</p>
                                )}
                              </div>
                            ) : hasCallCounts ? (
                              <span className="text-amber-500 text-[10px] font-bold">Pending Check</span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>

                          <td className="py-4 px-5 whitespace-nowrap">
                            {isStillActive ? (
                              <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                Active
                              </span>
                            ) : log.status === 'handed_over' ? (
                              <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                                Handed Over
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                Completed
                              </span>
                            )}
                          </td>

                          {isAdmin && (
                            <td className="py-4 px-5 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteLog(log.id, log.phoneName, log.userName)}
                                title="Delete History Log"
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all inline-flex items-center gap-1.5 font-bold text-[11px]"
                              >
                                <Trash2 size={14} />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DELETION AUDIT LOGS (ADMINS VIEW, ONLY 2146 CAN DELETE) */}
      {isAdmin && activeSubTab === 'deletion_logs' && (
        <div className="space-y-6">
          {/* Security Banner */}
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/20 shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-rose-950 dark:text-rose-200">
                    Admin Deletion Action Audit Logs
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-rose-200/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
                    Audited
                  </span>
                </div>
                <p className="text-xs text-rose-800/80 dark:text-rose-300/80 font-medium">
                  Automated immutable audit logs recording device and history deletions by administrators.
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                  <Lock size={12} />
                  <span>
                    Security Policy: These audit logs can <strong>only be deleted by User 2146</strong>.
                  </span>
                </div>
              </div>
            </div>

            {isSuperAdmin2146 && deletionLogs.length > 0 && (
              <button
                onClick={handleBulkDeleteAuditLogs}
                className="self-start sm:self-auto flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all active:scale-95 shrink-0"
              >
                <Trash2 size={15} />
                <span>Clear All Audit Logs ({deletionLogs.length})</span>
              </button>
            )}
          </div>

          {/* Audit Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">
                  Deletion Activity Tracking History
                </h3>
                <p className="text-xs text-slate-400">Total {deletionLogs.length} deletion actions recorded</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                {isSuperAdmin2146 ? (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5">
                    <ShieldCheck size={14} />
                    <span>Authorized as 2146 (Full Access)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Lock size={14} />
                    <span>View Only (Protected)</span>
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-black text-[11px] border-b border-slate-100 dark:border-slate-800">
                    <th className="py-4 px-5">Admin</th>
                    <th className="py-4 px-5">Time & Date</th>
                    <th className="py-4 px-5">Action Type</th>
                    <th className="py-4 px-5">Deleted Content Summary</th>
                    <th className="py-4 px-5 text-right">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  {deletionLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 text-xs font-semibold">
                        No history or device deletion records found.
                      </td>
                    </tr>
                  ) : (
                    deletionLogs.map(audit => {
                      const actionLabel = 
                        audit.actionType === 'delete_device' 
                          ? 'Device Deleted' 
                          : audit.actionType === 'bulk_delete_history_logs'
                          ? 'Bulk History Clear'
                          : 'History Log Deleted';
                      
                      const actionBadgeColor = 
                        audit.actionType === 'delete_device'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                          : audit.actionType === 'bulk_delete_history_logs'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';

                      return (
                        <tr key={audit.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Admin Info */}
                          <td className="py-4 px-5 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                                <span>{audit.adminName}</span>
                                {audit.adminEmpId && (
                                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                                    ID: {audit.adminEmpId}
                                  </span>
                                )}
                              </p>
                              {audit.adminEmail && (
                                <p className="text-[11px] text-slate-400">{audit.adminEmail}</p>
                              )}
                            </div>
                          </td>

                          {/* Time */}
                          <td className="py-4 px-5 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <p className="font-bold text-slate-800 dark:text-slate-200">
                                {formatBST(audit.timestamp || audit.createdAt)}
                              </p>
                              <p className="text-[10px] text-slate-400">Recorded BST</p>
                            </div>
                          </td>

                          {/* Action Type */}
                          <td className="py-4 px-5 whitespace-nowrap">
                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${actionBadgeColor}`}>
                              {actionLabel}
                            </span>
                          </td>

                          {/* Deleted Summary & Details */}
                          <td className="py-4 px-5">
                            <div className="space-y-1 max-w-xl">
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                {audit.deletedSummary}
                              </p>
                              {audit.deletedDetails && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100/80 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 whitespace-pre-wrap max-h-24 overflow-y-auto">
                                  {audit.deletedDetails}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Action: Only 2146 can delete this log */}
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            {isSuperAdmin2146 ? (
                              <button
                                onClick={() => handleDeleteAuditLog(audit.id)}
                                title="Delete this audit log (2146 Authorize)"
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all inline-flex items-center gap-1.5 font-bold text-[11px]"
                              >
                                <Trash2 size={14} />
                                <span>Delete Log</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-bold">
                                <Lock size={11} />
                                <span>2146 Only</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD / EDIT PHONE DEVICE (ADMIN ONLY) */}
      <AnimatePresence>
        {isAdmin && showAddDeviceModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddDeviceModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      {editingDevice ? 'Edit Phone Details' : 'Add New Phone'}
                    </h3>
                    <p className="text-xs text-slate-400">Add office device name and SIM details</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddDeviceModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveDevice} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    Phone Name / Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Phone A, Phone 1 (Redmi 12)"
                    value={deviceNameInput}
                    onChange={(e) => setDeviceNameInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    Model / Brand (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Xiaomi Redmi Note 12 / Samsung A15"
                    value={deviceModelInput}
                    onChange={(e) => setDeviceModelInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    SIM Number / Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 017xxxxxxxx (Customer Care SIM)"
                    value={deviceSimInput}
                    onChange={(e) => setDeviceSimInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={deviceActionLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                  >
                    {deviceActionLoading ? 'Saving...' : editingDevice ? 'Update Device' : 'Save Device'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddDeviceModal(false)}
                    className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: INITIATE HANDOVER MODAL (SENDER ENTERS MISSED CALLS & BACK CALLS) */}
      <AnimatePresence>
        {handoverDevice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHandoverDevice(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Handover: {handoverDevice.name}
                    </h3>
                    <p className="text-xs text-slate-400">Specify missed and returned call counts to send request</p>
                  </div>
                </div>
                <button
                  onClick={() => setHandoverDevice(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleInitiateHandover} className="space-y-4">
                {/* Employee ID Search / Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    Recipient Employee ID or Select Staff *
                  </label>
                  
                  {/* Quick User Picker */}
                  <select
                    value={selectedTargetUser}
                    onChange={(e) => {
                      setSelectedTargetUser(e.target.value);
                      if (e.target.value) {
                        const target = allUsers.find(u => u.id === e.target.value);
                        if (target?.employeeId) {
                          setTargetEmpIdInput(target.employeeId);
                        }
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 mb-2"
                  >
                    <option value="">-- Select Agent from List --</option>
                    {allUsers.filter(u => u.id !== currentUser?.id).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || u.loginHandle || u.email} {u.employeeId ? `[ID: ${u.employeeId}]` : ''}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">OR Type Employee ID:</span>
                    <input
                      type="text"
                      placeholder="e.g. EMP-101, 102"
                      value={targetEmpIdInput}
                      onChange={(e) => {
                        setTargetEmpIdInput(e.target.value);
                        const match = allUsers.find(u => u.employeeId?.toLowerCase() === e.target.value.trim().toLowerCase());
                        if (match?.id) setSelectedTargetUser(match.id);
                      }}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                {/* SENDER MISSED CALLS & BACK CALLS INPUTS (OPTIONAL) */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <PhoneMissed size={12} />
                      <span>Missed Calls</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={senderMissedCallsInput}
                      onChange={(e) => setSenderMissedCallsInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-black text-rose-600 dark:text-rose-400 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <PhoneCall size={12} />
                      <span>Returned Calls</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={senderReturnedCallsInput}
                      onChange={(e) => setSenderReturnedCallsInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Handover Note / Remark */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    Handover Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shift change, break time, charging, etc."
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={handoverLoading || (!selectedTargetUser && !targetEmpIdInput.trim())}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                  >
                    {handoverLoading ? 'Sending Request...' : 'Send Handover Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHandoverDevice(null)}
                    className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: RECEIVER VERIFY & APPROVE HANDOVER MODAL */}
      <AnimatePresence>
        {approvingDevice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setApprovingDevice(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Verify & Accept Handover
                    </h3>
                    <p className="text-xs text-slate-400">Check call records and verify counts before accepting handover</p>
                  </div>
                </div>
                <button
                  onClick={() => setApprovingDevice(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Sender Details & Stated Counts */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Device Name:</span>
                  <span className="font-black text-slate-800 dark:text-slate-100">{approvingDevice.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Sender:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {approvingDevice.currentHolderName} ({approvingDevice.currentHolderEmpId || 'N/A'})
                  </span>
                </div>
                
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-rose-50/80 dark:bg-rose-950/30 rounded-xl text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1.5 border border-rose-100 dark:border-rose-900/40">
                    <PhoneMissed size={13} />
                    <span>Sender reported missed: {approvingDevice.pendingSenderMissedCalls ?? 0}</span>
                  </div>
                  <div className="p-2 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5 border border-emerald-100 dark:border-emerald-900/40">
                    <PhoneCall size={13} />
                    <span>Sender reported returned: {approvingDevice.pendingSenderReturnedCalls ?? 0}</span>
                  </div>
                </div>

                {approvingDevice.pendingHandoverNote && (
                  <p className="italic text-slate-600 dark:text-slate-300 pt-1">Note: "{approvingDevice.pendingHandoverNote}"</p>
                )}
              </div>

              <form onSubmit={handleConfirmApproveHandover} className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Your Verification (Verified Counts):
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <PhoneMissed size={12} />
                        <span>Verified Missed *</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="0"
                        value={receiverMissedCallsInput}
                        onChange={(e) => setReceiverMissedCallsInput(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <PhoneCall size={12} />
                        <span>Verified Back *</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        placeholder="0"
                        value={receiverReturnedCallsInput}
                        onChange={(e) => setReceiverReturnedCallsInput(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-black text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Discrepancy warning banner if numbers differ */}
                {(Number(receiverMissedCallsInput) !== (approvingDevice.pendingSenderMissedCalls ?? 0) || 
                  Number(receiverReturnedCallsInput) !== (approvingDevice.pendingSenderReturnedCalls ?? 0)) && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                    <span>Warning: The numbers you entered differ from what the sender reported. This will be recorded as a mismatch discrepancy.</span>
                  </div>
                )}

                {/* Receiver Comment / Discrepancy Note */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    Receiver Note / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Checked log book, 2 extra missed calls found, etc."
                    value={receiverVerificationNote}
                    onChange={(e) => setReceiverVerificationNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={approveLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    {approveLoading ? 'Approving...' : 'Confirm & Accept Handover'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovingDevice(null)}
                    className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* MODAL 4: REQUEST / CLAIM PHONE CURRENTLY IN USE (RECEIVER -> HOLDER) */}
      <AnimatePresence>
        {claimDevice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setClaimDevice(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                    <ArrowRightLeft size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Request Phone: {claimDevice.name}
                    </h3>
                    <p className="text-xs text-slate-400">Send a request to the current holder to take this phone</p>
                  </div>
                </div>
                <button
                  onClick={() => setClaimDevice(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Current Holder Information */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Device Name:</span>
                  <span className="font-black text-slate-800 dark:text-slate-100">{claimDevice.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Current Holder:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {claimDevice.currentHolderName} ({claimDevice.currentHolderEmpId || 'N/A'})
                  </span>
                </div>
                {claimDevice.currentSessionStart && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Active Usage Duration:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {formatDuration(claimDevice.currentSessionStart)}
                    </span>
                  </div>
                )}
              </div>

              <form onSubmit={handleRequestClaimPhone} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    Request Note / Reason
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shift starting, need this phone now for customer support..."
                    value={claimRequestNote}
                    onChange={(e) => setClaimRequestNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl text-xs text-blue-900 dark:text-blue-200">
                  💡 Once you submit the request, the current holder ({claimDevice.currentHolderName}) will verify the call counts and approve it. The phone will then be assigned to you.
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={claimLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                  >
                    {claimLoading ? 'Sending Request...' : 'Send Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClaimDevice(null)}
                    className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: CURRENT HOLDER APPROVES INCOMING CLAIM REQUEST */}
      <AnimatePresence>
        {approvingClaimDevice && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setApprovingClaimDevice(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                      Approve Handover Request
                    </h3>
                    <p className="text-xs text-slate-400">Provide missed and returned call counts before handing over</p>
                  </div>
                </div>
                <button
                  onClick={() => setApprovingClaimDevice(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {/* Requester Details */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Device Name:</span>
                  <span className="font-black text-slate-800 dark:text-slate-100">{approvingClaimDevice.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Recipient:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {approvingClaimDevice.pendingHandoverToName} ({approvingClaimDevice.pendingHandoverToEmpId || 'N/A'})
                  </span>
                </div>
                {approvingClaimDevice.pendingHandoverNote && (
                  <p className="italic text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-700">
                    Note: "{approvingClaimDevice.pendingHandoverNote}"
                  </p>
                )}
              </div>

              <form onSubmit={handleConfirmHolderApproval} className="space-y-4">
                {/* HOLDER MISSED CALLS & BACK CALLS INPUTS (OPTIONAL) */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <PhoneMissed size={12} />
                      <span>Missed Calls</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={holderMissedCallsInput}
                      onChange={(e) => setHolderMissedCallsInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-black text-rose-600 dark:text-rose-400 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <PhoneCall size={12} />
                      <span>Returned Calls</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={holderReturnedCallsInput}
                      onChange={(e) => setHolderReturnedCallsInput(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Handover Note */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    Approval Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Approved and handed over device..."
                    value={holderApprovalNote}
                    onChange={(e) => setHolderApprovalNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>

                <div className="pt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={holderApproveLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    {holderApproveLoading ? 'Approving...' : 'Confirm & Approve Handover'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovingClaimDevice(null)}
                    className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
