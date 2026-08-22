import React, { useState, useEffect, useMemo } from 'react';
import { 
  PhoneDevice, 
  PhoneUsageLog, 
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
  addDoc, 
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
  Filter, 
  UserCheck, 
  History, 
  PowerOff, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  ShieldCheck, 
  SmartphoneCharging, 
  Users,
  Calendar,
  Sparkles,
  PhoneForwarded,
  Timer
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
  const [devices, setDevices] = useState<PhoneDevice[]>([]);
  const [logs, setLogs] = useState<PhoneUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'devices' | 'history' | 'my_phones'>('devices');

  // Modal States
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<PhoneDevice | null>(null);
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [deviceModelInput, setDeviceModelInput] = useState('');
  const [deviceSimInput, setDeviceSimInput] = useState('');
  const [deviceActionLoading, setDeviceActionLoading] = useState(false);

  // Handover Modal State
  const [handoverDevice, setHandoverDevice] = useState<PhoneDevice | null>(null);
  const [selectedTargetUser, setSelectedTargetUser] = useState<string>('');
  const [targetEmpIdInput, setTargetEmpIdInput] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverLoading, setHandoverLoading] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoneFilter, setSelectedPhoneFilter] = useState<string>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Realtime Live Timer Tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 30000); // refresh every 30s for duration rendering
    return () => clearInterval(timer);
  }, []);

  // Listen to Phone Devices
  useEffect(() => {
    const qDevices = query(collection(db, 'phone_devices'), orderBy('name', 'asc'));
    const unsubDevices = onSnapshot(qDevices, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhoneDevice[];
      setDevices(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching phone devices:", err);
      setLoading(false);
    });

    return () => unsubDevices();
  }, []);

  // Listen to Phone Usage Logs
  useEffect(() => {
    const qLogs = query(collection(db, 'phone_usage_logs'), orderBy('startTime', 'desc'));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PhoneUsageLog[];
      setLogs(list);
    }, (err) => {
      console.error("Error fetching phone usage logs:", err);
    });

    return () => unsubLogs();
  }, []);

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
        return `${hours}h ${minutes}m`;
      }
      return `${minutes} min`;
    } catch {
      return '--';
    }
  };

  // 1. Admin: Create or Update Phone Device
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleDeleteDevice = async (deviceId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from devices?`)) return;
    try {
      await deleteDoc(doc(db, 'phone_devices', deviceId));
    } catch (err) {
      console.error("Error deleting device:", err);
      alert("Failed to delete device.");
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
        updatedAt: now
      }));

      await batch.commit();
    } catch (err) {
      console.error("Error taking device:", err);
      alert("Failed to start session with this phone.");
    }
  };

  // 3. Action: Initiate Handover to another Agent (by Employee ID or Selection)
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

    setHandoverLoading(true);
    try {
      const now = getBSTISOString();
      const targetName = targetUser.displayName || targetUser.loginHandle || targetUser.email.split('@')[0];
      const targetEmpId = targetUser.employeeId || targetUser.loginHandle || '';
      const currentSenderName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];

      const batch = writeBatch(db);

      // 1. Update Device status to pending_handover
      const devRef = doc(db, 'phone_devices', handoverDevice.id);
      batch.update(devRef, cleanObject({
        status: 'pending_handover',
        pendingHandoverToId: targetUser.id,
        pendingHandoverToName: targetName,
        pendingHandoverToEmpId: targetEmpId,
        pendingHandoverAt: now,
        pendingHandoverNote: handoverNote.trim() || null,
        updatedAt: now
      }));

      // 2. Send in-app notification to the target recipient
      if (targetUser.id) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: targetUser.id,
          title: `📱 Phone Handover Request: ${handoverDevice.name}`,
          message: `${currentSenderName} wants to hand over ${handoverDevice.name} to you. Please open Phone Tracker to Accept or Decline.`,
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
      setHandoverNote('');
    } catch (err) {
      console.error("Error initiating handover:", err);
      alert("Failed to submit handover request.");
    } finally {
      setHandoverLoading(false);
    }
  };

  // 4. Action: Target Agent Approves Handover
  const handleApproveHandover = async (device: PhoneDevice) => {
    if (!currentUser) return;
    if (device.pendingHandoverToId !== currentUser.id && !isAdmin) {
      alert("You are not authorized to approve this handover.");
      return;
    }

    try {
      const now = getBSTISOString();
      const batch = writeBatch(db);

      // 1. Find the active log for the old holder and close it
      const oldHolderId = device.currentHolderId;
      if (oldHolderId) {
        // Find active log for this device
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
            status: 'handed_over',
            handoverToId: currentUser.id,
            handoverToName: currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0],
            handoverToEmpId: currentUser.employeeId || currentUser.loginHandle || '',
            handoverApprovedAt: now
          }));
        });
      }

      // 2. Create new active usage log for the new holder
      const newLogRef = doc(collection(db, 'phone_usage_logs'));
      const newReceiverName = currentUser.displayName || currentUser.loginHandle || currentUser.email.split('@')[0];
      const newReceiverEmpId = currentUser.employeeId || currentUser.loginHandle || '';

      const newLog: PhoneUsageLog = {
        id: newLogRef.id,
        phoneId: device.id,
        phoneName: device.name,
        userId: currentUser.id || '',
        userName: newReceiverName,
        userEmpId: newReceiverEmpId,
        startTime: now,
        status: 'active',
        note: device.pendingHandoverNote ? `Handover note: ${device.pendingHandoverNote}` : undefined,
        createdAt: now
      };
      batch.set(newLogRef, cleanObject(newLog));

      // 3. Update device document with new holder
      const devRef = doc(db, 'phone_devices', device.id);
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
        updatedAt: now
      }));

      // 4. Notify old holder
      if (oldHolderId) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: oldHolderId,
          title: `✅ Handover Accepted: ${device.name}`,
          message: `${newReceiverName} has accepted and received ${device.name}. Your session has ended.`,
          type: 'system',
          isRead: false,
          createdAt: now,
          phoneId: device.id
        });
      }

      await batch.commit();
    } catch (err) {
      console.error("Error approving handover:", err);
      alert("Failed to complete handover approval.");
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
        updatedAt: now
      });

      // If the target declined, notify the current holder
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
        updatedAt: now
      });

      await batch.commit();
    } catch (err) {
      console.error("Error ending phone session:", err);
      alert("Failed to end session.");
    }
  };

  // 7. Filtered Logs for History
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search query (phone name, agent name, emp id)
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

      // User Filter
      if (selectedUserFilter !== 'all' && log.userId !== selectedUserFilter) {
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
  }, [logs, searchQuery, selectedPhoneFilter, selectedUserFilter, startDateFilter, endDateFilter]);

  // 8. Excel Export Functionality
  const handleExportExcel = () => {
    if (filteredLogs.length === 0) {
      alert("No records to export.");
      return;
    }

    const exportData = filteredLogs.map((log, index) => {
      const durationFormatted = log.durationMinutes !== undefined 
        ? `${Math.floor(log.durationMinutes / 60)}h ${log.durationMinutes % 60}m (${log.durationMinutes} mins)`
        : formatDuration(log.startTime, log.endTime);

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
        'Handover Approved Time': log.handoverApprovedAt ? formatBST(log.handoverApprovedAt, 'yyyy-MM-dd hh:mm:ss a') : 'N/A',
        'Notes / Remarks': log.note || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Style column widths
    const columnWidths = [
      { wch: 6 },  // SL
      { wch: 22 }, // Device Name
      { wch: 20 }, // Agent Name
      { wch: 14 }, // Employee ID
      { wch: 24 }, // Start Time
      { wch: 24 }, // End Time
      { wch: 20 }, // Total Duration
      { wch: 18 }, // Session Status
      { wch: 24 }, // Handed Over To
      { wch: 24 }, // Handover Approved Time
      { wch: 25 }  // Notes
    ];
    worksheet['!cols'] = columnWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Phone Usage Report');

    const fileName = `Phone_Handover_History_${formatBST(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Pending incoming handovers for the current logged-in user
  const incomingHandovers = useMemo(() => {
    if (!currentUser) return [];
    return devices.filter(d => d.status === 'pending_handover' && d.pendingHandoverToId === currentUser.id);
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
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              ফোন হ্যান্ডওভার ও ডিউটি ট্র্যাকিং সিস্টেম
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              অফিসের কোন ফোন কার কাছে আছে, কতক্ষণ ধরে ব্যবহার হচ্ছে এবং হ্যান্ডওভারের রিকোয়েস্ট ও সম্পূর্ণ হিস্ট্রি এক্সেল রিপোর্টে ডাউনলোড করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
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
                <span>Add New Phone (নতুন ফোন যুক্ত করুন)</span>
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95"
            >
              <Download size={16} />
              <span>Download Excel (রিপোর্ট ডাউনলোড)</span>
            </button>
          </div>
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
                আপনার কাছে ফোন হ্যান্ডওভার রিকোয়েস্ট এসেছে ({incomingHandovers.length} টি)
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                অনুমোদন (Approve) করলে ফোনটি আপনার দায়িত্বে ট্রান্সফার হয়ে যাবে।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incomingHandovers.map(dev => (
              <div 
                key={dev.id} 
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 shadow-sm flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-slate-800 dark:text-slate-100">{dev.name}</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                      Pending Approval
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                    <p>প্রেরক: <strong className="text-slate-700 dark:text-slate-200">{dev.currentHolderName}</strong> (ID: {dev.currentHolderEmpId || 'N/A'})</p>
                    {dev.pendingHandoverNote && (
                      <p className="italic text-slate-600 dark:text-slate-300">নোট: "{dev.pendingHandoverNote}"</p>
                    )}
                    <p className="text-[10px] text-slate-400">
                      অনুরোধের সময়: {dev.pendingHandoverAt ? formatBST(dev.pendingHandoverAt, 'hh:mm a, dd MMM') : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleApproveHandover(dev)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                  >
                    <CheckCircle2 size={15} />
                    <span>গ্রহণ করুন (Approve)</span>
                  </button>
                  <button
                    onClick={() => handleCancelOrDeclineHandover(dev)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    বাতিল (Decline)
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
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
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
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
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
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History size={16} />
          <span>Handover Records & History ({logs.length})</span>
        </button>
      </div>

      {/* TAB 1: ALL DEVICES / LIVE STATUS */}
      {activeSubTab === 'devices' && (
        <div className="space-y-6">
          {devices.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-3xl flex items-center justify-center mx-auto">
                <Smartphone size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">কোনো ফোন এখনও এন্ট্রি করা হয়নি</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                অ্যাডমিন প্যানেল থেকে "Add New Phone" বাটনে ক্লিক করে অফিসের ফোনগুলোর নাম (যেমন: Phone A, Phone B) যুক্ত করুন।
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
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                            isAvailable 
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' 
                              : isPendingHandover
                                ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                          }`}>
                            <Smartphone size={24} />
                          </div>
                          <div>
                            <h3 className="font-black text-slate-800 dark:text-slate-100 text-base tracking-tight">
                              {device.name}
                            </h3>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                              {device.modelNumber && <span>{device.modelNumber}</span>}
                              {device.simNumber && <span>• SIM: {device.simNumber}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isAvailable && (
                            <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Available (ফ্রি)
                            </span>
                          )}
                          {isInUse && (
                            <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                              In Use (ব্যবহৃত হচ্ছে)
                            </span>
                          )}
                          {isPendingHandover && (
                            <span className="px-3 py-1 text-[10px] font-black uppercase rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 animate-pulse">
                              Handover Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Current Status Body */}
                      <div className="bg-slate-50 dark:bg-slate-850/60 p-4 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                        {isAvailable ? (
                          <div className="text-center py-2 text-xs font-bold text-slate-400 dark:text-slate-500">
                            ফোনটি বর্তমানে অফিসে জমা আছে। যে কেউ কাজ শুরু করতে এটি নিজের কাছে নিতে পারেন।
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400">বর্তমান ব্যবহারকারী:</span>
                              <span className="font-black text-slate-700 dark:text-slate-200">
                                {device.currentHolderName} {device.currentHolderEmpId ? `(${device.currentHolderEmpId})` : ''}
                                {isHeldByMe && <span className="ml-1 text-blue-600 font-bold">(You)</span>}
                              </span>
                            </div>

                            {device.currentSessionStart && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Clock size={13} />
                                  <span>শুরু হয়েছে:</span>
                                </span>
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                  {formatBST(device.currentSessionStart, 'hh:mm a')}
                                </span>
                              </div>
                            )}

                            {device.currentSessionStart && (
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Timer size={13} className="text-blue-500" />
                                  <span>মোট সময়কাল:</span>
                                </span>
                                <span className="font-black text-blue-600 dark:text-blue-400">
                                  {formatDuration(device.currentSessionStart)}
                                </span>
                              </div>
                            )}

                            {isPendingHandover && (
                              <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                                <p className="font-bold">
                                  হ্যান্ডওভার অপেক্ষারত: {device.pendingHandoverToName} ({device.pendingHandoverToEmpId || 'N/A'})
                                </p>
                                {device.pendingHandoverNote && (
                                  <p className="italic text-slate-600 dark:text-slate-400">"{device.pendingHandoverNote}"</p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 justify-between">
                      {/* Scenario 1: Phone is available -> Anyone can take it */}
                      {isAvailable && (
                        <button
                          onClick={() => handleTakePhone(device)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                        >
                          <SmartphoneCharging size={16} />
                          <span>ফোনটি নিন (Take Phone)</span>
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
                              setHandoverNote('');
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                          >
                            <ArrowRightLeft size={15} />
                            <span>Handover (হস্তান্তর)</span>
                          </button>

                          <button
                            onClick={() => handleEndSession(device)}
                            className="flex-1 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                          >
                            <PowerOff size={15} />
                            <span>End (কাজ শেষ)</span>
                          </button>
                        </div>
                      )}

                      {/* Scenario 3: Handover is pending and current user is the target receiver */}
                      {isPendingHandover && device.pendingHandoverToId === currentUser?.id && (
                        <div className="w-full flex items-center gap-2">
                          <button
                            onClick={() => handleApproveHandover(device)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                          >
                            <CheckCircle2 size={15} />
                            <span>Approve Handover</span>
                          </button>
                          <button
                            onClick={() => handleCancelOrDeclineHandover(device)}
                            className="px-3 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      )}

                      {/* Scenario 4: Handover is pending and current user was the sender (allow cancel) */}
                      {isPendingHandover && isHeldByMe && (
                        <button
                          onClick={() => handleCancelOrDeclineHandover(device)}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <XCircle size={15} />
                          <span>Cancel Handover Request</span>
                        </button>
                      )}

                      {/* Scenario 5: Phone held by someone else, Admin controls */}
                      {!isHeldByMe && !isAvailable && isAdmin && (
                        <div className="w-full flex items-center justify-between text-xs">
                          <button
                            onClick={() => handleEndSession(device)}
                            className="text-red-600 hover:underline font-bold"
                          >
                            Force End Session (Admin)
                          </button>
                          {isPendingHandover && (
                            <button
                              onClick={() => handleApproveHandover(device)}
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
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">বর্তমানে আপনার কাছে কোনো ফোন নেই</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                "All Devices" ট্যাব থেকে যেকোনো Available ফোন বেছে নিয়ে "Take Phone" করুন অথবা অন্য কারও হ্যান্ডওভার গ্রহণ করুন।
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
                      <span className="text-slate-500">Session Started (শুরুর সময়):</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {device.currentSessionStart ? formatBST(device.currentSessionStart, 'hh:mm a, dd MMM yyyy') : '--'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Duration (ব্যবহারকাল):</span>
                      <span className="font-black text-blue-600 dark:text-blue-400 text-sm">
                        {device.currentSessionStart ? formatDuration(device.currentSessionStart) : '--'}
                      </span>
                    </div>
                  </div>

                  {device.status === 'pending_handover' ? (
                    <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-3">
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        হ্যান্ডওভার অনুরোধ পাঠানো হয়েছে: {device.pendingHandoverToName} ({device.pendingHandoverToEmpId || 'N/A'})
                      </p>
                      <button
                        onClick={() => handleCancelOrDeclineHandover(device)}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider"
                      >
                        অনুরোধ বাতিল করুন (Cancel Request)
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setHandoverDevice(device);
                          setSelectedTargetUser('');
                          setTargetEmpIdInput('');
                          setHandoverNote('');
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                      >
                        <ArrowRightLeft size={16} />
                        <span>অন্যকে হ্যান্ডওভার করুন (Handover)</span>
                      </button>

                      <button
                        onClick={() => handleEndSession(device)}
                        className="flex-1 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <PowerOff size={16} />
                        <span>ব্যবহার শেষ (End & Return)</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HANDOVER & USAGE HISTORY */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by Agent, Phone, Emp ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-medium focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Phone Dropdown Filter */}
                <select
                  value={selectedPhoneFilter}
                  onChange={(e) => setSelectedPhoneFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                >
                  <option value="all">All Devices (সব ফোন)</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>

                {/* User Dropdown Filter */}
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2.5 text-xs font-semibold focus:outline-none text-slate-700 dark:text-slate-200"
                >
                  <option value="all">All Agents (সব এজেন্ট)</option>
                  {allUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.loginHandle || u.email} {u.employeeId ? `(${u.employeeId})` : ''}
                    </option>
                  ))}
                </select>

                {/* Start Date */}
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs font-medium focus:outline-none text-slate-700 dark:text-slate-200"
                  title="Filter From Date"
                />

                {/* End Date */}
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs font-medium focus:outline-none text-slate-700 dark:text-slate-200"
                  title="Filter To Date"
                />

                {(searchQuery || selectedPhoneFilter !== 'all' || selectedUserFilter !== 'all' || startDateFilter || endDateFilter) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedPhoneFilter('all');
                      setSelectedUserFilter('all');
                      setStartDateFilter('');
                      setEndDateFilter('');
                    }}
                    className="text-xs text-blue-600 font-bold hover:underline px-2"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* History Records Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-base">হ্যান্ডওভার ও ব্যবহারের পূর্ণাঙ্গ রেকর্ড</h3>
                <p className="text-xs text-slate-400">Total {filteredLogs.length} logs recorded</p>
              </div>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all"
              >
                <Download size={14} />
                <span>Export to Excel</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-4 px-5">Device</th>
                    <th className="py-4 px-5">Agent (Employee ID)</th>
                    <th className="py-4 px-5">Start Time</th>
                    <th className="py-4 px-5">End Time</th>
                    <th className="py-4 px-5">Duration</th>
                    <th className="py-4 px-5">Handover / Release Details</th>
                    <th className="py-4 px-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400 text-xs font-semibold">
                        কোনো রেকর্ড পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => {
                      const isStillActive = log.status === 'active';
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                          <td className="py-4 px-5 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <Smartphone size={14} className="text-blue-500 shrink-0" />
                              <span>{log.phoneName}</span>
                            </div>
                          </td>
                          <td className="py-4 px-5">
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100">{log.userName}</p>
                              {log.userEmpId && <p className="text-[10px] text-slate-400">ID: {log.userEmpId}</p>}
                            </div>
                          </td>
                          <td className="py-4 px-5 whitespace-nowrap">
                            {formatBST(log.startTime, 'dd MMM yyyy, hh:mm a')}
                          </td>
                          <td className="py-4 px-5 whitespace-nowrap">
                            {log.endTime ? (
                              formatBST(log.endTime, 'dd MMM yyyy, hh:mm a')
                            ) : (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                Currently In Use
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-5 font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                            {log.durationMinutes !== undefined 
                              ? `${Math.floor(log.durationMinutes / 60)}h ${log.durationMinutes % 60}m`
                              : formatDuration(log.startTime, log.endTime)}
                          </td>
                          <td className="py-4 px-5">
                            {log.handoverToName ? (
                              <div className="space-y-0.5">
                                <p className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                  <ArrowRightLeft size={12} />
                                  <span>Handed over to: {log.handoverToName}</span>
                                </p>
                                {log.handoverToEmpId && (
                                  <p className="text-[10px] text-slate-400">Target ID: {log.handoverToEmpId}</p>
                                )}
                              </div>
                            ) : log.note ? (
                              <span className="italic text-slate-400">{log.note}</span>
                            ) : (
                              <span className="text-slate-400">Returned to Storage</span>
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
                              <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Completed
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
        {showAddDeviceModal && (
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
                      {editingDevice ? 'Edit Phone Details' : 'Add New Phone (নতুন ফোন)'}
                    </h3>
                    <p className="text-xs text-slate-400">অফিসের ডিভাইসের নাম ও সিম তথ্য যুক্ত করুন</p>
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Phone Name / Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Phone A, Phone 1 (Redmi 12)"
                    value={deviceNameInput}
                    onChange={(e) => setDeviceNameInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Model / Brand (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Xiaomi Redmi Note 12 / Samsung A15"
                    value={deviceModelInput}
                    onChange={(e) => setDeviceModelInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    SIM Number / Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 017xxxxxxxx (Customer Care SIM)"
                    value={deviceSimInput}
                    onChange={(e) => setDeviceSimInput(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
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

      {/* MODAL 2: INITIATE HANDOVER MODAL */}
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
                    <p className="text-xs text-slate-400">অন্য এজেন্টের Employee ID দিয়ে হ্যান্ডওভার রিকোয়েস্ট পাঠান</p>
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
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 mb-2"
                  >
                    <option value="">-- Select Agent from List --</option>
                    {allUsers.filter(u => u.id !== currentUser?.id).map(u => (
                      <option key={u.id} value={u.id}>
                        {u.displayName || u.loginHandle || u.email} {u.employeeId ? `[ID: ${u.employeeId}]` : ''}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-bold">OR Type Employee ID:</span>
                    <input
                      type="text"
                      placeholder="e.g. EMP-101, 102"
                      value={targetEmpIdInput}
                      onChange={(e) => {
                        setTargetEmpIdInput(e.target.value);
                        const match = allUsers.find(u => u.employeeId?.toLowerCase() === e.target.value.trim().toLowerCase());
                        if (match?.id) setSelectedTargetUser(match.id);
                      }}
                      className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Handover Note / Remark */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Handover Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shift change, break time, charging, etc."
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-semibold focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                  <p className="font-bold">প্রক্রিয়া কিভাবে কাজ করবে:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-600 dark:text-slate-400">
                    <li>আপনি সাবমিট করলে প্রাপক এজেন্টের কাছে নোটিশ যাবে।</li>
                    <li>সে "Approve" করলেই ফোনটি তার নামে ট্রান্সফার হবে এবং সময় গণনা শুরু হবে।</li>
                  </ul>
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
    </div>
  );
};
