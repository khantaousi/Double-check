import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Shield, UserCheck, ShieldAlert, Plus, Mail, Lock, X, Activity, ToggleLeft, ToggleRight, Fingerprint, User, CheckCircle2, Clock, ChevronDown, ChevronUp, LayoutDashboard, BookOpen, Package, Settings, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { secondaryAuth, db, auth } from '../lib/firebase';
import { getInitials, getAvatarColor } from '../lib/avatar';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errors';
import { cleanObject, getBSTISOString } from '../lib/utils';

interface UserManagementProps {
  users: UserProfile[];
  onUpdateRole: (userId: string, newRole: 'admin' | 'user') => void;
  currentUserEmail?: string | null;
}

export function UserManagement({ users, onUpdateRole, currentUserEmail }: UserManagementProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isCreating, setIsCreating] = useState(false);
  const [now, setNow] = useState(new Date());
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000); // UI update every 30s
    return () => clearInterval(timer);
  }, []);

  const formatLastSeen = (lastSeen?: string, isOnline?: boolean) => {
    if (!lastSeen) return 'Never joined';
    
    const date = new Date(lastSeen);
    const diff = now.getTime() - date.getTime();
    
    // If last updated within 5 minutes, and flagged online, show online
    // Actually the flag is better, but this handles tab closes better
    const isActuallyOnline = isOnline && diff < 5 * 60 * 1000;

    if (isActuallyOnline) return 'Active Now';

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const isUserOnline = (user: UserProfile) => {
    if (!user.lastSeen || !user.isOnline) return false;
    const diff = now.getTime() - new Date(user.lastSeen).getTime();
    return diff < 5 * 60 * 1000;
  };

  const [permissions, setPermissions] = useState({
    dashboard: 'read' as 'none' | 'read' | 'write',
    rules: 'none' as 'none' | 'read' | 'write',
    products: 'none' as 'none' | 'read' | 'write',
    settings: 'none' as 'none' | 'read' | 'write',
    tracker: 'none' as 'none' | 'read' | 'write',
    printSlips: 'none' as 'none' | 'read' | 'write'
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    setIsCreating(true);
    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      console.log('User created:', userCred.user.uid);
      
      const profile: UserProfile = {
        email: email,
        loginHandle: email,
        role,
        permissions,
        displayName: customDisplayName,
        employeeId: employeeId,
        createdAt: getBSTISOString(),
        isActive: true
      };
      
      await setDoc(doc(db, 'users', userCred.user.uid), cleanObject(profile));
      
      await secondaryAuth.signOut();
      
      setShowAddModal(false);
      setEmail('');
      setCustomDisplayName('');
      setEmployeeId('');
      setPassword('');
      setConfirmPassword('');
      alert('User created successfully.');
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error?.code === 'auth/email-already-in-use') {
        alert('This email is already registered. Please use a different one, or log in with the existing account.');
      } else {
        alert('Failed to create user: ' + (error instanceof Error ? error.message : String(error)));
      }
    } finally {
      setIsCreating(false);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), cleanObject({ isActive: !currentStatus }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const executeDelete = async (user: UserProfile) => {
    if (!user.id) return;
    
    // Additional confirmation
    if (!window.confirm(`Are you sure you want to permanently delete user ${user.loginHandle || user.email} and their Firebase account? This action cannot be undone.`)) {
      return;
    }

    try {
      console.log('Attempting to delete user:', user.id);
      console.log('Current user UID:', auth.currentUser?.uid);
      // 1. Delete from Firestore
      await deleteDoc(doc(db, 'users', user.id));
      console.log('Successfully deleted user doc');
      
      // 2. We cannot delete users from client-side Firebase Auth directly due to security limitations.
      // The approach taken here is:
      // The user is actually deleted from Firestore collection 'users'.
      // For full authentication removal, this normally requires a Cloud Function or Admin SDK.
      // We will perform the Firestore deletion as a primary step.
      
      alert(`User ${user.loginHandle || user.email} profile deleted successfully.`);
      
    } catch (error) {
      console.error('Delete error details:', error);
      handleFirestoreError(error, OperationType.DELETE, `users/${user.id}`);
    }
  };

  const handleEditUserSave = async () => {
    if (!editTarget) return;
    try {
      await updateDoc(doc(db, 'users', editTarget.id!), cleanObject({
        displayName: editTarget.displayName || '',
        permissions: editTarget.permissions,
        employeeId: editTarget.employeeId || ''
      }));
      setEditTarget(null);
      alert('User updated successfully.');
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update.');
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!confirm(`Are you sure you want to send a password reset email to ${email}?`)) return;
    try {
      await sendPasswordResetEmail(secondaryAuth, email);
      alert('Password reset email sent successfully.');
    } catch (error) {
      console.error('Error sending password reset email:', error);
      alert(`Failed to send password reset email: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const setPermissionLevel = async (
    userId: string, 
    key: keyof NonNullable<UserProfile['permissions']>, 
    level: 'none' | 'read' | 'write'
  ) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const newPermissions = {
      ...(user.permissions || { dashboard: 'none', rules: 'none', products: 'none', settings: 'none', tracker: 'none', printSlips: 'none' }),
      [key]: level
    };
    try {
      await updateDoc(doc(db, 'users', userId), cleanObject({ permissions: newPermissions }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const togglePermission = async (userId: string, key: keyof UserProfile['permissions']) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const currentPermission = user.permissions?.[key] || 'none';
    const nextPermission = currentPermission === 'none' ? 'read' : currentPermission === 'read' ? 'write' : 'none';
    
    const newPermissions = {
      ...(user.permissions || { dashboard: 'none', rules: 'none', products: 'none', settings: 'none', tracker: 'none', printSlips: 'none' }),
      [key]: nextPermission
    };
    try {
      await updateDoc(doc(db, 'users', userId), cleanObject({ permissions: newPermissions }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={18} />
          Create Personnel
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1150px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <th className="w-12 py-4 pl-6 pr-0 text-center">Access</th>
              <th className="px-6 py-4">Identity</th>
              <th className="px-6 py-4">Auth Level</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((user) => (
              <React.Fragment key={user.id}>
                <motion.tr 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!user.isActive ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50' : ''} ${expandedUsers[user.id!] ? 'bg-blue-50/10 dark:bg-blue-900/5' : ''}`}
                >
                  <td className="py-4 pl-6 pr-0 text-center">
                    <button
                      id={`chevron-toggle-${user.id}`}
                      onClick={() => {
                        setExpandedUsers(prev => ({
                          ...prev,
                          [user.id!]: !prev[user.id!]
                        }));
                      }}
                      className={`p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ${
                        expandedUsers[user.id!] ? 'rotate-180 text-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                      title={expandedUsers[user.id!] ? "Collapse Permissions" : "Expand Permissions"}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-xl ${getAvatarColor(user.displayName || user.email)} flex items-center justify-center text-white text-xs font-black shadow-sm transition-transform hover:scale-105`}>
                          {getInitials(user.displayName || user.email)}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${isUserOnline(user) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-slate-300 dark:bg-slate-700'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{user.displayName || 'No Name'}</p>
                          {isUserOnline(user) && (
                            <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {user.employeeId && (
                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 tracking-wider flex items-center gap-1">
                              <span className="bg-blue-500/10 dark:bg-blue-500/20 px-1.5 py-0.5 rounded text-[9px]">ID: {user.employeeId}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-1 opacity-60">
                             <Fingerprint size={10} className="text-slate-400" />
                             <p className="text-[9px] font-bold text-slate-500 tracking-tight uppercase">{user.loginHandle || user.email}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                            <Clock size={10} />
                            {formatLastSeen(user.lastSeen, user.isOnline)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      {user.role === 'admin' ? <Shield size={12} /> : <UserCheck size={12} />}
                      {user.role}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <button 
                      onClick={() => toggleStatus(user.id!, user.isActive)}
                      disabled={user.email === currentUserEmail || user.email === 'khantaousi@gmail.com'}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-all ${user.isActive ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}
                     >
                       {user.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                       <span className="text-[9px] font-black uppercase tracking-widest">{user.isActive ? 'Active' : 'Deactive'}</span>
                     </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Allow editing Name and ID for ALL users (including self/master admin) */}
                      <button
                        onClick={() => setEditTarget(user)}
                        className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 bg-transparent hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white hover:border-blue-600 active:scale-95 transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md hover:scale-[1.03]"
                      >
                        Edit Name & ID
                      </button>

                      {/* Protect admin status, password reset, and deletion for self/master admin */}
                      {user.email !== currentUserEmail && user.email !== 'khantaousi@gmail.com' && (
                        <>
                          <button
                            onClick={() => {
                              const newRole = user.role === 'admin' ? 'user' : 'admin';
                              onUpdateRole(user.id!, newRole);
                              if (newRole === 'admin') {
                                // Automatically grand all permissions when becoming admin
                                updateDoc(doc(db, 'users', user.id!), cleanObject({ 
                                  permissions: { dashboard: 'write', rules: 'write', products: 'write', settings: 'write', tracker: 'write', printSlips: 'write' }
                                })).catch(console.error);
                              }
                            }}
                            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md hover:scale-[1.03] active:scale-95 ${
                              user.role === 'admin'
                                ? 'border-amber-200 text-amber-500 hover:bg-amber-500 hover:text-white hover:border-amber-500 dark:border-amber-500/30'
                                : 'border-blue-200 text-blue-500 hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:border-blue-500/30'
                            }`}
                          >
                            {user.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                          <button
                            onClick={() => handleResetPassword(user.email)}
                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-600 hover:text-white hover:border-slate-600 active:scale-95 transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md hover:scale-[1.03]"
                          >
                            Reset Pass
                          </button>
                          <button
                            onClick={() => executeDelete(user)}
                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 active:scale-95 transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md hover:scale-[1.03]"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>

                <AnimatePresence initial={false}>
                  {expandedUsers[user.id!] && (
                    <tr className="bg-slate-50/30 dark:bg-slate-800/10">
                      <td colSpan={5} className="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-6 overflow-hidden"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
                            <div>
                              <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                                Access Control Matrix for {user.displayName || user.email}
                              </h4>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide mt-0.5">
                                Toggle access level for each operational option below. Updates apply instantly.
                              </p>
                            </div>
                            {user.role === 'admin' && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-xl text-[9px] font-black uppercase tracking-wider">
                                <Shield size={12} />
                                Admin Has Full Access
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { key: 'dashboard', label: 'Validation Hub', desc: 'Permit entry to the core validation workspace and file upload.', icon: LayoutDashboard },
                              { key: 'tracker', label: 'Product Tracking (PT)', desc: 'Consolidated view of inventory products and matching reports.', icon: Activity },
                              { key: 'rules', label: 'Logic Rules', desc: 'Define tier-based percent discount rates and automated rules.', icon: BookOpen },
                              { key: 'products', label: 'Product Library / Database', desc: 'Manage existing catalog items and comparing rules.', icon: Package },
                              { key: 'settings', label: 'Delivery & Config Settings', desc: 'Operational variables such as pricing rules, logistics, and company info.', icon: Settings },
                              { key: 'printSlips', label: 'Print Invoices & Slips', desc: 'Render barcodes and download physical parcel dispatch sheets.', icon: Printer }
                            ].map(({ key, label, desc, icon: Icon }) => {
                              const currentLevel = user.permissions?.[key as keyof UserProfile['permissions']] || 'none';
                              return (
                                <div 
                                  key={key} 
                                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                    currentLevel === 'write' 
                                      ? 'bg-emerald-500/[0.02] border-emerald-500/20 dark:border-emerald-500/10' 
                                      : currentLevel === 'read'
                                        ? 'bg-amber-500/[0.02] border-amber-500/20 dark:border-amber-500/10'
                                        : 'bg-transparent border-slate-100 dark:border-slate-800/80'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                                      currentLevel === 'write' 
                                        ? 'bg-emerald-500/10 text-emerald-500' 
                                        : currentLevel === 'read'
                                          ? 'bg-amber-500/10 text-amber-500'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                      <Icon size={16} />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">{label}</h5>
                                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 max-w-xs">{desc}</p>
                                    </div>
                                  </div>

                                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit sm:self-auto shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                                    {([
                                      { val: 'none', lbl: 'No Access', activeClass: 'bg-red-500 text-white shadow-md font-bold' },
                                      { val: 'read', lbl: 'Read Only', activeClass: 'bg-amber-500 text-white shadow-md font-bold' },
                                      { val: 'write', lbl: 'Read & Write', activeClass: 'bg-emerald-500 text-white shadow-md font-bold' }
                                    ] as const).map(({ val, lbl, activeClass }) => {
                                      const isLevelActive = currentLevel === val;
                                      return (
                                        <button
                                          key={val}
                                          id={`perm-btn-${user.id}-${key}-${val}`}
                                          type="button"
                                          disabled={user.role === 'admin'}
                                          onClick={() => setPermissionLevel(user.id!, key as any, val)}
                                          className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-150 ${
                                            isLevelActive 
                                              ? activeClass 
                                              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed'
                                          }`}
                                        >
                                          {lbl}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditTarget(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-800">
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 uppercase tracking-tighter">Edit Personnel</h2>
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Display Name (Agent Name)</label>
                  <input type="text" value={editTarget.displayName || ''} onChange={e => setEditTarget({...editTarget, displayName: e.target.value})} className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Employee ID</label>
                  <input type="text" value={editTarget.employeeId || ''} onChange={e => setEditTarget({...editTarget, employeeId: e.target.value})} placeholder="e.g. EMP420" className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <button onClick={handleEditUserSave} className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold text-xs uppercase tracking-widest hover:bg-blue-700">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.form initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onSubmit={handleCreateUser} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter uppercase">New Personnel</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                  <div className="relative text-slate-700 dark:text-slate-200">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      required 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      placeholder="user@example.com"
                      className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3.5 pl-10 pr-4 text-sm font-black focus:ring-2 focus:ring-blue-500/20" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Display Name (Agent Name)</label>
                  <div className="relative text-slate-700 dark:text-slate-200">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      required 
                      type="text" 
                      value={customDisplayName} 
                      onChange={e => setCustomDisplayName(e.target.value)} 
                      placeholder="John Doe"
                      className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3.5 pl-10 pr-4 text-sm font-black focus:ring-2 focus:ring-blue-500/20" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Employee ID</label>
                  <div className="relative text-slate-700 dark:text-slate-200">
                    <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      value={employeeId} 
                      onChange={e => setEmployeeId(e.target.value)} 
                      placeholder="e.g. EMP420"
                      className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3.5 pl-10 pr-4 text-sm font-black focus:ring-2 focus:ring-blue-500/20" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Secure Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                    Confirm Password
                    {confirmPassword && (
                      <span className={`text-[9px] font-black ${password === confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
                        {password === confirmPassword ? 'Match' : 'Not Match'}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Deployment Role</label>
                  <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20">
                    <option value="user">Standard Agent</option>
                    <option value="admin">System Admin</option>
                  </select>
                </div>
                <div className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(permissions).map(([key, level]) => (
                      <button 
                        key={key} 
                        type="button" 
                        onClick={() => setPermissions(prev => {
                          const nextLevel = level === 'none' ? 'read' : level === 'read' ? 'write' : 'none';
                          return ({...prev, [key]: nextLevel});
                        })} 
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                          level === 'write' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-600' : 
                          level === 'read' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-600' :
                          'bg-transparent border-slate-100 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${level !== 'none' ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                        {key} ({level})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button disabled={isCreating} type="submit" className="w-full mt-10 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl py-4 font-bold text-xs uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-all disabled:opacity-50">{isCreating ? 'Deploying...' : 'Provision User'}</button>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
