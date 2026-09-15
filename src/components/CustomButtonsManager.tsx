import React, { useState, useRef } from 'react';
import { CustomActionButton, UserProfile, ButtonLogoType } from '../types';
import { 
  Link, ExternalLink, Globe, FileSpreadsheet, Folder, Sparkles, Star, 
  Smartphone, Bookmark, Shield, Plus, Trash2, Edit3, CheckCircle2, 
  Users, UserCheck, Search, X, Check, ArrowUpRight, Eye, AlertCircle,
  Upload, Image as ImageIcon, Link2, Truck, MessageCircle, Mail,
  Headphones, Calculator, Calendar, Database, ShoppingBag, Copy,
  CheckCheck, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomButtonsManagerProps {
  buttons: CustomActionButton[];
  allUsers: UserProfile[];
  onSave: (buttons: CustomActionButton[]) => Promise<void> | void;
  canWrite?: boolean;
  adminEmail?: string;
}

export const PRESET_ICONS: Array<{ 
  name: string; 
  label: string; 
  category: string;
  component: React.ComponentType<any>;
  suggestedTitle?: string;
}> = [
  { name: 'FileSpreadsheet', label: 'Google Sheets / Excel', category: 'Office & Work', component: FileSpreadsheet, suggestedTitle: 'Google Sheet' },
  { name: 'Folder', label: 'Google Drive / Folder', category: 'Office & Work', component: Folder, suggestedTitle: 'Drive Folder' },
  { name: 'Globe', label: 'Website / Portal', category: 'Web & Links', component: Globe, suggestedTitle: 'Company Portal' },
  { name: 'ExternalLink', label: 'External Link', category: 'Web & Links', component: ExternalLink, suggestedTitle: 'External Tool' },
  { name: 'Link', label: 'Direct URL Link', category: 'Web & Links', component: Link, suggestedTitle: 'Quick Link' },
  { name: 'Truck', label: 'Steadfast / Courier / Delivery', category: 'Logistics & Orders', component: Truck, suggestedTitle: 'Steadfast Courier' },
  { name: 'ShoppingBag', label: 'Store / Inventory / Shop', category: 'Logistics & Orders', component: ShoppingBag, suggestedTitle: 'Order Dashboard' },
  { name: 'Database', label: 'Database / ERP System', category: 'Systems & Data', component: Database, suggestedTitle: 'ERP System' },
  { name: 'Calculator', label: 'Accounting / Calculator', category: 'Systems & Data', component: Calculator, suggestedTitle: 'Accounts Calculator' },
  { name: 'Calendar', label: 'Duty Roster / Schedule', category: 'Office & Work', component: Calendar, suggestedTitle: 'Roster Schedule' },
  { name: 'MessageCircle', label: 'WhatsApp / Support Chat', category: 'Communication', component: MessageCircle, suggestedTitle: 'WhatsApp Support' },
  { name: 'Mail', label: 'Gmail / Email Inbox', category: 'Communication', component: Mail, suggestedTitle: 'Company Mail' },
  { name: 'Headphones', label: 'Customer Helpline / Desk', category: 'Communication', component: Headphones, suggestedTitle: 'Helpdesk' },
  { name: 'Smartphone', label: 'Mobile App / APK', category: 'General', component: Smartphone, suggestedTitle: 'Mobile App' },
  { name: 'Sparkles', label: 'AI Tools / Assistant', category: 'General', component: Sparkles, suggestedTitle: 'AI Workspace' },
  { name: 'Star', label: 'Important / Favorite', category: 'General', component: Star, suggestedTitle: 'Priority Task' },
  { name: 'Bookmark', label: 'Saved Guide / Document', category: 'General', component: Bookmark, suggestedTitle: 'Staff Manual' },
  { name: 'Shield', label: 'Admin / Security Portal', category: 'General', component: Shield, suggestedTitle: 'Security Portal' },
];

export const COLOR_THEMES: Array<{
  id: NonNullable<CustomActionButton['color']>;
  label: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  textLight: string;
  textDark: string;
  accentBg: string;
  ringColor: string;
}> = [
  { id: 'blue', label: 'Classic Blue', bgLight: 'bg-blue-50/80', bgDark: 'dark:bg-blue-950/20', borderLight: 'border-blue-200', borderDark: 'dark:border-blue-900/40', textLight: 'text-blue-600', textDark: 'dark:text-blue-400', accentBg: 'bg-blue-600', ringColor: 'ring-blue-500' },
  { id: 'emerald', label: 'Emerald Green', bgLight: 'bg-emerald-50/80', bgDark: 'dark:bg-emerald-950/20', borderLight: 'border-emerald-200', borderDark: 'dark:border-emerald-900/40', textLight: 'text-emerald-600', textDark: 'dark:text-emerald-400', accentBg: 'bg-emerald-600', ringColor: 'ring-emerald-500' },
  { id: 'indigo', label: 'Royal Indigo', bgLight: 'bg-indigo-50/80', bgDark: 'dark:bg-indigo-950/20', borderLight: 'border-indigo-200', borderDark: 'dark:border-indigo-900/40', textLight: 'text-indigo-600', textDark: 'dark:text-indigo-400', accentBg: 'bg-indigo-600', ringColor: 'ring-indigo-500' },
  { id: 'purple', label: 'Violet Purple', bgLight: 'bg-purple-50/80', bgDark: 'dark:bg-purple-950/20', borderLight: 'border-purple-200', borderDark: 'dark:border-purple-900/40', textLight: 'text-purple-600', textDark: 'dark:text-purple-400', accentBg: 'bg-purple-600', ringColor: 'ring-purple-500' },
  { id: 'amber', label: 'Warm Amber', bgLight: 'bg-amber-50/80', bgDark: 'dark:bg-amber-950/20', borderLight: 'border-amber-200', borderDark: 'dark:border-amber-900/40', textLight: 'text-amber-600', textDark: 'dark:text-amber-400', accentBg: 'bg-amber-600', ringColor: 'ring-amber-500' },
  { id: 'rose', label: 'Ruby Rose', bgLight: 'bg-rose-50/80', bgDark: 'dark:bg-rose-950/20', borderLight: 'border-rose-200', borderDark: 'dark:border-rose-900/40', textLight: 'text-rose-600', textDark: 'dark:text-rose-400', accentBg: 'bg-rose-600', ringColor: 'ring-rose-500' },
  { id: 'sky', label: 'Sky Cyan', bgLight: 'bg-sky-50/80', bgDark: 'dark:bg-sky-950/20', borderLight: 'border-sky-200', borderDark: 'dark:border-sky-900/40', textLight: 'text-sky-600', textDark: 'dark:text-sky-400', accentBg: 'bg-sky-600', ringColor: 'ring-sky-500' },
  { id: 'slate', label: 'Steel Slate', bgLight: 'bg-slate-100/80', bgDark: 'dark:bg-slate-800/40', borderLight: 'border-slate-200', borderDark: 'dark:border-slate-700/60', textLight: 'text-slate-700', textDark: 'dark:text-slate-300', accentBg: 'bg-slate-700', ringColor: 'ring-slate-500' },
];

export function getIconComponent(iconName?: string) {
  const found = PRESET_ICONS.find(i => i.name === iconName);
  return found ? found.component : ExternalLink;
}

export function getColorTheme(colorName?: string) {
  const found = COLOR_THEMES.find(c => c.id === colorName);
  return found || COLOR_THEMES[0];
}

export function sanitizeUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '#';
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Resizes an uploaded image on the client side using HTML5 Canvas
 * to a lightweight, retina-sharp square (max 128x128px).
 * This ensures lightning-fast rendering and minimal Firestore document size (<10KB).
 */
export function resizeImageToDataUrl(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.92));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CustomButtonsManager({
  buttons,
  allUsers,
  onSave,
  canWrite = true,
  adminEmail = ''
}: CustomButtonsManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingButton, setEditingButton] = useState<CustomActionButton | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'specific'>('all');
  const [assignedEmails, setAssignedEmails] = useState<string[]>([]);
  
  // Logo & Icon State
  const [logoType, setLogoType] = useState<ButtonLogoType>('preset');
  const [logoUrl, setLogoUrl] = useState('');
  const [presetIcon, setPresetIcon] = useState<string>('FileSpreadsheet');
  const [color, setColor] = useState<CustomActionButton['color']>('blue');
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [isActive, setIsActive] = useState(true);
  
  // Upload State
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [iconCategoryFilter, setIconCategoryFilter] = useState<string>('All');
  const [formError, setFormError] = useState<string | null>(null);

  const openCreateModal = () => {
    setEditingButton(null);
    setTitle('');
    setDescription('');
    setUrl('');
    setTargetAudience('all');
    setAssignedEmails([]);
    setLogoType('preset');
    setLogoUrl('');
    setPresetIcon('FileSpreadsheet');
    setColor('blue');
    setOpenInNewTab(true);
    setIsActive(true);
    setUserSearchTerm('');
    setFormError(null);
    setImageError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (btn: CustomActionButton) => {
    setEditingButton(btn);
    setTitle(btn.title || '');
    setDescription(btn.description || '');
    setUrl(btn.url || '');
    setTargetAudience(btn.targetAudience || 'all');
    setAssignedEmails(btn.assignedUserEmails || []);
    setLogoType(btn.logoType || (btn.logoUrl ? 'url' : 'preset'));
    setLogoUrl(btn.logoUrl || '');
    setPresetIcon(btn.icon || 'ExternalLink');
    setColor(btn.color || 'blue');
    setOpenInNewTab(btn.openInNewTab !== false);
    setIsActive(btn.isActive !== false);
    setUserSearchTerm('');
    setFormError(null);
    setImageError(null);
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    try {
      setIsProcessingImage(true);
      setImageError(null);
      const optimizedDataUrl = await resizeImageToDataUrl(file, 128);
      setLogoUrl(optimizedDataUrl);
      setLogoType('upload');
    } catch (err) {
      console.error('Image processing error:', err);
      setImageError('Failed to process image. Please try another file.');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleToggleUserEmail = (email: string) => {
    const lower = email.toLowerCase().trim();
    setAssignedEmails(prev => {
      const exists = prev.some(e => e.toLowerCase().trim() === lower);
      if (exists) {
        return prev.filter(e => e.toLowerCase().trim() !== lower);
      } else {
        return [...prev, lower];
      }
    });
  };

  const handleSelectAllUsers = () => {
    const allEmails = allUsers.map(u => u.email.toLowerCase().trim()).filter(Boolean);
    setAssignedEmails(allEmails);
  };

  const handleClearAllUsers = () => {
    setAssignedEmails([]);
  };

  const handleToggleActive = async (id: string) => {
    if (!canWrite) return;
    const updated = buttons.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b);
    await onSave(updated);
  };

  const handleDeleteButton = async (id: string) => {
    if (!canWrite) return;
    if (!confirm('Are you sure you want to delete this custom action button?')) return;
    const updated = buttons.filter(b => b.id !== id);
    await onSave(updated);
  };

  const handleCopyLink = (urlToCopy: string, id: string) => {
    try {
      navigator.clipboard.writeText(urlToCopy);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Please enter a title for this button (বাটনের নাম লিখুন)');
      return;
    }

    const cleanLink = url.trim();
    if (!cleanLink) {
      setFormError('Please enter the target redirect URL / link (ক্লিক করলে কোন লিংকে যাবে তা দিন)');
      return;
    }

    if (targetAudience === 'specific' && assignedEmails.length === 0) {
      setFormError('Please select at least one teammate who can view this button, or switch to "Everyone".');
      return;
    }

    if ((logoType === 'upload' || logoType === 'url') && !logoUrl.trim()) {
      setFormError('Please upload an image or provide an image link, or switch back to "Default Preset Icon".');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const finalLogoUrl = (logoType === 'upload' || logoType === 'url') ? logoUrl.trim() : undefined;

      if (editingButton) {
        // Edit existing
        const updatedList = buttons.map(b => {
          if (b.id === editingButton.id) {
            return {
              ...b,
              title: cleanTitle,
              description: description.trim() || undefined,
              url: cleanLink,
              targetAudience,
              assignedUserEmails: targetAudience === 'all' ? [] : assignedEmails,
              logoType,
              logoUrl: finalLogoUrl,
              icon: presetIcon,
              color,
              openInNewTab,
              isActive
            };
          }
          return b;
        });
        await onSave(updatedList);
      } else {
        // Create new
        const newBtn: CustomActionButton = {
          id: `btn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: cleanTitle,
          description: description.trim() || undefined,
          url: cleanLink,
          targetAudience,
          assignedUserEmails: targetAudience === 'all' ? [] : assignedEmails,
          logoType,
          logoUrl: finalLogoUrl,
          icon: presetIcon,
          color,
          openInNewTab,
          createdAt: now,
          createdBy: adminEmail,
          isActive
        };
        await onSave([...buttons, newBtn]);
      }

      setSaveSuccessMessage(editingButton ? 'Button updated successfully!' : 'Button created successfully!');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save button:', err);
      setFormError(err.message || 'Failed to save button. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered users for specific assignment
  const filteredUsers = allUsers.filter(u => {
    const term = userSearchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (u.displayName || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.employeeId || '').toLowerCase().includes(term)
    );
  });

  // Unique categories of preset icons
  const categories = ['All', ...Array.from(new Set(PRESET_ICONS.map(i => i.category)))];
  const filteredPresetIcons = PRESET_ICONS.filter(i => {
    if (iconCategoryFilter === 'All') return true;
    return i.category === iconCategoryFilter;
  });

  const selectedColorTheme = getColorTheme(color);
  const SelectedPresetComp = getIconComponent(presetIcon);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              <Sparkles size={18} />
            </span>
            <div>
              <h4 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                Quick Action Buttons & Direct Links (কুইক বাটন ও ডিরেক্ট লিঙ্ক)
              </h4>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                Create custom portal buttons with default or uploaded logos, target specific employees, and set redirect links.
              </p>
            </div>
          </div>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus size={16} />
            <span>+ Add New Button</span>
          </button>
        )}
      </div>

      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Buttons Table / Grid View in Admin */}
      {buttons.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Link2 size={24} />
          </div>
          <h5 className="text-sm font-black text-slate-700 dark:text-slate-300">
            No Custom Action Buttons Configured
          </h5>
          <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
            Add buttons for your staff with custom logos (Google Sheets, Steadfast, WhatsApp, Drive, etc.) visible to everyone or specific staff members.
          </p>
          {canWrite && (
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Create First Button
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {buttons.map(btn => {
            const theme = getColorTheme(btn.color);
            const IconComp = getIconComponent(btn.icon);
            const hasCustomImg = (btn.logoType === 'upload' || btn.logoType === 'url') && btn.logoUrl;

            return (
              <div
                key={btn.id}
                className={`p-4 rounded-2xl border transition-all relative flex flex-col justify-between ${theme.bgLight} ${theme.bgDark} ${theme.borderLight} ${theme.borderDark} ${
                  btn.isActive === false ? 'opacity-50 saturate-50' : 'shadow-xs hover:shadow-sm'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Logo or Preset Icon Box */}
                      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-1.5 ${theme.borderLight} ${theme.borderDark}`}>
                        {hasCustomImg ? (
                          <img
                            src={btn.logoUrl}
                            alt={btn.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain rounded-xl select-none"
                            onError={(e) => {
                              // If image fails, replace with icon fallback
                              const target = e.currentTarget;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className={`${theme.textLight} ${theme.textDark}`}>
                            <IconComp size={20} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                            {btn.title}
                          </h5>
                          {btn.isActive === false && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Inactive
                            </span>
                          )}
                        </div>
                        {btn.description ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {btn.description}
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                            {btn.url}
                          </p>
                        )}
                      </div>
                    </div>

                    <a
                      href={sanitizeUrl(btn.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`p-2 rounded-xl border flex items-center justify-center bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-800 ${theme.borderLight} ${theme.borderDark} ${theme.textLight} ${theme.textDark} transition-colors cursor-pointer shrink-0`}
                      title="Open target link"
                    >
                      <ArrowUpRight size={14} />
                    </a>
                  </div>

                  {/* Target Audience and Type Info */}
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      {btn.targetAudience === 'all' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                          <Users size={11} /> Everyone (সবাই)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                          <UserCheck size={11} /> Specific ({btn.assignedUserEmails?.length || 0} users)
                        </span>
                      )}

                      {hasCustomImg && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-bold text-[9px]">
                          <ImageIcon size={10} /> Custom Logo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(btn.url, btn.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title="Copy link"
                      >
                        {copiedId === btn.id ? <CheckCheck size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(btn)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            title="Edit button"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(btn.id)}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                            title={btn.isActive ? "Deactivate" : "Activate"}
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteButton(btn.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete button"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col relative z-10 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-800 dark:text-slate-100 tracking-tight">
                      {editingButton ? 'Edit Action Button (বাটন এডিট করুন)' : 'Create New Action Button (নতুন বাটন তৈরি করুন)'}
                    </h3>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      Configure title, redirect link, logo (presets or upload/link), and target audience.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveModal} className="flex-1 overflow-y-auto p-5 space-y-6">
                {formError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Basic Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Button Title (বাটনের নাম) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Google Sheet, Steadfast Courier, Daily Delivery Log"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Target Link / URL (ক্লিক করলে যেখানে যাবে) *
                    </label>
                    <div className="relative">
                      <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        type="text"
                        required
                        placeholder="https://docs.google.com/spreadsheets/d/... or https://steadfast.com.bd"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Optional Short Note / Description (ছোট বিবরণ)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Orders and dispatch spreadsheet, Customer support portal"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                {/* 2. Logo & Icon Selection Section */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Button Logo & Icon (বাটনের লোগো ও আইকন)
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Select default preset, upload logo, or enter image link
                    </span>
                  </div>

                  {/* Logo Source Type Tabs */}
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setLogoType('preset')}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        logoType === 'preset'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Sparkles size={14} />
                      <span>Default Logos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoType('upload')}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        logoType === 'upload'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Upload size={14} />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoType('url')}
                      className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                        logoType === 'url'
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Link2 size={14} />
                      <span>Image Link</span>
                    </button>
                  </div>

                  {/* Tab 1: Default Preset Icons */}
                  {logoType === 'preset' && (
                    <div className="space-y-3 pt-1">
                      {/* Category filters */}
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setIconCategoryFilter(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                              iconCategoryFilter === cat
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-thin">
                        {filteredPresetIcons.map(item => {
                          const IconComponent = item.component;
                          const isSelected = presetIcon === item.name;
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => {
                                setPresetIcon(item.name);
                                if (!title && item.suggestedTitle) {
                                  setTitle(item.suggestedTitle);
                                }
                              }}
                              className={`p-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                <IconComponent size={16} />
                              </div>
                              <span className="text-xs font-bold truncate leading-tight">
                                {item.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Upload Image */}
                  {logoType === 'upload' && (
                    <div className="space-y-3 pt-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />

                      {logoUrl ? (
                        <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                              <img
                                src={logoUrl}
                                alt="Custom Logo Preview"
                                className="w-full h-full object-contain rounded-xl"
                              />
                            </div>
                            <div>
                              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                                Custom Logo Ready
                              </span>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Automatically optimized to lightweight retina icon.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setLogoUrl('');
                                setLogoType('preset');
                              }}
                              className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Remove logo"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/60 dark:bg-slate-900/40 text-center cursor-pointer transition-colors space-y-2"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                            {isProcessingImage ? (
                              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Upload size={20} />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-700 dark:text-slate-300">
                              Click to choose or drop logo image from device
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Supports PNG, JPG, SVG, WebP (auto-scaled for optimal UI)
                            </p>
                          </div>
                        </div>
                      )}

                      {imageError && (
                        <p className="text-xs text-red-600 font-bold">{imageError}</p>
                      )}
                    </div>
                  )}

                  {/* Tab 3: Image URL Link */}
                  {logoType === 'url' && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <input
                          type="url"
                          placeholder="https://example.com/logo.png or SVG URL"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Paste a direct web image URL (Google Drive icon, company badge, logo link).
                        </p>
                      </div>

                      {logoUrl && (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                          <div className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden p-1 shrink-0">
                            <img
                              src={logoUrl}
                              alt="Link Logo Preview"
                              className="w-full h-full object-contain rounded-lg"
                              onError={() => setImageError('Could not load image from this URL. Please verify the link.')}
                              onLoad={() => setImageError(null)}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                            {imageError ? <span className="text-red-500">{imageError}</span> : 'Image loaded successfully'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Color Theme Selector */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Card Theme & Accents (রং ও থিম)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_THEMES.map(th => {
                      const isSelected = color === th.id;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setColor(th.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            isSelected
                              ? `${th.bgLight} ${th.bgDark} ${th.borderLight} ${th.borderDark} ${th.textLight} ${th.textDark} ring-2 ${th.ringColor}`
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className={`w-2.5 h-2.5 rounded-full ${th.accentBg}`} />
                          <span>{th.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Target Audience (Permissions) */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Target Audience (কাদের কাছে শো করবে) *
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Control visibility per employee or company-wide
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTargetAudience('all')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        targetAudience === 'all'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${targetAudience === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-black">All Employees (সবাই)</div>
                        <div className="text-[10px] text-slate-400">Available to all staff members</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetAudience('specific')}
                      className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                        targetAudience === 'specific'
                          ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${targetAudience === 'specific' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                        <UserCheck size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-black">Specific Employees (নির্দিষ্ট)</div>
                        <div className="text-[10px] text-slate-400">Only selected team members</div>
                      </div>
                    </button>
                  </div>

                  {/* Specific User Selection List */}
                  {targetAudience === 'specific' && (
                    <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input
                            type="text"
                            placeholder="Search employee by name, email or ID..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0 text-[11px]">
                          <button
                            type="button"
                            onClick={handleSelectAllUsers}
                            className="px-2 py-1 text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <button
                            type="button"
                            onClick={handleClearAllUsers}
                            className="px-2 py-1 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                        {filteredUsers.length === 0 ? (
                          <div className="text-center py-4 text-xs text-slate-400">
                            No matching employees found.
                          </div>
                        ) : (
                          filteredUsers.map(u => {
                            const uEmail = (u.email || '').toLowerCase().trim();
                            const isChecked = assignedEmails.includes(uEmail);
                            return (
                              <label
                                key={u.id || u.email}
                                className={`flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer text-xs ${
                                  isChecked 
                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200 font-bold' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleToggleUserEmail(uEmail)}
                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <div className="truncate">
                                    <span className="truncate block font-bold">{u.displayName || u.email}</span>
                                    <span className="text-[10px] text-slate-400 font-normal truncate block">
                                      {u.email} {u.employeeId ? `• ID: ${u.employeeId}` : ''}
                                    </span>
                                  </div>
                                </div>
                                {isChecked && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                              </label>
                            );
                          })
                        )}
                      </div>

                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                        Selected: <span className="text-indigo-600 dark:text-indigo-400 font-black">{assignedEmails.length}</span> staff members
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Live UI Preview */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Live UI Preview (ইউআইতে কেমন দেখাবে)
                  </label>

                  <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between relative overflow-hidden shadow-xs ${selectedColorTheme.bgLight} ${selectedColorTheme.bgDark} ${selectedColorTheme.borderLight} ${selectedColorTheme.borderDark}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 shadow-sm overflow-hidden p-1.5 ${selectedColorTheme.borderLight} ${selectedColorTheme.borderDark}`}>
                        {(logoType === 'upload' || logoType === 'url') && logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo preview"
                            className="w-full h-full object-contain rounded-xl"
                          />
                        ) : (
                          <div className={`${selectedColorTheme.textLight} ${selectedColorTheme.textDark}`}>
                            <SelectedPresetComp size={20} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                          {title || 'Button Title Preview'}
                        </h5>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {description || url || 'https://your-redirect-link.com'}
                        </p>
                      </div>
                    </div>

                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center bg-white/80 dark:bg-slate-900/80 ${selectedColorTheme.borderLight} ${selectedColorTheme.borderDark} ${selectedColorTheme.textLight} ${selectedColorTheme.textDark} shrink-0`}>
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                </div>

                {/* Submit buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingButton ? 'Update Button' : 'Create Button'}</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
