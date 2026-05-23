/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { AppNotification, DataRow, TaskHistoryEntry, ValidationRule, ProductPrice, DEFAULT_RULES, DeliverySettings as IDeliverySettings, DEFAULT_DELIVERY_SETTINGS, UserProfile, GiftRule, SiteSettings, DEFAULT_SITE_SETTINGS, TeamTask } from './types';
import { processData, calculateRow } from './lib/processor';
import { RuleEditor } from './components/RuleEditor';
import { GiftRuleEditor } from './components/GiftRuleEditor';
import { CustomCommandEditor } from './components/CustomCommandEditor';
import { ProductLibrary } from './components/ProductLibrary';
import { ProductTracker } from './components/ProductTracker';
import { TeamWork } from './components/TeamWork';
import { DeliverySettings } from './components/DeliverySettings';
import { GeneralSettings } from './components/GeneralSettings';
import { FileUpload } from './components/FileUpload';
import { DataTable } from './components/DataTable';
import { UserManagement } from './components/UserManagement';
import WelcomeScreen from './components/WelcomeScreen';
import { LiveTenureTracker } from './components/LiveTenureTracker';
import { Printer, BarChart3, Database, ShieldAlert, Sparkles, XCircle, LogIn, LogOut, User, LayoutDashboard, Settings, BookOpen, Package, Moon, Sun, Users, Lock, Mail, AlertTriangle, Clock, Gift, CheckCircle2, ShieldCheck, Activity, Layout, Bell, X, Menu, FileSpreadsheet, UploadCloud, CalendarRange, Search, Download, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { db, auth, logInWithEmail, signOut, signInWithGoogle } from './lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc, getDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { seedProducts } from './lib/seed';
import { handleFirestoreError, OperationType } from './lib/errors';
import { cleanObject, getBSTISOString, formatBST } from './lib/utils';

import { subDays, addDays, parseISO, differenceInMinutes } from 'date-fns';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getInitials, getAvatarColor } from './lib/avatar';
import { PrintSlips } from './components/PrintSlips';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'validation' | 'rules' | 'products' | 'settings' | 'users' | 'tracker' | 'printSlips' | 'team'>('dashboard');
  const [data, setData] = useState<DataRow[]>([]);
  const [rules, setRules] = useState<ValidationRule[]>(DEFAULT_RULES);
  const [delivery, setDelivery] = useState<IDeliverySettings>(DEFAULT_DELIVERY_SETTINGS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [giftRules, setGiftRules] = useState<GiftRule[]>([]);
  const [products, setProducts] = useState<ProductPrice[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'staff' | 'select' | 'admin'>('select');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [hasSeeded, setHasSeeded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [roster, setRoster] = useState<any>(null);
  const [isRosterUploading, setIsRosterUploading] = useState(false);
  const [isCapturingRoster, setIsCapturingRoster] = useState(false);
  const [showFullRoster, setShowFullRoster] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedRosterId, setSelectedRosterId] = useState('');
  const [pendingTasksCount, setPendingTasksCount] = useState(0);

  useEffect(() => {
    if (userProfile?.employeeId) {
      setSelectedRosterId(userProfile.employeeId);
    } else if (userProfile?.displayName) {
      setSelectedRosterId(userProfile.displayName);
    }
  }, [userProfile]);

  useEffect(() => {
    if (!user) {
      setRoster(null);
      return;
    }
    const unsubscribeRoster = onSnapshot(doc(db, 'config', 'staff_roster'), (docSnap) => {
      if (docSnap.exists()) {
        setRoster(docSnap.data());
      } else {
        setRoster(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/staff_roster');
    });
    return () => unsubscribeRoster();
  }, [user]);

  const formatRosterCellValue = (val: any): string => {
    if (val === undefined || val === null) return '';
    
    // If it's a number or can be parsed as a number:
    const num = typeof val === 'number' ? val : parseFloat(String(val).trim());
    if (!isNaN(num) && isFinite(num)) {
      // Check if it's an Excel Date Serial (for years roughly ~2020-2040, the serial range is ~43831 to ~51139)
      if (num >= 40000 && num <= 60000) {
        const utc_days = Math.floor(num - 25569);
        const date = new Date(utc_days * 86400000);
        return formatBST(date, 'd-MMM-yy');
      }
      // Check if it's an Excel Time Fraction (between 0 and 1, exclusive)
      if (num > 0 && num < 1) {
        const totalSeconds = Math.round(num * 24 * 60 * 60);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 === 0 ? 12 : hours % 12;
        const displayMinutes = String(minutes).padStart(2, '0');
        return `${displayHours}:${displayMinutes} ${ampm}`;
      }
    }
    
    return String(val).trim();
  };

  const matchDateToHeader = (headerTemp: string, targetDate: Date): boolean => {
    if (!headerTemp) return false;
    const headerClean = headerTemp.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const formats = [
      'd-MMM-yy',
      'dd-MMM-yy',
      'd-MMM-yyyy',
      'dd-MMM-yyyy',
      'yyyy-MM-dd',
      'd/M/yyyy',
      'dd/MM/yyyy',
      'd-MMM',
      'dd-MMM',
      'd/M',
      'dd/MM'
    ];
    
    for (const fmt of formats) {
      const formatted = formatBST(targetDate, fmt).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (headerClean.includes(formatted) || formatted.includes(headerClean)) {
        return true;
      }
    }
    return false;
  };

  const handleRosterUpload = async (file: File) => {
    try {
      setIsRosterUploading(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result;
        if (!fileData) {
          setIsRosterUploading(false);
          return;
        }
        
        let workbook;
        if (file.name.endsWith('.csv')) {
          const text = new TextDecoder().decode(new Uint8Array(fileData as ArrayBuffer));
          workbook = XLSX.read(text, { type: 'string' });
        } else {
          const bytes = new Uint8Array(fileData as ArrayBuffer);
          workbook = XLSX.read(bytes, { type: 'array' });
        }
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRowsArray: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawRowsArray.length === 0) {
          alert('The uploaded file is empty.');
          setIsRosterUploading(false);
          return;
        }

        let headerRowIndex = -1;
        for (let i = 0; i < rawRowsArray.length; i++) {
          const row = rawRowsArray[i];
          if (row && row.length >= 2) {
            const cellA = String(row[0] || '').toLowerCase().trim();
            const cellB = String(row[1] || '').toLowerCase().trim();
            if (cellA.includes('id') && cellB.includes('name')) {
              headerRowIndex = i;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          headerRowIndex = 0;
        }

        const headers = rawRowsArray[headerRowIndex].map((h, colIdx) => 
          colIdx >= 2 ? formatRosterCellValue(h) : String(h || '').trim()
        );
        
        let subHeaders: string[] = [];
        let dataStartRow = headerRowIndex + 1;
        
        if (rawRowsArray[headerRowIndex + 1]) {
          const nextRow = rawRowsArray[headerRowIndex + 1];
          const firstCell = String(nextRow[0] || '').trim();
          const isNumericId = /^\d+$/.test(firstCell);
          if (!isNumericId && firstCell.toLowerCase() !== 'id' && (nextRow[2] || nextRow[3])) {
            subHeaders = nextRow.map((h, colIdx) => 
              colIdx >= 2 ? formatRosterCellValue(h) : String(h || '').trim()
            );
            dataStartRow = headerRowIndex + 2;
          }
        }

        const rostersRows: any[] = [];
        for (let i = dataStartRow; i < rawRowsArray.length; i++) {
          const row = rawRowsArray[i];
          if (!row || row.length < 2) continue;
          
          const idVal = String(row[0] || '').trim();
          const nameVal = String(row[1] || '').trim();
          if (!idVal && !nameVal) continue;

          const shifts: { [dateKey: string]: string } = {};
          for (let j = 2; j < row.length; j++) {
            const dateHeader = headers[j];
            if (dateHeader) {
              shifts[dateHeader] = formatRosterCellValue(row[j]);
            }
          }

          rostersRows.push({
            id: idVal,
            name: nameVal,
            shifts: shifts
          });
        }

        const rosterPayload = {
          headers: headers,
          subHeaders: subHeaders,
          rows: rostersRows,
          uploadedAt: getBSTISOString(),
          uploadedBy: userProfile?.displayName || user?.email || 'Admin'
        };

        await setDoc(doc(db, 'config', 'staff_roster'), cleanObject(rosterPayload));
        setIsRosterUploading(false);
        alert('Roster uploaded successfully!');
      };
      
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      setIsRosterUploading(false);
      alert('Failed to parse and upload roster: ' + (err as Error).message);
    }
  };

  const handleClearRoster = async () => {
    if (confirm('Are you sure you want to remove the current roster? Users will not see their roster until a new one is uploaded.')) {
      try {
        await deleteDoc(doc(db, 'config', 'staff_roster'));
        alert('Roster cleared successfully.');
      } catch (err) {
        console.error(err);
        alert('Failed to delete roster: ' + (err as Error).message);
      }
    }
  };

  const handleDownloadRosterImage = async () => {
    const node = document.getElementById('admin-roster-table-container');
    if (!node) {
      alert('Roster table element not found.');
      return;
    }

    setIsCapturingRoster(true);
    // Wait for the state to apply and DOM to re-render without the Actions column
    await new Promise((resolve) => setTimeout(resolve, 200));

    try {
      const tableEl = node.querySelector('table');
      const tableWidth = tableEl ? tableEl.scrollWidth : node.scrollWidth;

      const dataUrl = await toPng(node, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0b1329' : '#ffffff',
        width: tableWidth + 32,
        style: {
          width: `${tableWidth}px`,
          maxWidth: 'none',
          overflow: 'visible',
        },
        cacheBust: true,
      });

      const link = document.createElement('a');
      link.download = `Staff_Duty_Roster_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture roster image:', err);
      alert('Failed to save roster image: ' + (err as Error).message);
    } finally {
      setIsCapturingRoster(false);
    }
  };

  const handleDownloadRosterTemplate = () => {
    const today = new Date();
    // Dynamically generate column headers for the next 7 days in the correct format (e.g. 22-MAY-26)
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const headers = ['ID', 'Name'];
    const subHeaders = ['', ''];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < 7; i++) {
      const d = addDays(today, i);
      const dayStr = String(d.getDate()).padStart(2, '0');
      const monStr = monthNames[d.getMonth()];
      const yrStr = String(d.getFullYear()).substring(2);
      const headerKey = `${dayStr}-${monStr}-${yrStr}`;
      headers.push(headerKey);
      subHeaders.push(days[d.getDay()]);
    }

    const sampleRow1 = ['2146', 'MD Ahbab Khan Taousi', '11:00 AM', '11:00 AM', '11:00 AM', '11:00 AM', 'Day Off', '11:00 AM', 'CL'];
    const sampleRow2 = ['2152', 'Aion Ray', '10:00 AM', '10:00 AM', '10:00 AM', '10:00 AM', 'Day Off', '10:00 AM', 'Absent'];
    const sampleRow3 = ['2171', 'Pallab karmakar', 'Day Off', '1:00 PM', '8:00 AM', '1:00 PM', 'Day Off', 'Leave', '1:00 PM'];

    const aoa = [
      headers,
      subHeaders,
      sampleRow1,
      sampleRow2,
      sampleRow3
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roster');
    XLSX.writeFile(wb, 'demo_staff_roster.xlsx');
  };

  const handleRosterCellChangeLocal = (rowIndex: number, field: string, dateHeaderKey: string | null, newValue: string) => {
    if (!roster) return;
    const updatedRows = [...roster.rows];
    if (dateHeaderKey) {
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        shifts: {
          ...updatedRows[rowIndex].shifts,
          [dateHeaderKey]: newValue
        }
      };
    } else {
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [field]: newValue
      };
    }
    setRoster({
      ...roster,
      rows: updatedRows
    });
  };

  const handleRosterCellBlurSave = async () => {
    if (!roster) return;
    try {
      await setDoc(doc(db, 'config', 'staff_roster'), cleanObject(roster));
    } catch (err) {
      console.error("Failed to commit roster changes:", err);
    }
  };

  const handleAddRosterRow = async () => {
    if (!roster) return;
    const newRow = {
      id: "NEW_ID",
      name: "New Staff Name",
      shifts: {}
    };
    const updatedRoster = {
      ...roster,
      rows: [...(roster.rows || []), newRow]
    };
    setRoster(updatedRoster);
    try {
      await setDoc(doc(db, 'config', 'staff_roster'), cleanObject(updatedRoster));
    } catch (err) {
      console.error("Failed to add roster row:", err);
    }
  };

  const handleDeleteRosterRow = async (rowIndex: number) => {
    if (!roster) return;
    if (!window.confirm("Are you sure you want to delete this staff row from the roster?")) return;
    const updatedRows = roster.rows.filter((_: any, idx: number) => idx !== rowIndex);
    const updatedRoster = {
      ...roster,
      rows: updatedRows
    };
    setRoster(updatedRoster);
    try {
      await setDoc(doc(db, 'config', 'staff_roster'), cleanObject(updatedRoster));
    } catch (err) {
      console.error("Failed to delete roster row:", err);
    }
  };

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || user?.email === 'khantaousi@gmail.com';

  useEffect(() => {
    if (userProfile && !hasShownWelcome) {
      setEditedName(userProfile.displayName || '');
      setShowWelcome(true);
      setHasShownWelcome(true);
    }
  }, [userProfile, hasShownWelcome]);

  const saveDisplayName = async () => {
    if (!user || !userProfile) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), cleanObject({ displayName: editedName || '' }));
      setIsEditingName(false);
    } catch (error) {
      console.error("Error updating display name:", error);
      alert("Failed to update name.");
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let heartbeat: NodeJS.Timeout | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      // Clean up previous listeners
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }

      setUser(u);
      if (u) {
        try {
          if (u.email === 'khantaousi@gmail.com' && !hasSeeded) {
            seedProducts();
            setHasSeeded(true);
          }
          
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const isMasterAdmin = u.email === 'khantaousi@gmail.com';
            const newProfile: UserProfile = {
              email: u.email!,
              role: isMasterAdmin ? 'admin' : 'user',
              displayName: u.displayName || u.email!.split('@')[0],
              photoURL: u.photoURL || '',
              createdAt: getBSTISOString(),
              lastSeen: getBSTISOString(),
              isOnline: true,
              isActive: true,
              permissions: isMasterAdmin ? {
                dashboard: 'write',
                rules: 'write',
                products: 'write',
                settings: 'write',
                tracker: 'write',
                printSlips: 'write'
              } : {
                dashboard: 'read',
                rules: 'none',
                products: 'none',
                settings: 'none',
                tracker: 'none',
                printSlips: 'none'
              }
            };
            await setDoc(userRef, cleanObject(newProfile));
            setUserProfile(newProfile);
          } else {
            const profileData = userSnap.data() as UserProfile;
            const updatedProfile = { 
              ...profileData, 
              isOnline: true, 
              lastSeen: getBSTISOString() 
            };
            await updateDoc(userRef, cleanObject({ 
              isOnline: true, 
              lastSeen: getBSTISOString() 
            }));
            setUserProfile({ id: userSnap.id, ...updatedProfile });
          }

          // Heartbeat to keep lastSeen updated while browsing
          heartbeat = setInterval(() => {
            if (auth.currentUser) {
              updateDoc(userRef, cleanObject({ 
                lastSeen: getBSTISOString(),
                isOnline: true 
              })).catch(console.error);
            }
          }, 60000); // Every 1 minute

          unsubscribeProfile = onSnapshot(userRef, (doc) => {
            if (doc.exists()) {
              const profile = { id: doc.id, ...doc.data() } as UserProfile;
              setUserProfile(profile);
              
              // SECURITY: Immediate forced logout if account deactivated
              if (profile.isActive === false && u.email !== 'khantaousi@gmail.com') {
                updateDoc(userRef, cleanObject({ isOnline: false, lastSeen: getBSTISOString() })).catch(console.error);
                signOut();
                setAuthError('Your account has been deactivated by an administrator.');
                setLoginMode('staff');
              }
            }
          }, (error) => {
            // Only log if we're still supposed to be listening (i.e. not signed out)
            if (auth.currentUser) {
              console.error('User profile snapshot error:', error);
            }
          });
        } catch (error) {
          console.error("Auth state synchronization error:", error);
        }
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (heartbeat) clearInterval(heartbeat);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // Sync Rules
    const unsubscribeRules = onSnapshot(doc(db, 'config', 'validation_rules'), (doc) => {
      if (doc.exists()) {
        setRules(doc.data().rules as ValidationRule[]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/validation_rules');
    });

    // Sync Delivery Settings
    const unsubscribeDelivery = onSnapshot(doc(db, 'config', 'delivery_settings'), (doc) => {
      if (doc.exists()) {
        setDelivery(doc.data() as IDeliverySettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/delivery_settings');
    });

    // Sync Gift Rules
    const unsubscribeGifts = onSnapshot(doc(db, 'config', 'gift_rules'), (doc) => {
      if (doc.exists()) {
        setGiftRules(doc.data().rules as GiftRule[]);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/gift_rules');
    });

    // Sync Site Settings
    const unsubscribeSite = onSnapshot(doc(db, 'config', 'site_settings'), (doc) => {
      if (doc.exists()) {
        setSiteSettings(doc.data() as SiteSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/site_settings');
    });

    // Auto-Maintenance Logic (Triggered by Admin)
    const runFrontendMaintenance = async () => {
      if (!isAdmin) return;
      
      try {
        const statusRef = doc(db, 'config', 'system_status');
        const statusSnap = await getDoc(statusRef);
        const todayStr = formatBST(new Date(), 'yyyy-MM-dd');
        
        if (!statusSnap.exists() || statusSnap.data().lastResetDate !== todayStr) {
          console.log("Running Daily Maintenance Reset (Frontend Mode)...");
          
          // Find all tasks to process past-day active and completed daily ones
          const q = query(collection(db, 'tasks'));
          const tasksSnap = await getDocs(q);
          
          if (tasksSnap.empty) {
            await setDoc(statusRef, { lastResetDate: todayStr }, { merge: true });
            return;
          }

          const batch = writeBatch(db);
          let count = 0;

          for (const docSnap of tasksSnap.docs) {
            const t = docSnap.data() as TeamTask;
            if (t.isHistorySnapshot) continue;

            const taskDate = formatBST(parseISO(t.assignedAt), 'yyyy-MM-dd');
            if (taskDate === todayStr) continue;

            // Case A & B: Unfinished tasks (started but not completed) or completed daily tasks from yesterday/past
            const isUnfinished = t.status === 'in-progress' || t.status === 'paused';
            const isCompletedDaily = t.isEveryday && t.status === 'completed';

            if (isUnfinished) {
              // Calculate auto-completed/submitted details at end of its day (23:59:59 Bangladesh Time)
              const endOfTaskDayStr = taskDate + 'T23:59:59.999+06:00';
              const startTimeStr = t.startedAt || t.assignedAt;
              const rawDuration = differenceInMinutes(parseISO(endOfTaskDayStr), parseISO(startTimeStr));
              const durationMinutes = Math.max(0, rawDuration - (t.totalPauseMinutes || 0));
              
              const newHistory = [...(t.history || []), {
                status: 'completed' as const,
                timestamp: getBSTISOString(),
                performerId: 'system-auto',
                performerName: 'Auto-Submit System',
                note: 'Automated midnight auto-submit for unfinished task'
              }];

              if (t.isEveryday) {
                // Daily task - Archive completion snap and reset master to pending for today
                const archiveId = doc(collection(db, 'tasks')).id;
                const archiveData = {
                  ...t,
                  id: archiveId,
                  isEveryday: false,
                  isHistorySnapshot: true,
                  status: 'completed' as const,
                  completedAt: endOfTaskDayStr,
                  durationMinutes,
                  updatedAt: getBSTISOString(),
                  history: newHistory
                };
                batch.set(doc(db, 'tasks', archiveId), cleanObject(archiveData));

                batch.update(docSnap.ref, cleanObject({
                  status: 'pending',
                  startedAt: null,
                  completedAt: null,
                  durationMinutes: null,
                  totalPauseMinutes: 0,
                  lastPausedAt: null,
                  resumedAt: null,
                  isApproved: false,
                  isRejected: false,
                  assignedAt: getBSTISOString(),
                  history: [{
                    status: 'created',
                    timestamp: getBSTISOString(),
                    performerId: 'system-auto',
                    performerName: 'Auto-Submit System',
                    note: 'Automated Daily Cycle Reset after Midnight Auto-Submit'
                  }]
                }));
                count += 2;
              } else {
                // General task - Just auto-complete/submit it
                batch.update(docSnap.ref, cleanObject({
                  status: 'completed',
                  completedAt: endOfTaskDayStr,
                  durationMinutes,
                  updatedAt: getBSTISOString(),
                  history: newHistory
                }));
                count += 1;
              }
            } else if (isCompletedDaily) {
              // Archive old completed daily task and reset master
              const archiveId = doc(collection(db, 'tasks')).id;
              const archiveData = {
                ...t,
                id: archiveId,
                isEveryday: false,
                isHistorySnapshot: true,
                status: 'completed' as const,
                updatedAt: getBSTISOString()
              };
              batch.set(doc(db, 'tasks', archiveId), cleanObject(archiveData));

              batch.update(docSnap.ref, cleanObject({
                status: 'pending',
                startedAt: null,
                completedAt: null,
                durationMinutes: null,
                totalPauseMinutes: 0,
                lastPausedAt: null,
                resumedAt: null,
                isApproved: false,
                isRejected: false,
                assignedAt: getBSTISOString(),
                history: [{
                  status: 'created',
                  timestamp: getBSTISOString(),
                  performerId: 'system-auto',
                  performerName: 'Auto-Submit System',
                  note: 'Automated Daily Cycle Reset'
                }]
              }));
              count += 2;
            } else if (t.isEveryday && t.status === 'pending') {
              // Case C: Update date of pending daily task so it shows on today's board
              batch.update(docSnap.ref, {
                assignedAt: getBSTISOString()
              });
              count += 1;
            }
          }

          if (count > 0) {
            await batch.commit();
            console.log(`Maintenance: Archived and reset ${count} everyday tasks.`);
          }
          
          await setDoc(statusRef, { lastResetDate: todayStr }, { merge: true });
        }
      } catch (err) {
        console.error("Failed to run automated maintenance:", err);
      }
    };

    runFrontendMaintenance();

    return () => {
      unsubscribeRules();
      unsubscribeDelivery();
      unsubscribeGifts();
      unsubscribeSite();
    };
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !userProfile) {
      setPendingTasksCount(0);
      return;
    }

    let q;
    if (isAdmin) {
      // Admin sees self-assigned tasks awaiting approval
      q = query(
        collection(db, 'tasks'),
        where('isSelfAssigned', '==', true),
        where('isApproved', '==', false)
      );
    } else {
      // Agent sees tasks assigned to them that are not yet completed
      q = query(
        collection(db, 'tasks'),
        where('assigneeId', '==', user.uid),
        where('status', 'in', ['pending', 'in-progress'])
      );
    }

    const unsubscribeTasks = onSnapshot(q, (snapshot) => {
      if (isAdmin) {
        // For admin, explicitly filter out rejected tasks if not captured by query
        const count = snapshot.docs.filter(doc => !doc.data().isRejected).length;
        setPendingTasksCount(count);
      } else {
        setPendingTasksCount(snapshot.size);
      }
    }, (error) => {
      console.error("Pending tasks count error:", error);
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribeTasks();
  }, [user, userProfile, isAdmin]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeNotif = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AppNotification[]);
    }, (error) => {
      console.error("Notifications snapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
    return () => unsubscribeNotif();
  }, [user]);

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => {
      if (n.id) batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    await batch.commit();
  };

  useEffect(() => {
    if (!user) {
      setProducts([]);
      return;
    }

    console.log('User logged in with email:', user.email, 'and UID:', user.uid);
    // Only fetch products if signed in
    if (user) {
      const q = query(collection(db, 'products'), orderBy('name', 'asc'));
      const unsubscribeProducts = onSnapshot(q, (snapshot) => {
        const productList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductPrice[];
        setProducts(productList);
      }, (error) => {
        console.error('Products snapshot error:', error);
        handleFirestoreError(error, OperationType.LIST, 'products');
      });
      return () => unsubscribeProducts();
    }
  }, [user]);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const userList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserProfile[];
        // Sort by Role (Admin first) then lastSeen descending
        const sortedUsers = [...userList].sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          
          const timeA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
          const timeB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
          return timeB - timeA;
        });
        setAllUsers(sortedUsers);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
      return () => unsubscribeUsers();
    } else {
      setAllUsers([]);
    }
  }, [userProfile]);

  const handleDataLoaded = async (rows: any[]) => {
    setRawRows(rows);
    setIsLoading(true);
    setProgress(0);
    try {
      const processed = await processData(rows, rules, products, giftRules, delivery, siteSettings, (p) => setProgress(p));
      setData(processed);
    } catch (error) {
      console.error("Processing failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setData([]);
    setRawRows([]);
    setProgress(0);
    setResetTrigger(prev => prev + 1);
  };

  const updateRowPrice = (id: string, newPrice: number) => {
    setData(prev => prev.map(row => {
      if (row.id === id) {
        const updatedRow = { ...row, extractedBasePrice: newPrice };
        return calculateRow(updatedRow, rules, delivery, siteSettings.amountTolerance);
      }
      return row;
    }));
  };

  const handleRulesUpdate = async (newRules: ValidationRule[]) => {
    setRules(newRules);
    try {
      await setDoc(doc(db, 'config', 'validation_rules'), cleanObject({ rules: newRules }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/validation_rules');
    }
    
    if (rawRows.length > 0) {
      setIsLoading(true);
      const processed = await processData(rawRows, newRules, products, giftRules, delivery, siteSettings, (p) => setProgress(p));
      setData(processed);
      setIsLoading(false);
    }
  };

  const handleGiftRulesUpdate = async (newRules: GiftRule[]) => {
    setGiftRules(newRules);
    try {
      await setDoc(doc(db, 'config', 'gift_rules'), cleanObject({ rules: newRules }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/gift_rules');
    }
    
    if (rawRows.length > 0) {
      setIsLoading(true);
      const processed = await processData(rawRows, rules, products, newRules, delivery, siteSettings, (p) => setProgress(p));
      setData(processed);
      setIsLoading(false);
    }
  };

  const handleDeliveryUpdate = async (newSettings: IDeliverySettings) => {
    setDelivery(newSettings);
    try {
      await setDoc(doc(db, 'config', 'delivery_settings'), cleanObject(newSettings));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/delivery_settings');
    }

    if (rawRows.length > 0) {
      setIsLoading(true);
      const processed = await processData(rawRows, rules, products, giftRules, newSettings, siteSettings, (p) => setProgress(p));
      setData(processed);
      setIsLoading(false);
    }
  };

  const handleSiteSettingsUpdate = async (newSettings: SiteSettings) => {
    setSiteSettings(newSettings);
    try {
      await setDoc(doc(db, 'config', 'site_settings'), cleanObject(newSettings));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/site_settings');
    }

    if (rawRows.length > 0) {
      setIsLoading(true);
      const processed = await processData(rawRows, rules, products, giftRules, delivery, newSettings, (p) => setProgress(p));
      setData(processed);
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (name: string, price: number, wholesalePrice?: number, wholesaleThreshold?: number) => {
    if (!user) {
      alert("Please sign in to modify the product library.");
      return;
    }
    try {
      await addDoc(collection(db, 'products'), cleanObject({
        name,
        price,
        wholesalePrice: wholesalePrice ?? null,
        wholesaleThreshold: wholesaleThreshold ?? null,
        updatedAt: getBSTISOString()
      }));
      alert('Product added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const handleBulkAddProducts = async (productsToAdd: any[]) => {
    if (!user) {
      alert("Please sign in to modify the product library.");
      return;
    }
    
    try {
      const batch = writeBatch(db);
      let count = 0;
      
      for (const p of productsToAdd) {
        if (!p.name || p.price === undefined) continue;
        const ref = doc(collection(db, 'products'));
        batch.set(ref, cleanObject({
          name: p.name,
          price: Number(p.price) || 0,
          wholesalePrice: p.wholesalePrice ? Number(p.wholesalePrice) : null,
          wholesaleThreshold: p.wholesaleThreshold ? Number(p.wholesaleThreshold) : null,
          updatedAt: getBSTISOString()
        }));
        count++;
      }
      
      if (count > 0) {
        await batch.commit();
        alert(`Successfully added ${count} products in bulk!`);
      } else {
        alert("No valid products found in the file.");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleBulkDeleteProducts = async (ids: string[]) => {
    if (!user) return;
    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        batch.delete(doc(db, 'products', id));
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  const handleUpdateProduct = async (id: string, name: string, price: number, wholesalePrice?: number, wholesaleThreshold?: number) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'products', id), cleanObject({
        name,
        price,
        wholesalePrice: wholesalePrice ?? null,
        wholesaleThreshold: wholesaleThreshold ?? null,
        updatedAt: getBSTISOString()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${id}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), cleanObject({
        role: newRole
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      await logInWithEmail(authEmail, authPass);
    } catch (error: any) {
      setAuthError('Authentication failed. Check credentials.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.user.email !== 'khantaousi@gmail.com') {
        await signOut();
        setAuthError('Access Denied: Only Master Administrator can use Google Sign-in.');
        setLoginMode('select');
      }
    } catch (error: any) {
      if (error.code !== 'auth/cancelled-popup-request') {
        setAuthError('Master Auth failed. Please try again.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const canWriteToTab = (tab: typeof activeTab) => {
    if (user?.email === 'khantaousi@gmail.com') return true;
    if (userProfile?.role === 'admin') return true;
    const key = tab === 'validation' ? 'dashboard' : tab;
    return (userProfile?.permissions?.[key as keyof UserProfile['permissions']] || 'none') === 'write';
  };

  const hasAccess = (tab: typeof activeTab) => {
    if (user?.email === 'khantaousi@gmail.com') return true;
    if (userProfile?.role === 'admin') return true;
    if (tab === 'users') return false;
    const key = tab === 'validation' ? 'dashboard' : tab;
    return (userProfile?.permissions?.[key as keyof UserProfile['permissions']] || 'none') !== 'none';
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar: Navigation */}
      <aside className={`fixed md:static inset-y-0 left-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 shadow-sm z-30 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isSidebarCollapsed ? 'w-20 md:translate-x-0' : 'w-72 md:translate-x-0'}`}>
        <div className={`transition-all duration-300 ${isSidebarCollapsed ? 'p-3' : 'p-8'}`}>
          <div className={`flex items-center gap-3 mb-12 ${isSidebarCollapsed ? 'justify-center mb-6' : ''}`}>
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden transition-shadow duration-300 shrink-0">
              {siteSettings.logoUrl ? (
                <img src={siteSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Database className="text-slate-600 dark:text-slate-400" size={20} />
              )}
            </div>
            <div className={isSidebarCollapsed ? 'hidden' : 'block'}>
              <h1 className="font-black text-xl tracking-tighter text-slate-800 dark:text-slate-100">{siteSettings.companyName.split(' ')[0]} <span className="text-blue-600">{siteSettings.companyName.split(' ').slice(1).join(' ')}</span></h1>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest leading-none">Intelligence v1.0</p>
            </div>
          </div>
          
          <nav className="space-y-8">
            <div>
              <p className={`text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 pl-4 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Core Workspace</p>
              <div className="space-y-1">
                {hasAccess('dashboard') && (
                  <button 
                    onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "Dashboard" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'dashboard' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <LayoutDashboard size={18} className="shrink-0" />
                    <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Dashboard</span>
                  </button>
                )}

                {hasAccess('validation') && (
                  <button 
                    onClick={() => { setActiveTab('validation'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "Double Check" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'validation' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Database size={18} className="shrink-0" />
                    <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Double Check</span>
                  </button>
                )}

                {userProfile && (
                  <button 
                    onClick={() => { setActiveTab('team'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "Team Work" : undefined}
                    className={`relative w-full flex items-center justify-between gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'team' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Layout size={18} className="shrink-0" />
                      <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Team Work</span>
                    </div>
                    {pendingTasksCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`${isSidebarCollapsed ? 'absolute -top-1 -right-1' : ''} bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-sm min-w-[20px] max-h-[16px] animate-pulse`}
                      >
                        {pendingTasksCount > 9 ? '9+' : pendingTasksCount}
                      </motion.span>
                    )}
                  </button>
                )}

                {hasAccess('tracker') && (
                  <button 
                    onClick={() => { setActiveTab('tracker'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "Product Tracking (PT)" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'tracker' 
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Activity size={18} className="shrink-0" />
                    <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Product Tracking (PT)</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className={`text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 pl-4 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Configuration</p>
              <div className="space-y-1">
                {hasAccess('rules') && (
                  <button 
                    onClick={() => { setActiveTab('rules'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "Logic Rules" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'rules' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen size={18} className="shrink-0" />
                    <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Logic Rules</span>
                  </button>
                )}
                
                {hasAccess('products') && (
                  <button 
                    onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "Product Library" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'products' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Package size={18} className="shrink-0" />
                    <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Product Library</span>
                  </button>
                )}

                {hasAccess('settings') && (
                  <button 
                    onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "Delivery Settings" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'settings' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Settings size={18} className="shrink-0" />
                    <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Delivery Settings</span>
                  </button>
                )}
                
                {isAdmin && (
                  <button 
                    onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
                    title={isSidebarCollapsed ? "User Access" : undefined}
                    className={`w-full flex items-center gap-3 rounded-xl text-xs font-bold transition-all border ${isSidebarCollapsed ? 'justify-center py-3 px-0' : 'px-4 py-3'} ${
                      activeTab === 'users' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users size={18} className="shrink-0" />
                    <span className={isSidebarCollapsed ? 'hidden' : 'block'}>User Access</span>
                  </button>
                )}
              </div>
            </div>
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
          {user && (
            <button 
              onClick={() => setShowSignOutConfirm(true)}
              title={isSidebarCollapsed ? "Sign Out Session" : undefined}
              className={`w-full flex items-center gap-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/20 shadow-sm group ${isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-3'}`}
            >
              <LogOut size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
              <span className={isSidebarCollapsed ? 'hidden' : 'block'}>Sign Out Session</span>
            </button>
          )}

          <div className={`px-4 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
            <div className="flex items-center gap-2 mb-4 text-[10px] font-bold uppercase text-slate-400 tracking-widest">
              <Sparkles size={12} className="text-blue-500" />
              Created by <a href="https://md-ahbab-khan-taousi.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-[#1858ff] font-black hover:opacity-80 transition-opacity cursor-pointer">Taousi</a>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
              <div className="flex items-center justify-between mb-1">
                <a href="https://md-ahbab-khan-taousi.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-xs font-black text-[#1858ff] hover:opacity-80 transition-opacity cursor-pointer">Taousi Intelligence</a>
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Ultra-high precision engine</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative">
        <AnimatePresence>
          {showWelcome && <WelcomeScreen onComplete={() => setShowWelcome(false)} userProfile={userProfile} user={user} />}
        </AnimatePresence>
        {/* Top Header Bar */}
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-10 shrink-0 sticky top-0 z-10 transition-colors duration-300">
          <div className="flex items-center gap-5">
            <button
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsSidebarOpen(!isSidebarOpen);
                } else {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                }
              }}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-slate-200 dark:border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center shadow-sm"
              title={isSidebarCollapsed ? "Show Menu" : "Hide Menu"}
            >
              <Menu size={18} />
            </button>
            <div className={`flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 transition-colors duration-300 ${data.length === 0 ? 'animate-border-green' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${data.length > 0 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600 dark:text-slate-400">
                {data.length > 0 ? 'Data Active' : 'System Ready'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
            <h2 className="text-slate-400 dark:text-slate-500 text-sm font-bold tracking-tight uppercase">
              {activeTab === 'dashboard' ? 'Performance Dashboard' : activeTab === 'validation' ? 'Double Check' : `Config / ${activeTab}`}
            </h2>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-slate-200 dark:border-slate-700 active:scale-95"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user && (
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowNotifications(!showNotifications);
                    if (!showNotifications) markAllAsRead();
                  }}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-slate-200 dark:border-slate-700 active:scale-95 relative group"
                >
                  <motion.div
                    whileHover={{ 
                      rotate: [0, -20, 20, -20, 20, 0],
                      transition: { duration: 0.5, ease: "easeInOut", repeat: Infinity }
                    }}
                    style={{ originY: 0.2 }}
                  >
                    <Bell size={18} />
                  </motion.div>
                  {notifications.filter(n => !n.isRead).length > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  )}
                </button>
                
                <AnimatePresence>
                  {showNotifications && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.15)] z-50 overflow-hidden"
                      >
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notifications</span>
                          <button onClick={markAllAsRead} className="text-[9px] font-black text-blue-600 uppercase hover:underline">Mark all read</button>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase italic">No alerts</p>
                            </div>
                          ) : (
                            notifications.map((n, i) => (
                              <div 
                                key={n.id || i} 
                                onClick={() => {
                                  if (n.taskId) {
                                    setActiveTab('team');
                                    setShowNotifications(false);
                                  }
                                }}
                                className={`p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800 relative ${!n.isRead ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                              >
                                <p className="text-[10px] font-black text-slate-800 dark:text-white uppercase mb-1">{n.title}</p>
                                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-tight mb-2">{n.message}</p>
                                <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase italic">{formatBST(parseISO(n.createdAt), 'MMM dd, HH:mm')}</span>
                                {!n.isRead && <div className="absolute top-5 right-5 w-1.5 h-1.5 bg-blue-600 rounded-full" />}
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-1.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
                <div className="relative">
                  <div className={`w-8 h-8 rounded-lg ${getAvatarColor(userProfile?.displayName || user.email)} flex items-center justify-center text-white text-xs font-black shadow-sm`}>
                    {getInitials(userProfile?.displayName || user.email)}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 border-white dark:border-slate-800 rounded-full ${userProfile?.isActive !== false ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-slate-300'}`} />
                  {userProfile?.isOnline && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75" />
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    {isEditingName ? (
                      <div className="flex gap-1 items-center">
                        <input 
                          value={editedName} 
                          onChange={(e) => setEditedName(e.target.value)}
                          className="text-xs font-bold bg-slate-100 dark:bg-slate-900 border px-1"
                        />
                        <button onClick={saveDisplayName} className="text-xs text-green-600">Save</button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight cursor-pointer hover:text-blue-600" onClick={() => setIsEditingName(true)}>
                        {userProfile?.displayName || user.email?.split('@')[0]}
                      </span>
                    )}
                    {userProfile && (
                      <span className={`text-[8px] font-black uppercase px-1 rounded ${userProfile.role === 'admin' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                        {userProfile.role}
                      </span>
                    )}
                  </div>
                  {userProfile?.employeeId && (
                    <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 mt-0.5 tracking-wider self-start bg-blue-500/10 dark:bg-blue-500/20 px-1 py-0.5 rounded">
                      ID: {userProfile.employeeId}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <ShieldAlert size={14} className="text-amber-500" />
                Access Restricted
              </div>
            )}
            
            {data.length > 0 && activeTab === 'validation' && (
              <div className="flex gap-2">
                {hasAccess('printSlips') && (
                  <button 
                    onClick={() => setActiveTab('printSlips')}
                    className="flex items-center gap-2 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 hover:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-black/10 dark:shadow-none active:scale-95"
                  >
                    <Printer size={16} />
                    Print Slips
                  </button>
                )}
                {canWriteToTab('validation') && (
                  <button 
                    onClick={handleClear}
                    className="flex items-center gap-2 text-slate-500 hover:text-red-500 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                  >
                    <XCircle size={16} />
                    Reset System
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Canvas Area */}
        <section className="flex-1 overflow-y-auto p-10">
          <div className="max-w-7xl mx-auto">
            {!user ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center relative"
              >
                {/* Admin Access Pin */}
                <div className="absolute top-0 right-0">
                  <button 
                    onClick={() => setLoginMode('admin')}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-500 hover:border-blue-500/50 transition-all shadow-sm group"
                    title="Administration Portal"
                  >
                    <ShieldAlert size={16} className="group-hover:scale-110 transition-transform" />
                  </button>
                </div>

                <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-blue-200 dark:shadow-none">
                  <Lock className="text-white" size={32} />
                </div>
                <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-4 uppercase">System Gateway</h2>
                <p className="text-slate-400 dark:text-slate-500 max-w-md mx-auto mb-10 font-medium leading-relaxed">
                  PriceVal Pro extraction environment is restricted. Select your authorization channel to initialize session.
                </p>

                <AnimatePresence mode="wait">
                  {loginMode === 'select' && (
                    <motion.div 
                      key="select"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex flex-col gap-4 w-full max-w-xs"
                    >
                      <button 
                        onClick={() => setLoginMode('staff')}
                        disabled={isAuthLoading}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:border-blue-500 transition-all group disabled:opacity-50"
                      >
                        <LogIn size={18} className="text-slate-400 group-hover:text-blue-500" />
                        Login
                      </button>
                    </motion.div>
                  )}

                  {loginMode === 'staff' && (
                    <motion.form 
                      key="staff"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleLogin} 
                      className="w-full max-w-sm space-y-4"
                    >
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          required type="text" placeholder="abc@gmail.com" 
                          disabled={isAuthLoading}
                          value={authEmail} onChange={e => setAuthEmail(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold disabled:opacity-50"
                        />
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          required type="password" placeholder="Assigned Passphrase" 
                          disabled={isAuthLoading}
                          value={authPass} onChange={e => setAuthPass(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold disabled:opacity-50"
                        />
                      </div>
                      {authError && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-red-100 dark:border-red-900/20">
                          {authError}
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button 
                          type="button"
                          disabled={isAuthLoading}
                          onClick={() => setLoginMode('select')}
                          className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-50"
                        >
                          Go Back
                        </button>
                        <button 
                          type="submit"
                          disabled={isAuthLoading}
                          className="flex-[2] bg-slate-900 dark:bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 dark:hover:bg-blue-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                          {isAuthLoading ? (
                            <Clock className="animate-spin" size={20} />
                          ) : (
                            <LogIn size={20} />
                          )}
                          Initialize Agent
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {loginMode === 'admin' && (
                    <motion.div 
                      key="admin"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="w-full max-w-sm space-y-6"
                    >
                      <div className="p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-3xl text-left">
                        <h4 className="text-amber-800 dark:text-amber-400 font-black text-sm uppercase tracking-tighter mb-2">Notice: Administrative Override</h4>
                        <p className="text-amber-600 dark:text-amber-500 text-[11px] font-medium leading-relaxed">
                          This entry point utilizes Master Google Authentication. Access is strictly logged and restricted to authorized system maintainers.
                        </p>
                      </div>
                      <div className="flex gap-3 w-full">
                        <button 
                          onClick={() => setLoginMode('select')}
                          disabled={isAuthLoading}
                          className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 disabled:opacity-50"
                        >
                          Staff Portal
                        </button>
                        <button 
                          onClick={handleGoogleLogin}
                          disabled={isAuthLoading}
                          className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 dark:shadow-none disabled:opacity-50"
                        >
                          {isAuthLoading ? (
                            <Clock className="animate-spin" size={20} />
                          ) : (
                            <LogIn size={20} />
                          )}
                          Google Admin Sign In
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : !userProfile ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-40 text-center"
              >
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center mb-8">
                  <ShieldAlert className="text-amber-600" size={32} />
                </div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-4">PROFILE PENDING</h2>
                <p className="text-slate-400 dark:text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
                  Your identity has been verified, but your operational profile is still being provisioned by a system administrator.
                </p>
                <div className="mt-8 flex gap-4">
                  <button onClick={() => signOut()} className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600">Switch Account</button>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && hasAccess('dashboard') && (
                  <motion.div 
                    key="dashboard"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6 max-w-5xl mx-auto"
                  >
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-900 dark:text-white pointer-events-none">
                        <LayoutDashboard size={120} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                        Welcome Back, <span className="text-blue-600 dark:text-blue-400">{userProfile?.displayName || user?.email || 'User'}</span>
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">
                        Access your command center modules and tools from the left-side workspace menu.
                      </p>
                    </div>

                    {userProfile && (
                      <motion.div
                        initial={{ opacity: 0, y: -15 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <LiveTenureTracker joiningDate={userProfile?.joiningDate} createdAt={userProfile?.createdAt} variant="banner" />
                      </motion.div>
                    )}

                    {/* Duty Roster Section */}
                    {(() => {
                      const loggedInEmployeeId = userProfile?.employeeId?.trim();
                      const loggedInName = userProfile?.displayName?.trim().toLowerCase();

                      const userRosterRow = roster?.rows?.find((row: any) => {
                        const idMatches = loggedInEmployeeId && row.id && String(row.id).trim() === loggedInEmployeeId;
                        const nameMatches = loggedInName && row.name && String(row.name).trim().toLowerCase() === loggedInName;
                        return idMatches || nameMatches;
                      });

                      const todayDate = new Date();
                      const yesterdayDate = subDays(todayDate, 1);
                      const tomorrowDate = addDays(todayDate, 1);

                      let yesterdayShift: any = null;
                      if (roster && roster.headers && userRosterRow) {
                        for (let i = 2; i < roster.headers.length; i++) {
                          const header = roster.headers[i];
                          if (matchDateToHeader(header, yesterdayDate)) {
                            yesterdayShift = {
                              date: header,
                              weekday: roster.subHeaders?.[i] || formatBST(yesterdayDate, 'EEEE'),
                              shift: userRosterRow.shifts?.[header] || 'No Shift Assigned'
                            };
                            break;
                          }
                        }
                      }

                      let todayShift: any = null;
                      if (roster && roster.headers && userRosterRow) {
                        for (let i = 2; i < roster.headers.length; i++) {
                          const header = roster.headers[i];
                          if (matchDateToHeader(header, todayDate)) {
                            todayShift = {
                              date: header,
                              weekday: roster.subHeaders?.[i] || formatBST(todayDate, 'EEEE'),
                              shift: userRosterRow.shifts?.[header] || 'No Shift Assigned'
                            };
                            break;
                          }
                        }
                      }

                      let tomorrowShift: any = null;
                      if (roster && roster.headers && userRosterRow) {
                        for (let i = 2; i < roster.headers.length; i++) {
                          const header = roster.headers[i];
                          if (matchDateToHeader(header, tomorrowDate)) {
                            tomorrowShift = {
                              date: header,
                              weekday: roster.subHeaders?.[i] || formatBST(tomorrowDate, 'EEEE'),
                              shift: userRosterRow.shifts?.[header] || 'No Shift Assigned'
                            };
                            break;
                          }
                        }
                      }

                      const getShiftStyle = (shiftVal: string) => {
                        const norm = String(shiftVal || '').toLowerCase().trim();
                        if (!norm || norm === 'no shift assigned') {
                          return 'bg-slate-50/80 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500';
                        }
                        if (norm.includes('off') || norm.includes('day off') || norm.includes('leave') || norm.includes('leav') || norm.includes('lve')) {
                          return 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400';
                        }
                        if (norm === 'cl' || norm === 'sl' || norm.includes('absent')) {
                          return 'bg-red-50/80 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 text-red-650 dark:text-red-400 font-extrabold';
                        }
                        return 'bg-blue-50/80 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/20 text-blue-600 dark:text-blue-400 font-bold';
                      };

                      return (
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                                <CalendarRange size={20} />
                              </div>
                              <div>
                                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Personal Work Duty Roster</h4>
                                <p className="text-xs text-slate-400 dark:text-slate-500">Live work shifts for today and tomorrow mapped dynamically</p>
                              </div>
                            </div>
                            
                            {/* Admin Upload / Clear Area */}
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                {roster ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={handleDownloadRosterTemplate}
                                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-350 hover:bg-slate-150 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                                    >
                                      <Download size={13} />
                                      Demo Template
                                    </button>
                                    <button
                                      onClick={handleClearRoster}
                                      className="flex items-center gap-2 text-xs font-bold text-red-500 hover:text-red-650 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                                    >
                                      Clear Active Roster
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={handleDownloadRosterTemplate}
                                      className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-350 hover:bg-slate-150 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                                    >
                                      <Download size={13} />
                                      Demo Template
                                    </button>
                                    <input
                                      type="file"
                                      accept=".xlsx,.xls,.csv"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleRosterUpload(file);
                                      }}
                                      className="hidden"
                                      id="dashboard-roster-upload"
                                    />
                                    <label
                                      htmlFor="dashboard-roster-upload"
                                      className="flex items-center gap-2 text-xs font-black text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                                    >
                                      <UploadCloud size={14} />
                                      Upload Roster
                                    </label>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {roster ? (
                            <div className="space-y-6">

                              {userRosterRow ? (
                                <div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Yesterday's Duty */}
                                    <div className={`p-6 rounded-2xl border transition-all ${getShiftStyle(yesterdayShift?.shift || '')}`}>
                                      <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Yesterday (গতকাল)</span>
                                        <span className="text-xs font-bold">{yesterdayShift?.date || formatBST(yesterdayDate, 'dd-MMM-yyyy')}</span>
                                      </div>
                                      <h5 className="text-base font-black capitalize">{yesterdayShift?.weekday || formatBST(yesterdayDate, 'EEEE')}</h5>
                                      <div className="mt-4 text-2xl font-black tracking-tight uppercase">
                                        {yesterdayShift?.shift || 'No Shift Assigned'}
                                      </div>
                                    </div>

                                    {/* Today's Duty */}
                                    <div className={`p-6 rounded-2xl border transition-all relative overflow-hidden ${getShiftStyle(todayShift?.shift || '')}`}>
                                      <div className="absolute top-4 right-4 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                      </div>
                                      <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Today (আজকের ডিউটি)</span>
                                        <span className="text-xs font-bold">{todayShift?.date || formatBST(todayDate, 'dd-MMM-yyyy')}</span>
                                      </div>
                                      <h5 className="text-base font-black capitalize">{todayShift?.weekday || formatBST(todayDate, 'EEEE')}</h5>
                                      <div className="mt-4 text-3xl font-black tracking-tight uppercase">
                                        {todayShift?.shift || 'No Shift Assigned'}
                                      </div>
                                    </div>

                                    {/* Tomorrow's Duty */}
                                    <div className={`p-6 rounded-2xl border transition-all relative overflow-hidden ${getShiftStyle(tomorrowShift?.shift || '')}`}>
                                      <div className="absolute top-4 right-4 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                                      </div>
                                      <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Tomorrow (আগামীকাল)</span>
                                        <span className="text-xs font-bold">{tomorrowShift?.date || formatBST(tomorrowDate, 'dd-MMM-yyyy')}</span>
                                      </div>
                                      <h5 className="text-base font-black capitalize">{tomorrowShift?.weekday || formatBST(tomorrowDate, 'EEEE')}</h5>
                                      <div className="mt-4 text-2xl font-black tracking-tight uppercase">
                                        {tomorrowShift?.shift || 'No Shift Assigned'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Expandable full timeline row */}
                                  <div className="mt-6">
                                    <button
                                      onClick={() => setShowFullRoster(!showFullRoster)}
                                      className="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 dark:hover:border-blue-500/30 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all bg-slate-50/50 dark:bg-slate-900/40 cursor-pointer"
                                    >
                                      {showFullRoster ? 'Hide Full Roster Timeline' : 'View Full Roster Timeline (1-2 Weeks)'}
                                    </button>

                                    <AnimatePresence>
                                      {showFullRoster && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="overflow-hidden mt-4"
                                        >
                                          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl">
                                            <div className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-3">Your Complete Roster Schedule Timeline:</div>
                                            <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin">
                                              {roster.headers.slice(2).map((hdr: string, idx: number) => {
                                                const trueIdx = idx + 2;
                                                const shiftTime = userRosterRow.shifts?.[hdr] || 'Day Off';
                                                const isToday = matchDateToHeader(hdr, todayDate);
                                                const isYesterday = matchDateToHeader(hdr, yesterdayDate);
                                                const isTomorrow = matchDateToHeader(hdr, tomorrowDate);
                                                return (
                                                  <div 
                                                    key={hdr} 
                                                    className={`flex-none w-36 p-4 rounded-xl border snap-start flex flex-col justify-between ${
                                                      isToday 
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10' 
                                                        : isYesterday || isTomorrow
                                                        ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                                                        : getShiftStyle(shiftTime)
                                                    }`}
                                                  >
                                                    <div>
                                                      <div className="text-[10px] font-black uppercase opacity-60">
                                                        {hdr}
                                                      </div>
                                                      <div className="text-xs font-extrabold mt-0.5">
                                                        {roster.subHeaders?.[trueIdx] || ''}
                                                      </div>
                                                    </div>
                                                    <div className="text-sm font-black mt-4 uppercase truncate">
                                                      {shiftTime}
                                                    </div>
                                                    {isToday && (
                                                      <span className="self-start text-[8px] font-black bg-white/20 px-1 py-0.5 rounded uppercase mt-2">Active Today</span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/30 p-8 rounded-2xl text-center space-y-3">
                                  <AlertTriangle className="mx-auto text-amber-500 animate-pulse" size={32} />
                                  <h5 className="font-extrabold text-amber-800 dark:text-amber-400 text-sm">No Duty Assigned (কোনো ডিউটি খুঁজে পাওয়া যায়নি)</h5>
                                  <p className="text-xs text-amber-600 dark:text-amber-500 max-w-md mx-auto leading-relaxed">
                                    No active duty hours were found matching your registered Employee ID on the uploaded roster.
                                  </p>
                                  <div className="pt-2 text-xs font-bold text-slate-500 dark:text-slate-400 space-y-1">
                                    <div>Your system registered ID: <span className="underline font-black">{loggedInEmployeeId || 'Not Set'}</span></div>
                                    <div>Your registered Display Name: <span className="underline font-black">{userProfile?.displayName || 'Not Set'}</span></div>
                                    <div className="text-[10px] mt-2 opacity-80">(Admins can update Employee IDs at "User Access" tab)</div>
                                  </div>
                                </div>
                              )}

                              {/* Admin Roster Dashboard Grid */}
                              {isAdmin && (
                                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div>
                                      <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">All Staff Roster List (Admin view)</h5>
                                      <p className="text-[11px] text-slate-400 mt-0.5">Control panel database mapping for {roster.rows?.length || 0} active staff rows. Click any cell to edit inline.</p>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3">
                                      <button
                                        onClick={handleDownloadRosterImage}
                                        disabled={isCapturingRoster}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                                      >
                                        {isCapturingRoster ? (
                                          <>
                                            <span className="w-3" style={{ contentVisibility: 'auto' }}>
                                              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            </span>
                                            Capturing...
                                          </>
                                        ) : (
                                          <>
                                            <Camera size={14} />
                                            Download Image
                                          </>
                                        )}
                                      </button>

                                      <button
                                        onClick={handleAddRosterRow}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-colors"
                                      >
                                        + Add Roster Row
                                      </button>
                                      
                                      <input
                                        type="text"
                                        placeholder="Search roster rows by name or ID..."
                                        value={rosterSearch}
                                        onChange={(e) => setRosterSearch(e.target.value)}
                                        className="bg-slate-50 dark:bg-slate-100 border-none rounded-xl text-xs font-bold px-4 py-2.5 w-full md:w-72 focus:ring-2 focus:ring-blue-500/20"
                                      />
                                    </div>
                                  </div>
 
                                  <div id="admin-roster-table-container" className="overflow-x-auto border border-slate-100 dark:border-slate-800/80 rounded-2xl scrollbar-thin bg-white dark:bg-[#0b1329] p-4">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">ID</th>
                                          <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Name</th>
                                          {roster.headers.slice(2).map((hdr: string) => (
                                            <th key={hdr} className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-wider min-w-[120px]">{hdr}</th>
                                          ))}
                                          {!isCapturingRoster && (
                                            <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {roster.rows
                                          ?.filter((r: any) => {
                                            if (!rosterSearch) return true;
                                            const s = rosterSearch.toLowerCase();
                                            return String(r.id || '').toLowerCase().includes(s) || String(r.name || '').toLowerCase().includes(s);
                                          })
                                          ?.map((r: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                                              <td className="p-2 text-xs font-black text-blue-600 dark:text-blue-400">
                                                <input
                                                  type="text"
                                                  value={r.id || ''}
                                                  onChange={(e) => handleRosterCellChangeLocal(idx, 'id', null, e.target.value)}
                                                  onBlur={handleRosterCellBlurSave}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      (e.target as HTMLInputElement).blur();
                                                    }
                                                  }}
                                                  className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500 px-2 py-1 rounded text-xs font-black text-blue-600 dark:text-blue-400 outline-none w-24 transition-all border border-transparent"
                                                />
                                              </td>
                                              <td className="p-2 text-xs font-bold">
                                                <input
                                                  type="text"
                                                  value={r.name || ''}
                                                  onChange={(e) => handleRosterCellChangeLocal(idx, 'name', null, e.target.value)}
                                                  onBlur={handleRosterCellBlurSave}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      (e.target as HTMLInputElement).blur();
                                                    }
                                                  }}
                                                  className="bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500 px-2 py-1 rounded text-xs font-bold text-slate-800 dark:text-slate-200 outline-none w-44 transition-all border border-transparent"
                                                />
                                              </td>
                                              {roster.headers.slice(2).map((hdr: string) => {
                                                const rawShift = r.shifts?.[hdr] || '';
                                                const normShift = rawShift.trim().toLowerCase();
                                                
                                                let cellColors = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
                                                
                                                if (normShift === 'cl' || normShift === 'sl' || normShift.includes('absent')) {
                                                  cellColors = 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30';
                                                } else if (normShift.includes('off') || normShift.includes('leave') || normShift.includes('leav') || normShift.includes('lve') || !rawShift) {
                                                  cellColors = 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30';
                                                } else {
                                                  if (normShift.includes('8:') || normShift.includes('8 am') || normShift.includes('8am') || normShift === '8') {
                                                    cellColors = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30';
                                                  } else if (normShift.includes('9:') || normShift.includes('9 am') || normShift.includes('9am') || normShift === '9') {
                                                    cellColors = 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30';
                                                  } else if (normShift.includes('10:') || normShift.includes('10 am') || normShift.includes('10am') || normShift === '10') {
                                                    cellColors = 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30';
                                                  } else if (normShift.includes('11:') || normShift.includes('11 am') || normShift.includes('11am') || normShift === '11') {
                                                    cellColors = 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border border-violet-500/30';
                                                  } else if (normShift.includes('12:') || normShift.includes('12 pm') || normShift.includes('12pm') || normShift === '12') {
                                                    cellColors = 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border border-fuchsia-500/30';
                                                  } else if (normShift.includes('1:') || normShift.includes('1 pm') || normShift.includes('1pm') || normShift === '1') {
                                                    cellColors = 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30';
                                                  } else if (normShift.includes('2:') || normShift.includes('2 pm') || normShift.includes('2pm') || normShift === '2') {
                                                    cellColors = 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border border-slate-500/30';
                                                  } else if (normShift.includes('3:') || normShift.includes('3 pm') || normShift.includes('3pm') || normShift === '3') {
                                                    cellColors = 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/30';
                                                  } else if (normShift.includes('4:') || normShift.includes('4 pm') || normShift.includes('4pm') || normShift === '4') {
                                                    cellColors = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30';
                                                  } else if (normShift.includes('5:') || normShift.includes('5 pm') || normShift.includes('5pm') || normShift === '5') {
                                                    cellColors = 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30';
                                                  } else if (normShift.includes('6:') || normShift.includes('6 pm') || normShift.includes('6pm') || normShift === '6') {
                                                    cellColors = 'bg-lime-500/15 text-lime-700 dark:text-lime-400 border border-lime-500/30';
                                                  } else if (normShift.includes('7:') || normShift.includes('7 pm') || normShift.includes('7pm') || normShift === '7') {
                                                    cellColors = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
                                                  }
                                                }
                                                
                                                return (
                                                  <td key={hdr} className="p-2 text-xs font-medium animate-fade-in min-w-[120px]">
                                                    <input
                                                      type="text"
                                                      value={rawShift}
                                                      placeholder="Day Off"
                                                      onChange={(e) => handleRosterCellChangeLocal(idx, '', hdr, e.target.value)}
                                                      onBlur={handleRosterCellBlurSave}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          (e.target as HTMLInputElement).blur();
                                                        }
                                                      }}
                                                      className={`hover:bg-opacity-80 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-blue-500 px-2 py-1.5 rounded-lg text-xs font-black outline-none w-full transition-all ${cellColors}`}
                                                    />
                                                  </td>
                                                );
                                              })}
                                              {!isCapturingRoster && (
                                                <td className="p-2 text-right">
                                                  <button
                                                    onClick={() => handleDeleteRosterRow(idx)}
                                                    className="p-1 px-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all text-[10px] font-black uppercase tracking-wider"
                                                    title="Delete this Row"
                                                  >
                                                    Remove
                                                  </button>
                                                </td>
                                              )}
                                            </tr>
                                          ))
                                        }
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center bg-slate-50/30 dark:bg-slate-900/10">
                              <FileSpreadsheet className="mx-auto text-slate-300 dark:text-slate-700 mb-4" size={48} />
                              <h5 className="font-extrabold text-slate-600 dark:text-slate-400">No Roster Schedule File Loaded</h5>
                              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                                The team operation schedule is currently unlinked. Please request your system administrator to upload the active Spreadsheet roster.
                              </p>
                              
                              <div className="mt-5 flex justify-center">
                                <button
                                  type="button"
                                  onClick={handleDownloadRosterTemplate}
                                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-black tracking-wider uppercase rounded-xl transition-all cursor-pointer shadow-sm hover:shadow-md"
                                >
                                  <Download className="w-4 h-4 text-blue-500" />
                                  Download Demo Roster Template
                                </button>
                              </div>
                              
                              {/* Roster Upload for Admin in empty state */}
                              {isAdmin && (
                                <div className="mt-8 max-w-md mx-auto border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 text-center bg-white dark:bg-slate-900 transition-colors">
                                  <UploadCloud className="mx-auto text-blue-500 mb-3" size={32} />
                                  <h6 className="text-xs font-black text-slate-700 dark:text-slate-300">Upload Roster spreadsheet or CSV file</h6>
                                  <p className="text-[10px] text-slate-400 mt-1">First Row columns: ID, Name, 16-May-26, etc.</p>
                                  
                                  <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleRosterUpload(file);
                                    }}
                                    className="hidden"
                                    id="dashboard-roster-upload-empty"
                                  />
                                  <label
                                    htmlFor="dashboard-roster-upload-empty"
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black tracking-wider uppercase cursor-pointer shadow-md shadow-blue-500/10 transition-colors"
                                  >
                                    Select File
                                  </label>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}

                {activeTab === 'validation' && hasAccess('validation') && (
                <motion.div 
                  key="validation"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-10"
                >
                  {canWriteToTab('validation') ? (
                    <FileUpload onDataLoaded={handleDataLoaded} isLoading={isLoading} resetTrigger={resetTrigger} />
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl flex items-center gap-4 text-slate-500 dark:text-slate-400">
                      <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                        <ShieldAlert size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Read-Only Session</h4>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">You don't have write authorization to upload or modify data records.</p>
                      </div>
                    </div>
                  )}

                  {data.length > 0 && !isLoading && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                      {[
                        { label: 'Total Entries', value: data.length, icon: Package, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40', sub: 'Records Processed' },
                        { label: 'Total Match', value: data.filter(r => !r.isMismatch && !r.isDuplicate).length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/40', sub: 'Validated Correctly' },
                        { label: 'Total Issues', value: data.filter(r => r.isMismatch || r.isDuplicate).length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40', sub: 'Manual Review Needed' },
                        { label: 'Permitted', value: data.filter(r => r.isPermitted).length, icon: ShieldCheck, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/40', sub: 'Leader Approved' }
                      ].map((card, idx) => (
                        <div 
                          key={idx}
                          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group overflow-hidden relative"
                        >
                          <div className={`absolute -right-2 -top-2 opacity-15 dark:opacity-30 group-hover:scale-110 transition-transform ${card.color}`}>
                            <card.icon size={64} />
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-xl ${card.bg} ${card.color}`}>
                              <card.icon size={18} />
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{card.label}</span>
                          </div>
                          <div className={`text-3xl font-mono font-black ${card.color}`}>
                            {card.value}
                          </div>
                          <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{card.sub}</div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  <AnimatePresence>
                    {isLoading && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100/50 dark:border-slate-800 p-8 shadow-xl shadow-blue-500/5 dark:shadow-blue-900/20 max-w-2xl mx-auto"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                              <Sparkles className="text-blue-600 dark:text-blue-400" size={18} />
                            </div>
                            <div>
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Processing Documents</span>
                              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-tight">AI is extracting prices and applying validation rules...</p>
                            </div>
                          </div>
                          <span className="text-lg font-black text-blue-600 dark:text-blue-400 tabular-nums">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 w-full rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {data.length > 0 ? (
                    <DataTable data={data} onUpdatePrice={updateRowPrice} canEdit={canWriteToTab('validation')} />
                  ) : !isLoading && (
                    <div className="flex flex-col items-center justify-center py-40 text-center">
                      <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                        <BarChart3 size={40} className="text-slate-300 dark:text-slate-700" />
                      </div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 uppercase tracking-[0.1em]">Idle Environment</h3>
                      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed font-medium">
                        Upload your merchant data spreadsheet to trigger the validation intelligence engine.
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'tracker' && hasAccess('tracker') && (
                <motion.div
                  key="tracker"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-6xl mx-auto pt-10"
                >
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-2">Inventory Analytics (PT)</h2>
                    <p className="text-slate-400 dark:text-slate-500 font-medium tracking-tight">Consolidated view of all products detected in current upload.</p>
                  </div>
                  <ProductTracker data={data} />
                </motion.div>
              )}

                  {activeTab === 'team' && userProfile && (
                    <motion.div
                      key="team"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="max-w-6xl mx-auto pt-10"
                    >
                      <TeamWork userProfile={userProfile} allUsers={allUsers} />
                    </motion.div>
                  )}

              {activeTab === 'rules' && hasAccess('rules') && (
                <motion.div
                  key="rules"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-3xl mx-auto pt-10"
                >
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-2">Automated Rules</h2>
                    <p className="text-slate-400 dark:text-slate-500 font-medium tracking-tight">Define tier-based percentage discounts automatically applied to matching amounts.</p>
                  </div>
                  <RuleEditor 
                    existingRules={rules} 
                    onRulesUpdate={handleRulesUpdate} 
                    canWrite={canWriteToTab('rules')}
                  />

                  <div className="mt-20 border-t border-slate-100 dark:border-slate-800 pt-20">
                    <div className="mb-10 text-center">
                      <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-2">Custom AI Command</h2>
                      <p className="text-slate-400 dark:text-slate-500 font-medium tracking-tight">Define natural language rules for how to calculate amounts. Leave empty to use standard calculation.</p>
                    </div>
                    <CustomCommandEditor 
                       settings={siteSettings} 
                       onUpdate={handleSiteSettingsUpdate}
                       canWrite={canWriteToTab('settings')}
                    />
                  </div>

                  <div className="mt-20 border-t border-slate-100 dark:border-slate-800 pt-20">
                    <GiftRuleEditor 
                      rules={giftRules} 
                      onUpdate={handleGiftRulesUpdate} 
                      canWrite={canWriteToTab('settings')}
                    />
                  </div>
                </motion.div>
              )}


              {activeTab === 'products' && hasAccess('products') && (
                <motion.div
                  key="products"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-5xl mx-auto pt-10"
                >
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-2">Product Ecosystem</h2>
                    <p className="text-slate-400 dark:text-slate-500 font-medium tracking-tight">Unified inventory matching system for extraction and price comparison.</p>
                  </div>
                  <ProductLibrary 
                    products={products}
                    canWrite={canWriteToTab('products')}
                    onAdd={handleAddProduct}
                    onBulkAdd={handleBulkAddProducts}
                    onDelete={handleDeleteProduct}
                    onDeleteMultiple={handleBulkDeleteProducts}
                    onUpdate={handleUpdateProduct}
                  />
                </motion.div>
              )}

              {activeTab === 'settings' && hasAccess('settings') && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-2xl mx-auto pt-10"
                >
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-2">Operational Controls</h2>
                    <p className="text-slate-400 dark:text-slate-500 font-medium tracking-tight">Configure global brand identity, validation tolerance, and logistics fees.</p>
                  </div>
                  <div className="space-y-10">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-colors duration-300">
                      <GeneralSettings 
                        settings={siteSettings}
                        onUpdate={handleSiteSettingsUpdate}
                        canWrite={canWriteToTab('settings')}
                      />
                    </div>
                    
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-colors duration-300">
                      <DeliverySettings 
                        settings={delivery}
                        onUpdate={handleDeliveryUpdate}
                        canWrite={canWriteToTab('settings')}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'users' && isAdmin && (
                <motion.div
                  key="users"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="max-w-[1250px] mx-auto pt-10 px-4"
                >
                  <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-2">Personnel Directory</h2>
                    <p className="text-slate-400 dark:text-slate-500 font-medium tracking-tight">Manage system access levels and administrative privileges.</p>
                  </div>
                  <UserManagement 
                    users={allUsers} 
                    onUpdateRole={handleUpdateUserRole}
                    currentUserEmail={user?.email}
                  />
                </motion.div>
              )}

              {activeTab === 'printSlips' && (
                <motion.div
                  key="printSlips"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full absolute inset-0 z-[200] bg-white min-h-screen"
                >
                  <PrintSlips data={data} settings={siteSettings} onBack={() => setActiveTab('validation')} />
                </motion.div>
              )}
            </AnimatePresence>
          )}
          </div>
        </section>
      </main>

      {/* Sign Out Confirmation Overlay */}
      <AnimatePresence>
        {showSignOutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignOutConfirm(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-600 mb-6 mx-auto">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center uppercase tracking-tighter mb-2">Confirm Sign Out</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium text-center leading-relaxed mb-8">
                Are you sure you want to terminate your current session? You will need to re-authenticate to access the workspace.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={async () => {
                    if (user) {
                      try {
                        await updateDoc(doc(db, 'users', user.uid), cleanObject({ isOnline: false, lastSeen: getBSTISOString() }));
                      } catch (e) {
                        console.error("Offline sync error:", e);
                      }
                    }
                    signOut();
                    setShowSignOutConfirm(false);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all active:scale-95"
                >
                  Yes, Sign Out
                </button>
                <button 
                  onClick={() => setShowSignOutConfirm(false)}
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
