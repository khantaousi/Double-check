/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppNotification, DataRow, TaskHistoryEntry, ValidationRule, ProductPrice, DEFAULT_RULES, DeliverySettings as IDeliverySettings, DEFAULT_DELIVERY_SETTINGS, UserProfile, GiftRule, SiteSettings, DEFAULT_SITE_SETTINGS } from './types';
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
import { Printer, BarChart3, Database, ShieldAlert, Sparkles, XCircle, LogIn, LogOut, User, LayoutDashboard, Settings, BookOpen, Package, Moon, Sun, Users, Lock, Mail, AlertTriangle, Clock, Gift, CheckCircle2, ShieldCheck, Activity, Layout, Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, logInWithEmail, signOut, signInWithGoogle } from './lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, query, orderBy, setDoc, getDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { seedProducts } from './lib/seed';
import { handleFirestoreError, OperationType } from './lib/errors';
import { cleanObject, getBSTISOString, formatBST } from './lib/utils';

import { subDays, parseISO } from 'date-fns';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getInitials, getAvatarColor } from './lib/avatar';
import { PrintSlips } from './components/PrintSlips';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rules' | 'products' | 'settings' | 'users' | 'tracker' | 'printSlips' | 'team'>('dashboard');
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
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
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
          
          // Find everyday tasks
          const q = query(collection(db, 'tasks'), where('isEveryday', '==', true));
          const tasksSnap = await getDocs(q);
          
          if (tasksSnap.empty) {
            await setDoc(statusRef, { lastResetDate: todayStr }, { merge: true });
            return;
          }

          const batch = writeBatch(db);
          let count = 0;

          for (const docSnap of tasksSnap.docs) {
            const task = docSnap.data();
            if (task.status !== 'completed' || !task.completedAt) continue;
            
            const compDate = formatBST(parseISO(task.completedAt), 'yyyy-MM-dd');
            if (compDate !== todayStr) {
              // Archive
              const archiveId = doc(collection(db, 'tasks')).id;
              batch.set(doc(db, 'tasks', archiveId), {
                ...task,
                id: archiveId,
                isEveryday: false,
                isHistorySnapshot: true,
                status: 'completed',
                updatedAt: getBSTISOString()
              });

              // Reset master
              batch.update(docSnap.ref, {
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
                history: [...(task.history || []), {
                  status: 'created',
                  timestamp: getBSTISOString(),
                  performerId: 'system-auto',
                  performerName: 'Browser Maintenance',
                  note: 'Automated Daily Cycle Reset (Active Session)'
                }]
              });
              count++;
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
    return (userProfile?.permissions?.[tab as keyof UserProfile['permissions']] || 'none') === 'write';
  };

  const hasAccess = (tab: typeof activeTab) => {
    if (user?.email === 'khantaousi@gmail.com') return true;
    if (userProfile?.role === 'admin') return true;
    if (tab === 'users') return false;
    return (userProfile?.permissions?.[tab as keyof UserProfile['permissions']] || 'none') !== 'none';
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
      <aside className={`fixed md:static inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 shadow-sm z-30 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden transition-shadow duration-300">
              {siteSettings.logoUrl ? (
                <img src={siteSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Database className="text-slate-600 dark:text-slate-400" size={20} />
              )}
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tighter text-slate-800 dark:text-slate-100">{siteSettings.companyName.split(' ')[0]} <span className="text-blue-600">{siteSettings.companyName.split(' ').slice(1).join(' ')}</span></h1>
              <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest leading-none">Intelligence v1.0</p>
            </div>
          </div>
          
          <nav className="space-y-8">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 pl-4">Core Workspace</p>
              <div className="space-y-1">
                {userProfile && (
                  <button 
                    onClick={() => { setActiveTab('team'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeTab === 'team' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Layout size={18} />
                      Team Work
                    </div>
                    {pendingTasksCount > 0 && (
                      <motion.span 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-sm min-w-[18px] animate-pulse"
                      >
                        {pendingTasksCount > 9 ? '9+' : pendingTasksCount}
                      </motion.span>
                    )}
                  </button>
                )}

                {hasAccess('dashboard') && (
                  <button 
                    onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeTab === 'dashboard' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <LayoutDashboard size={18} />
                    Validation Hub
                  </button>
                )}

                {hasAccess('tracker') && (
                  <button 
                    onClick={() => { setActiveTab('tracker'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeTab === 'tracker' 
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Activity size={18} />
                    Product Tracking (PT)
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-4 pl-4">Configuration</p>
              <div className="space-y-1">
                {hasAccess('rules') && (
                  <button 
                    onClick={() => { setActiveTab('rules'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeTab === 'rules' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen size={18} />
                    Logic Rules
                  </button>
                )}
                
                {hasAccess('products') && (
                  <button 
                    onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeTab === 'products' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Package size={18} />
                    Product Library
                  </button>
                )}

                {hasAccess('settings') && (
                  <button 
                    onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeTab === 'settings' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Settings size={18} />
                    Delivery Settings
                  </button>
                )}
                
                {isAdmin && (
                  <button 
                    onClick={() => { setActiveTab('users'); setIsSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border ${
                      activeTab === 'users' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users size={18} />
                    User Access
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
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/20 shadow-sm group"
            >
              <LogOut size={16} className="group-hover:translate-x-1 transition-transform" />
              Sign Out Session
            </button>
          )}

          <div className="px-4">
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
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LayoutDashboard size={20} />
            </button>
            <div className={`flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 transition-colors duration-300 ${data.length === 0 ? 'animate-border-green' : ''}`}>
              <span className={`w-2 h-2 rounded-full ${data.length > 0 ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600 dark:text-slate-400">
                {data.length > 0 ? 'Data Active' : 'System Ready'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
            <h2 className="text-slate-400 dark:text-slate-500 text-sm font-bold tracking-tight uppercase">
              {activeTab === 'dashboard' ? 'Validation Workspace' : `Config / ${activeTab}`}
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
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                <ShieldAlert size={14} className="text-amber-500" />
                Access Restricted
              </div>
            )}
            
            {data.length > 0 && activeTab === 'dashboard' && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setActiveTab('printSlips')}
                  className="flex items-center gap-2 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 hover:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-black/10 dark:shadow-none active:scale-95"
                >
                  <Printer size={16} />
                  Print Slips
                </button>
                <button 
                  onClick={handleClear}
                  className="flex items-center gap-2 text-slate-500 hover:text-red-500 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                  <XCircle size={16} />
                  Reset System
                </button>
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
                  className="space-y-10"
                >
                  <FileUpload onDataLoaded={handleDataLoaded} isLoading={isLoading} resetTrigger={resetTrigger} />

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
                    <DataTable data={data} onUpdatePrice={updateRowPrice} />
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
                  className="max-w-4xl mx-auto pt-10"
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
                  <PrintSlips data={data} settings={siteSettings} onBack={() => setActiveTab('dashboard')} />
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
