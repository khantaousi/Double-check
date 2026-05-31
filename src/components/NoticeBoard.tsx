import React, { useState } from 'react';
import { AppNotice, UserProfile } from '../types';
import { formatBST } from '../lib/utils';
import { parseISO } from 'date-fns';
import { doc, collection, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Bell, Megaphone, Plus, Trash2, Eye, Info, CheckCheck } from 'lucide-react';
import { getBSTISOString } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface NoticeBoardProps {
  notices: AppNotice[];
  userProfile: UserProfile;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({ notices, userProfile }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newNotice, setNewNotice] = useState({ title: '', message: '', expiryDays: '' });
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null);

  const handleCreateNotice = async () => {
    if (!newNotice.title || !newNotice.message) return;
    
    try {
      const noticeRef = doc(collection(db, 'notices'));
      
      let expiresAt: string | undefined = undefined;
      if (newNotice.expiryDays && !isNaN(Number(newNotice.expiryDays))) {
        const date = new Date();
        date.setDate(date.getDate() + Number(newNotice.expiryDays));
        const bstOffsetStr = '+06:00';
        expiresAt = formatBST(date, "yyyy-MM-dd'T'HH:mm:ss.SSS") + bstOffsetStr;
      }

      const notice: any = {
        title: newNotice.title,
        message: newNotice.message,
        createdAt: getBSTISOString(),
        createdBy: userProfile.displayName || userProfile.email || 'Admin',
        viewers: []
      };
      if (expiresAt) {
        notice.expiresAt = expiresAt;
      }
      await setDoc(noticeRef, notice);
      setNewNotice({ title: '', message: '', expiryDays: '' });
      setIsCreating(false);
    } catch (e) {
      console.error("Error creating notice", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this notice permanently?')) {
      await deleteDoc(doc(db, 'notices', id));
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter mb-1">Notice Board</h2>
          <p className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">Global Announcements & View Tracking</p>
        </div>
        
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Plus size={14} />
          Create Notice
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tighter mb-4">New Announcement</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Notice Title</label>
                  <input
                    type="text"
                    value={newNotice.title}
                    onChange={e => setNewNotice({ ...newNotice, title: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    placeholder="E.g., System Maintenance Tomorrow"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Detailed Message</label>
                  <textarea
                    value={newNotice.message}
                    onChange={e => setNewNotice({ ...newNotice, message: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-blue-500 min-h-[120px]"
                    placeholder="Enter the full announcement details here..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Expiration (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={newNotice.expiryDays}
                    onChange={e => setNewNotice({ ...newNotice, expiryDays: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                    placeholder="Enter number of days (e.g., 7)... leave empty for no expiration"
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="px-5 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNotice}
                    disabled={!newNotice.title || !newNotice.message}
                    className="bg-blue-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Megaphone size={14} />
                    Publish
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4">
        {notices.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-800/50 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center">
            <Bell size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
            <h4 className="text-sm font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">No Active Notices</h4>
            <p className="text-xs text-slate-400 mt-2 font-medium">Create a notice to broadcast to all staff.</p>
          </div>
        ) : (
          notices.map(notice => (
            <div key={notice.id} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight mb-2">{notice.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium whitespace-pre-wrap">{notice.message}</p>
                </div>
                {notice.id && (
                  <button 
                    onClick={() => handleDelete(notice.id!)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2 pt-4 border-t border-slate-50 dark:border-slate-800">
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Megaphone size={12} className="text-blue-500" />
                    <span>By {notice.createdBy} on {formatBST(parseISO(notice.createdAt), 'MMM dd, yyyy HH:mm')}</span>
                  </div>
                  {notice.expiresAt && (
                    <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest ml-5">
                      Expires: {formatBST(parseISO(notice.expiresAt), 'MMM dd, yyyy HH:mm')}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setExpandedNoticeId(expandedNoticeId === notice.id ? null : notice.id!)}
                  className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <Eye size={14} />
                  {notice.viewers?.length || 0} Viewers
                </button>
              </div>

              <AnimatePresence>
                {expandedNoticeId === notice.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 mt-4">
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 ml-2 flex items-center gap-2">
                        <CheckCheck size={12} />
                        Read Receipts
                      </h5>
                      {(!notice.viewers || notice.viewers.length === 0) ? (
                        <p className="text-xs text-slate-400 italic ml-2">No one has read this notice yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {notice.viewers.map((v, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{v.userName}</span>
                              <span className="text-[9px] font-black text-slate-400 uppercase">{formatBST(parseISO(v.viewedAt), 'MMM dd, HH:mm')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
