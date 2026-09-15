import React, { useState } from 'react';
import { CustomActionButton, UserProfile } from '../types';
import { getIconComponent, getColorTheme, sanitizeUrl } from './CustomButtonsManager';
import { ArrowUpRight, Plus, Settings, Users, UserCheck, Sparkles, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';

interface CustomButtonsDisplayProps {
  buttons: CustomActionButton[];
  currentUser: UserProfile | null;
  isAdmin: boolean;
  onManageClick?: () => void;
  onAddClick?: () => void;
}

export function CustomButtonsDisplay({
  buttons,
  currentUser,
  isAdmin,
  onManageClick,
  onAddClick
}: CustomButtonsDisplayProps) {
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});

  const currentEmail = (currentUser?.email || '').toLowerCase().trim();
  const currentEmpId = (currentUser?.employeeId || '').toLowerCase().trim();
  const currentUserId = currentUser?.id || '';

  // Filter buttons for the current user
  const visibleButtons = buttons.filter(btn => {
    // Inactive buttons are hidden for non-admin
    if (btn.isActive === false && !isAdmin) return false;

    // Admin sees all buttons
    if (isAdmin) return true;

    // Everyone audience
    if (btn.targetAudience === 'all') return true;

    // Specific audience check
    if (btn.targetAudience === 'specific') {
      const assigned = (btn.assignedUserEmails || []).map(e => e.toLowerCase().trim());
      const assignedIds = btn.assignedUserIds || [];

      const matchesEmail = currentEmail && assigned.includes(currentEmail);
      const matchesEmpId = currentEmpId && assigned.includes(currentEmpId);
      const matchesId = currentUserId && assignedIds.includes(currentUserId);

      return matchesEmail || matchesEmpId || matchesId;
    }

    return false;
  });

  // If regular user and no buttons visible, do not take up any space
  if (!isAdmin && visibleButtons.length === 0) {
    return null;
  }

  const handleImageError = (btnId: string) => {
    setFailedImageIds(prev => ({ ...prev, [btnId]: true }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
            <Sparkles size={14} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Quick Actions & Portals (কুইক বাটন ও ডিরেক্ট লিঙ্ক)
            </h4>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {onAddClick && (
              <button
                type="button"
                onClick={onAddClick}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus size={13} />
                <span>+ Add Button</span>
              </button>
            )}
            {onManageClick && (
              <button
                type="button"
                onClick={onManageClick}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer px-1.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Manage buttons in Settings"
              >
                <Settings size={12} />
                <span>Manage</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Buttons Grid or Admin Empty State */}
      {visibleButtons.length === 0 && isAdmin ? (
        <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            No quick action buttons created yet. Create buttons for Google Sheets, Courier Portals, or Drive folders for your team.
          </p>
          {onAddClick && (
            <button
              type="button"
              onClick={onAddClick}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer shadow-xs transition-colors"
            >
              + Create Button
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visibleButtons.map(btn => {
            const IconComp = getIconComponent(btn.icon);
            const theme = getColorTheme(btn.color);
            const isInactive = btn.isActive === false;
            const hasCustomImage = Boolean(btn.logoUrl) && !failedImageIds[btn.id];

            return (
              <a
                key={btn.id}
                href={sanitizeUrl(btn.url)}
                target={btn.openInNewTab !== false ? '_blank' : '_self'}
                rel="noopener noreferrer"
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between group relative overflow-hidden shadow-2xs hover:shadow-md hover:scale-[1.015] active:scale-[0.99] cursor-pointer ${
                  theme.bgLight
                } ${theme.bgDark} ${theme.borderLight} ${theme.borderDark} ${
                  isInactive ? 'opacity-60 saturate-50' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 relative z-10">
                  {/* Logo Container with High-Res Fit */}
                  <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden p-1.5 ${theme.borderLight} ${theme.borderDark} group-hover:scale-105 transition-transform duration-200`}>
                    {hasCustomImage ? (
                      <img
                        src={btn.logoUrl}
                        alt={btn.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain rounded-xl select-none"
                        onError={() => handleImageError(btn.id)}
                      />
                    ) : (
                      <div className={`${theme.textLight} ${theme.textDark}`}>
                        <IconComp size={20} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                        {btn.title}
                      </h5>
                      {isInactive && (
                        <span className="text-[7px] font-black uppercase px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    {btn.description ? (
                      <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                        {btn.description}
                      </p>
                    ) : (
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                        Click to open link
                      </p>
                    )}

                    {/* Admin Audience indicator */}
                    {isAdmin && (
                      <div className="mt-1 flex items-center gap-1">
                        {btn.targetAudience === 'all' ? (
                          <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                            <Users size={9} /> Everyone
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                            <UserCheck size={9} /> Specific ({btn.assignedUserEmails?.length || 0})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sleek Action Arrow on the right */}
                <div className="relative z-10 pl-2 shrink-0">
                  <div className={`w-7 h-7 rounded-xl border flex items-center justify-center bg-white/90 dark:bg-slate-900/90 ${theme.borderLight} ${theme.borderDark} ${theme.textLight} ${theme.textDark} group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200 shadow-2xs`}>
                    <ArrowUpRight size={14} />
                  </div>
                </div>

                {/* Subtle sheen highlight on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 dark:via-white/5 to-white/0 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              </a>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
