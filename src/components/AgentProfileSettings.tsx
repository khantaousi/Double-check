import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { User, Camera, Lock, Palette, Eye, EyeOff, CheckCircle2, AlertCircle, Upload, Trash2, KeyRound } from 'lucide-react';
import { User as FirebaseUser, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface AgentProfileSettingsProps {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  activeTheme: string;
  onSelectTheme: (themeId: string) => void;
  onProfileUpdated?: () => void;
}

export function AgentProfileSettings({
  user,
  userProfile,
  activeTheme,
  onSelectTheme,
  onProfileUpdated
}: AgentProfileSettingsProps) {
  // Profile Picture State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Initials Fallback Helper
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Avatar Color Helper
  const getAvatarColor = (name?: string) => {
    const colors = [
      'bg-blue-600', 'bg-indigo-600', 'bg-purple-600', 'bg-pink-600',
      'bg-emerald-600', 'bg-teal-600', 'bg-amber-600', 'bg-rose-600'
    ];
    let hash = 0;
    const str = name || 'User';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 1024 * 1024) { // 1MB limit
      setPhotoMessage({ type: 'error', text: 'Image file is too large. Please select an image under 1MB.' });
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoMessage(null);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: base64String
        });
        setPhotoMessage({ type: 'success', text: 'Profile picture updated successfully!' });
        setIsUploadingPhoto(false);
        if (onProfileUpdated) onProfileUpdated();
      };
      reader.onerror = () => {
        setPhotoMessage({ type: 'error', text: 'Failed to read image file.' });
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setPhotoMessage({ type: 'error', text: err.message || 'Failed to update profile picture.' });
      setIsUploadingPhoto(false);
    }
  };

  // Handle Remove Photo
  const handleRemovePhoto = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to remove your profile picture?')) return;

    setIsUploadingPhoto(true);
    setPhotoMessage(null);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        photoURL: ''
      });
      setPhotoMessage({ type: 'success', text: 'Profile picture removed.' });
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      console.error('Error removing photo:', err);
      setPhotoMessage({ type: 'error', text: 'Failed to remove picture.' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Handle Password Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error('User session not active. Please re-login.');
      }

      // Re-authenticate
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update Password
      await updatePassword(currentUser, newPassword);

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        setPasswordError('Incorrect current password.');
      } else if (error.code === 'auth/weak-password') {
        setPasswordError('Password is too weak. Please choose a stronger password.');
      } else {
        setPasswordError(error.message || 'Failed to update password.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Profile Picture Update Section */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Camera size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Profile Picture (প্রোফাইল ছবি)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Upload or update your account avatar
            </p>
          </div>
        </div>

        {photoMessage && (
          <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${
            photoMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {photoMessage.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
            <span>{photoMessage.text}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-slate-100 dark:border-slate-800 shadow-md flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              {userProfile?.photoURL ? (
                <img src={userProfile.photoURL} alt="Profile Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full ${getAvatarColor(userProfile?.displayName || user?.email || '')} flex items-center justify-center text-white text-2xl font-black`}>
                  {getInitials(userProfile?.displayName || user?.email || '')}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="absolute -bottom-2 -right-2 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Upload Photo"
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h4 className="text-base font-black text-slate-800 dark:text-slate-100">
              {userProfile?.displayName || user?.email?.split('@')[0] || 'Agent'}
            </h4>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-0.5">
              {user?.email}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
                Role: {userProfile?.role || 'Staff Agent'}
              </span>
              {userProfile?.employeeId && (
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  ID: {userProfile.employeeId}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Upload size={14} />
                {isUploadingPhoto ? 'Uploading...' : 'Upload Image'}
              </button>

              {userProfile?.photoURL && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={isUploadingPhoto}
                  className="px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:text-slate-300 dark:hover:text-red-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all border border-slate-200 dark:border-slate-700 active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Change Password Section */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Change Password (পাসওয়ার্ড পরিবর্তন)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Secure your account with a new password
            </p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-xs font-bold">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>Password updated successfully! Your account credentials have been updated.</span>
          </div>
        )}

        {passwordError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-3 text-xs font-bold">
            <AlertCircle size={18} className="shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-xl">
          {/* Current Password */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Current Password (বর্তমান পাসওয়ার্ড)
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isChangingPassword}
                placeholder="Enter current password"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              New Password (নতুন পাসওয়ার্ড)
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isChangingPassword}
                placeholder="At least 6 characters"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Confirm New Password (নতুন পাসওয়ার্ড নিশ্চিত করুন)
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword}
                placeholder="Re-enter new password"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isChangingPassword}
            className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
          >
            <Lock size={14} />
            {isChangingPassword ? 'Updating Password...' : 'Update Password (পাসওয়ার্ড আপডেট করুন)'}
          </button>
        </form>
      </div>

      {/* 3. Personal Theme Customization Section */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Palette size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Personal UI Theme (ব্যক্তিগত থিম নির্বাচন)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Customize workspace appearance for your device only
            </p>
          </div>
        </div>

        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-4">
          👤 Agent theme customization is personal. Changing your theme will only affect your display and will not change other users&apos; theme settings.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { id: 'classic-blue', name: 'Classic Blue', color: '#3b82f6', desc: 'Standard Deep Blue' },
            { id: 'royal-indigo', name: 'Royal Indigo', color: '#8b5cf6', desc: 'Modern Violet Slate' },
            { id: 'forest-emerald', name: 'Forest Emerald', color: '#10b981', desc: 'Fresh Mint Green' },
            { id: 'crimson-rose', name: 'Crimson Rose', color: '#f43f5e', desc: 'Vibrant Velvet Pink' },
            { id: 'sunset-amber', name: 'Sunset Amber', color: '#f59e0b', desc: 'Warm Amber Gold' },
            { id: 'amethyst-purple', name: 'Amethyst Purple', color: '#a855f7', desc: 'Deep Royal Purple' },
          ].map((theme) => {
            const isSelected = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onSelectTheme(theme.id)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50/30 dark:bg-purple-900/20 shadow-md ring-2 ring-purple-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-5 h-5 rounded-full shadow-inner border border-white/20" style={{ backgroundColor: theme.color }} />
                  {isSelected && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500 text-white">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    {theme.name}
                  </h5>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                    {theme.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
