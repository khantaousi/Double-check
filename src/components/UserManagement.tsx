import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Shield, UserCheck, ShieldAlert, Plus, Mail, Lock, X, Activity, ToggleLeft, ToggleRight, Fingerprint, User, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { secondaryAuth, db } from '../lib/firebase';
import { getInitials, getAvatarColor } from '../lib/avatar';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errors';

interface UserManagementProps {
  users: UserProfile[];
  onUpdateRole: (userId: string, newRole: 'admin' | 'user') => void;
  currentUserEmail?: string | null;
}

export function UserManagement({ users, onUpdateRole, currentUserEmail }: UserManagementProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [identityType, setIdentityType] = useState<'email' | 'id' | 'name'>('email');
  const [identityValue, setIdentityValue] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [isCreating, setIsCreating] = useState(false);
  const [permissions, setPermissions] = useState({
    dashboard: 'read' as 'none' | 'read' | 'write',
    rules: 'none' as 'none' | 'read' | 'write',
    products: 'none' | 'read' | 'write',
    settings: 'none' | 'read' | 'write',
    tracker: 'none' | 'read' | 'write',
    printSlips: 'none' | 'read' | 'write'
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    setIsCreating(true);
    try {
      // Map identity to an email for Firebase Auth
      let firebaseEmail = '';
      let loginHandle = '';
      
      if (identityType === 'email') {
        firebaseEmail = identityValue;
      } else {
        // Create internally valid email for ID/Name based login
        const slug = identityValue.toLowerCase().replace(/[^a-z0-9]/g, '');
        firebaseEmail = `${slug}@internal.parcelintel.com`;
        loginHandle = identityValue;
      }

      const userCred = await createUserWithEmailAndPassword(secondaryAuth, firebaseEmail, password);
      
      console.log('User created:', userCred.user.uid);
      
      const profile: UserProfile = {
        email: firebaseEmail,
        loginHandle: loginHandle || firebaseEmail,
        role,
        permissions,
        displayName: identityValue,
        createdAt: new Date().toISOString(),
        isActive: true
      };
      
      console.log('Setting user profile:', profile);
      await setDoc(doc(db, 'users', userCred.user.uid), profile);
      console.log('User profile set in Firestore');
      
      await secondaryAuth.signOut();
      
      setShowAddModal(false);
      setIdentityValue('');
      setPassword('');
      alert('User created successfully.');
    } catch (error) {
      console.error('Error creating user:', error);
      alert(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isActive: !currentStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this personnel? This action is permanent.')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error('Delete error:', error);
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
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
      await updateDoc(doc(db, 'users', userId), { permissions: newPermissions });
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
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <th className="px-6 py-4">Identity</th>
              <th className="px-6 py-4">Auth Level</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Modules Access</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((user) => (
              <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={user.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!user.isActive ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/50' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${getAvatarColor(user.displayName || user.email)} flex items-center justify-center text-white text-[10px] font-black shadow-sm`}>
                      {getInitials(user.displayName || user.email)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user.displayName || 'No Name'}</p>
                      <div className="flex items-center gap-1 opacity-60">
                         <Fingerprint size={10} className="text-slate-400" />
                         <p className="text-[9px] font-bold text-slate-500 tracking-tight uppercase">{user.loginHandle || user.email}</p>
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
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(['dashboard', 'rules', 'products', 'settings', 'tracker', 'printSlips'] as const).map((key) => {
                      const p = user.permissions?.[key];
                      const level = user.role === 'admin' ? 'write' : (typeof p === 'boolean' ? (p ? 'write' : 'none') : (p || 'none'));
                      
                      const getStyle = () => {
                        if (level === 'write') return 'bg-blue-500 text-white';
                        if (level === 'read') return 'bg-amber-500 text-white';
                        return 'bg-slate-100 dark:bg-slate-800 text-slate-400';
                      };
                      return (
                        <button
                          key={key}
                          onClick={() => togglePermission(user.id!, key as any)}
                          disabled={user.role === 'admin'}
                          className={`text-[9px] font-bold px-2 py-1 rounded-full transition-all flex items-center gap-1 ${getStyle()} ${user.role !== 'admin' ? 'cursor-pointer hover:bg-opacity-80' : 'cursor-not-allowed opacity-50'}`}
                        >
                          {level.charAt(0).toUpperCase()}
                          {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                        </button>
                      );
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {user.email !== currentUserEmail && user.email !== 'khantaousi@gmail.com' && (
                      <div className="flex items-center justify-end gap-2">
                         <button
                          onClick={() => {
                            const newRole = user.role === 'admin' ? 'user' : 'admin';
                            onUpdateRole(user.id!, newRole);
                            if (newRole === 'admin') {
                              // Automatically grand all permissions when becoming admin
                              updateDoc(doc(db, 'users', user.id!), { 
                                permissions: { dashboard: true, rules: true, products: true, settings: true, tracker: true, printSlips: true }
                              }).catch(console.error);
                            }
                          }}
                          className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${user.role === 'admin' ? 'border-amber-200 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10' : 'border-blue-200 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}
                        >
                          {user.role === 'admin' ? 'Revoke Admin' : 'Make Admin'}
                        </button>
                        <button
                          onClick={() => handleResetPassword(user.email)}
                          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-all"
                        >
                          Reset Pass
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id!)}
                          className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.form initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onSubmit={handleCreateUser} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] p-10 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter uppercase">New Personnel</h2>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
              </div>
              <div className="space-y-6">
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  {(['email', 'id', 'name'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setIdentityType(t)}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${identityType === t ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    {identityType === 'email' ? 'Email Address' : identityType === 'id' ? 'Personnel ID' : 'Personnel Name'}
                  </label>
                  <div className="relative text-slate-700 dark:text-slate-200">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {identityType === 'email' ? <Mail size={16} /> : identityType === 'id' ? <Fingerprint size={16} /> : <User size={16} />}
                    </div>
                    <input 
                      required 
                      type={identityType === 'email' ? 'email' : 'text'} 
                      value={identityValue} 
                      onChange={e => setIdentityValue(e.target.value)} 
                      placeholder={identityType === 'email' ? 'user@example.com' : identityType === 'id' ? 'PI-001' : 'John Doe'}
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
