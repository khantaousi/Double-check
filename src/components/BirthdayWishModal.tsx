import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, X, Send, Sparkles, Heart, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { BirthdayWish, UserProfile } from '../types';
import { sendBirthdayWish, deleteBirthdayWish } from '../lib/birthdayUtils';
import { formatBST } from '../lib/utils';

const PRESET_WISHES = [
  "🎉 Happy Birthday! Wishing you joy, great health, and tremendous success in everything you do!",
  "🎂 Warmest wishes on your special day! May your year ahead be blessed with happiness and prosperity!",
  "✨ Happy Birthday! May your day be as wonderful and bright as your dedication to our team!",
  "🎈 Wishing you a fantastic celebration and a year filled with wonderful accomplishments! Happy Birthday!"
];

interface SendBirthdayWishModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: UserProfile | null;
  currentUser: UserProfile;
  onWishSent?: (wishId: string) => void;
}

export const SendBirthdayWishModal: React.FC<SendBirthdayWishModalProps> = ({
  isOpen,
  onClose,
  recipient,
  currentUser,
  onWishSent
}) => {
  const [message, setMessage] = useState(PRESET_WISHES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !recipient) return null;

  const recipientName = recipient.displayName || recipient.email?.split('@')[0] || 'Teammate';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const wishId = await sendBirthdayWish({
        recipient,
        sender: currentUser,
        message
      });

      setStatusMessage({
        type: 'success',
        text: `Your birthday wish has been delivered to ${recipientName}!`
      });

      if (onWishSent) {
        onWishSent(wishId);
      }

      setTimeout(() => {
        setIsSubmitting(false);
        setStatusMessage(null);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Error sending birthday wish:', err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to send wish. Please try again.'
      });
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10 flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-purple-500/10 dark:from-amber-950/20 dark:via-rose-950/20 dark:to-purple-950/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-rose-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-rose-500/20">
                <Gift size={24} className="animate-bounce" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Wish Happy Birthday
                  <Sparkles size={16} className="text-amber-500" />
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  To: <span className="font-extrabold text-slate-800 dark:text-slate-200">{recipientName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Privacy Notice Badge */}
          <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            <span>Privacy Note: Only you, {recipientName}, and Admin can view this wish.</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSend} className="p-6 space-y-4">
            {/* Quick Presets */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                Quick Preset Messages
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                {PRESET_WISHES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMessage(preset)}
                    className={`text-left p-2.5 rounded-xl text-xs transition-all border ${
                      message === preset
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200 font-bold'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Message Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Your Heartfelt Message
                </label>
                <span className="text-[10px] text-slate-400 font-medium">
                  {message.length} chars
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
                disabled={isSubmitting}
                placeholder="Write a sweet birthday wish..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
              />
            </div>

            {/* Feedback alert */}
            {statusMessage && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                ) : (
                  <X size={16} className="shrink-0 text-rose-500" />
                )}
                <span>{statusMessage.text}</span>
              </motion.div>
            )}

            {/* Footer Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-500/20 flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                <span>{isSubmitting ? 'Delivering...' : 'Send Wish 🎉'}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

interface ViewBirthdayWishesModalProps {
  isOpen: boolean;
  onClose: () => void;
  celebrantName: string;
  celebrantId: string;
  wishes: BirthdayWish[];
  currentUser: UserProfile;
  isAdmin: boolean;
  onWishDeleted?: (wishId: string) => void;
}

export const ViewBirthdayWishesModal: React.FC<ViewBirthdayWishesModalProps> = ({
  isOpen,
  onClose,
  celebrantName,
  celebrantId,
  wishes,
  currentUser,
  isAdmin,
  onWishDeleted
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const myId = currentUser.id || '';
  const myEmail = currentUser.email || '';

  // Filter wishes according to the strict rule:
  // "jake wish korche se and admin and je wish korche ei 3 jon dekhte parbe"
  const visibleWishes = wishes.filter((w) => {
    if (isAdmin) return true;
    if (w.recipientId === myId || w.recipientEmail === myEmail) return true; // celebrant
    if (w.senderId === myId || w.senderEmail === myEmail) return true; // sender
    return false;
  });

  const handleDelete = async (wishId: string) => {
    if (!window.confirm('Are you sure you want to remove this birthday wish?')) return;
    setDeletingId(wishId);
    try {
      await deleteBirthdayWish(wishId);
      if (onWishDeleted) {
        onWishDeleted(wishId);
      }
    } catch (err) {
      console.error('Failed to delete wish:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg max-h-[82vh] overflow-hidden shadow-2xl relative z-10 flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shadow-inner">
                <Heart size={20} className="fill-amber-500/20 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                  Birthday Wishes for {celebrantName}
                </h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">
                  {visibleWishes.length} {visibleWishes.length === 1 ? 'Message' : 'Messages'} Received
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Privacy Notice */}
          <div className="px-6 py-2 bg-amber-50/60 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40 flex items-center gap-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
            <ShieldCheck size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Private: Messages are only visible to {celebrantName}, the sender, and Admin.</span>
          </div>

          {/* List of Wishes */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3.5 scrollbar-thin">
            {visibleWishes.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Gift size={24} />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">No wishes to display yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Be the first to send a warm birthday wish!</p>
              </div>
            ) : (
              visibleWishes.map((w) => {
                const isMyWish = w.senderId === myId || w.senderEmail === myEmail;
                const canDelete = isAdmin || isMyWish;

                return (
                  <div
                    key={w.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 transition-all hover:border-amber-300 dark:hover:border-amber-600/50 relative group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-rose-400 text-white font-extrabold text-xs flex items-center justify-center uppercase shadow-sm">
                          {w.senderName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                              {w.senderName}
                            </span>
                            {isMyWish && (
                              <span className="text-[9px] font-black uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded-full">
                                You
                              </span>
                            )}
                            {w.senderRole && (
                              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                • {w.senderRole}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {formatBST(w.createdAt, 'dd MMM, hh:mm a')}
                          </span>
                        </div>
                      </div>

                      {canDelete && (
                        <button
                          onClick={() => handleDelete(w.id)}
                          disabled={deletingId === w.id}
                          title="Delete wish"
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      "{w.message}"
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
