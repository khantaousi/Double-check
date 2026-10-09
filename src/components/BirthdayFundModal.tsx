import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Wallet, 
  Gift, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Lock, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  User, 
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { BirthdayFundSummary, BirthdayFundTransaction, UserProfile } from '../types';
import { 
  subscribeToBirthdayFundTransactions,
  recordGiftPurchase,
  recordFundDeposit,
  deleteBirthdayFundTransaction,
  reconcileBirthdayFundBalance
} from '../lib/birthdayFundUtils';
import { formatBST } from '../lib/utils';

interface BirthdayFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  summary: BirthdayFundSummary;
  allUsers: UserProfile[];
}

export const BirthdayFundModal: React.FC<BirthdayFundModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  isAdmin,
  summary,
  allUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'expenses' | 'deposits'>('expenses');
  const [transactions, setTransactions] = useState<BirthdayFundTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Forms
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddDeposit, setShowAddDeposit] = useState(false);
  const [showAdjustBalance, setShowAdjustBalance] = useState(false);

  // Add Expense Form state
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [giftItem, setGiftItem] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(formatBST(new Date(), 'yyyy-MM-dd'));
  const [expenseNote, setExpenseNote] = useState('');

  // Add Deposit Form state
  const [depositAmount, setDepositAmount] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [depositDate, setDepositDate] = useState(formatBST(new Date(), 'yyyy-MM-dd'));

  // Adjust Balance state
  const [targetBalance, setTargetBalance] = useState('');

  // Status message
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Subscribe to transactions if admin
  useEffect(() => {
    if (!isOpen || !isAdmin) {
      setTransactions([]);
      return;
    }

    setLoadingTx(true);
    const unsubscribe = subscribeToBirthdayFundTransactions(isAdmin, (items) => {
      setTransactions(items);
      setLoadingTx(false);
    });

    return () => unsubscribe();
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const expenses = transactions.filter(t => t.type === 'expense');
  const deposits = transactions.filter(t => t.type === 'deposit');

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid amount in ৳.' });
      return;
    }
    if (!giftItem.trim()) {
      setFeedback({ type: 'error', message: 'Please specify the item/gift purchased.' });
      return;
    }

    let recipientUser: { id?: string; displayName?: string; email?: string } | undefined;
    if (selectedRecipientId) {
      recipientUser = allUsers.find(u => (u.id || u.email) === selectedRecipientId);
    }
    const finalRecipient = recipientUser || {
      id: '',
      displayName: customRecipientName.trim() || 'Teammate',
      email: ''
    };

    setSubmitting(true);
    try {
      await recordGiftPurchase({
        recipient: finalRecipient,
        itemDescription: giftItem,
        amount: amt,
        date: expenseDate,
        notes: expenseNote,
        adminUser: userProfile,
        currentSummary: summary,
      });

      setGiftItem('');
      setExpenseAmount('');
      setExpenseNote('');
      setSelectedRecipientId('');
      setCustomRecipientName('');
      setShowAddExpense(false);
      setFeedback({ type: 'success', message: 'Gift purchase recorded successfully!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to record expense.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid deposit amount in ৳.' });
      return;
    }

    setSubmitting(true);
    try {
      await recordFundDeposit({
        amount: amt,
        sourceNote: depositNote.trim() || 'Team Birthday Contribution',
        date: depositDate,
        adminUser: userProfile,
        currentSummary: summary,
      });

      setDepositAmount('');
      setDepositNote('');
      setShowAddDeposit(false);
      setFeedback({ type: 'success', message: 'Fund deposit added successfully!' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to add deposit.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTx = async (tx: BirthdayFundTransaction) => {
    if (!userProfile) return;
    const confirmMsg = tx.type === 'expense'
      ? `Delete record for "${tx.itemDescription}" (৳${tx.amount.toLocaleString()})?`
      : `Delete deposit of ৳${tx.amount.toLocaleString()}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteBirthdayFundTransaction({
        tx,
        currentSummary: summary,
        adminUser: userProfile,
      });
      setFeedback({ type: 'success', message: 'Transaction removed and balance recalculated.' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to remove transaction.' });
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    const val = parseFloat(targetBalance);
    if (isNaN(val) || val < 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid balance amount.' });
      return;
    }

    setSubmitting(true);
    try {
      await reconcileBirthdayFundBalance({
        newBalance: val,
        adminUser: userProfile,
        currentSummary: summary,
      });
      setTargetBalance('');
      setShowAdjustBalance(false);
      setFeedback({ type: 'success', message: 'Fund balance successfully adjusted.' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed to adjust balance.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col relative z-10"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent dark:from-amber-950/30 dark:via-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
              <Wallet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-slate-800 dark:text-slate-100 tracking-tight leading-none">
                  Team Birthday Fund
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                  {isAdmin ? 'Admin Management' : 'Community Fund'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                Celebrating every teammate's special day with care & surprises
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

        {/* Feedback Alert */}
        {feedback && (
          <div className={`px-6 py-2.5 text-xs font-bold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-b border-rose-500/20'
          }`}>
            {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 scrollbar-thin">
          {/* Main Fund Overview Card (Visible to Everyone!) */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-amber-600 to-rose-600 p-5 sm:p-6 text-white shadow-xl shadow-amber-500/20">
            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-amber-100 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={14} className="text-amber-200 animate-spin" />
                  <span>Available Birthday Fund Balance</span>
                </div>
                <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1 tabular-nums drop-shadow-sm">
                  ৳ {summary.currentBalance.toLocaleString()}
                </div>
                <div className="text-[11px] text-amber-100/90 font-medium mt-1">
                  Ready for upcoming teammate gifts, cakes & celebration treats 🎂
                </div>
              </div>

              {/* Aggregates */}
              <div className="flex items-center gap-3 bg-black/15 backdrop-blur-md p-2.5 rounded-xl border border-white/10 shrink-0">
                <div className="text-left px-2">
                  <div className="text-[10px] text-amber-200 uppercase font-black tracking-wider flex items-center gap-1">
                    <ArrowDownRight size={11} className="text-emerald-300" />
                    Total Saved
                  </div>
                  <div className="text-sm font-black tabular-nums">
                    ৳ {summary.totalDeposits.toLocaleString()}
                  </div>
                </div>
                <div className="w-[1px] h-7 bg-white/20" />
                <div className="text-left px-2">
                  <div className="text-[10px] text-amber-200 uppercase font-black tracking-wider flex items-center gap-1">
                    <ArrowUpRight size={11} className="text-rose-300" />
                    Gifts Bought
                  </div>
                  <div className="text-sm font-black tabular-nums">
                    ৳ {summary.totalExpenses.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Background glowing decorations */}
            <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute left-1/3 -top-10 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
          </div>

          {/* Regular User View: Confidentiality & Transparency Notice */}
          {!isAdmin && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock size={16} />
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-black text-slate-800 dark:text-slate-100">
                    Confidential Gift Purchase Details
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Fund balance is publicly visible to all team members. To preserve surprises and respect privacy, individual gift costs and purchase breakdowns for specific teammates are managed privately by Admin.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400 font-bold">
                <span>Total Fund Collected: ৳{summary.totalDeposits.toLocaleString()}</span>
                <span>Active Balance: ৳{summary.currentBalance.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* ADMIN ONLY MANAGEMENT SECTION */}
          {isAdmin && (
            <div className="space-y-4">
              {/* Admin Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    onClick={() => setActiveTab('expenses')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'expenses'
                        ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <Gift size={13} />
                    Gift Purchases ({expenses.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('deposits')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'deposits'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    <TrendingUp size={13} />
                    Deposits & Additions ({deposits.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowAddExpense(true);
                      setShowAddDeposit(false);
                      setShowAdjustBalance(false);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <Plus size={13} />
                    Record Gift Expense
                  </button>
                  <button
                    onClick={() => {
                      setShowAddDeposit(true);
                      setShowAddExpense(false);
                      setShowAdjustBalance(false);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <Plus size={13} />
                    Add Deposit
                  </button>
                  <button
                    onClick={() => {
                      setShowAdjustBalance(true);
                      setShowAddExpense(false);
                      setShowAddDeposit(false);
                      setTargetBalance(summary.currentBalance.toString());
                    }}
                    title="Directly calibrate balance"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                </div>
              </div>

              {/* Sub-form: Record Gift Purchase */}
              <AnimatePresence>
                {showAddExpense && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateExpense}
                    className="p-4 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-rose-200/60 dark:border-rose-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        <Gift size={14} />
                        Record Gift Expense ("Kar koto taka diye jinish kine dichi")
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddExpense(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Recipient selection */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Kar jonno (Teammate) *
                        </label>
                        <select
                          value={selectedRecipientId}
                          onChange={(e) => {
                            setSelectedRecipientId(e.target.value);
                            if (e.target.value) setCustomRecipientName('');
                          }}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        >
                          <option value="">-- Select Teammate --</option>
                          {allUsers.map((u) => (
                            <option key={u.id || u.email} value={u.id || u.email}>
                              {u.displayName || u.email?.split('@')[0]} ({u.role || 'Agent'})
                            </option>
                          ))}
                        </select>
                        {!selectedRecipientId && (
                          <input
                            type="text"
                            placeholder="Or type custom recipient name..."
                            value={customRecipientName}
                            onChange={(e) => setCustomRecipientName(e.target.value)}
                            className="w-full mt-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                          />
                        )}
                      </div>

                      {/* Gift / Item Description */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Ki jinish kine deya hoyeche (Gift / Item) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Birthday Cake & Treat, Smart Watch, Headset"
                          value={giftItem}
                          onChange={(e) => setGiftItem(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Koto taka (Amount in ৳) *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          placeholder="e.g. 1500"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Purchase Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={expenseDate}
                          onChange={(e) => setExpenseDate(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    {/* Optional Note */}
                    <div>
                      <input
                        type="text"
                        placeholder="Additional notes / receipt reference (optional)..."
                        value={expenseNote}
                        onChange={(e) => setExpenseNote(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddExpense(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {submitting ? 'Recording...' : 'Save Gift Expense'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Sub-form: Add Deposit */}
              <AnimatePresence>
                {showAddDeposit && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateDeposit}
                    className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-emerald-200/60 dark:border-emerald-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        <TrendingUp size={14} />
                        Add Fund Deposit ("Fund e taka joma dewa")
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddDeposit(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Deposit Amount (৳) *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          step="any"
                          placeholder="e.g. 5000"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Source / Note *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Monthly Team Collection"
                          value={depositNote}
                          onChange={(e) => setDepositNote(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Deposit Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={depositDate}
                          onChange={(e) => setDepositDate(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddDeposit(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {submitting ? 'Adding...' : 'Confirm Deposit'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Sub-form: Adjust Balance directly */}
              <AnimatePresence>
                {showAdjustBalance && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAdjustBalance}
                    className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-amber-200/60 dark:border-amber-900/40">
                      <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        <SlidersHorizontal size={14} />
                        Direct Balance Calibration
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdjustBalance(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                          Current Actual Balance (৳)
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          value={targetBalance}
                          onChange={(e) => setTargetBalance(e.target.value)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 text-sm"
                        />
                      </div>
                      <div className="pt-5">
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50"
                        >
                          Update Balance
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Transactions Tabbed List */}
              <div className="space-y-2">
                {activeTab === 'expenses' ? (
                  /* GIFT EXPENSES LIST */
                  <div>
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400 mb-2 px-1">
                      <span>Itemized Gift Purchases ("Kar koto taka diye jinish kine dichi")</span>
                      <span>Total: ৳{summary.totalExpenses.toLocaleString()}</span>
                    </div>

                    {loadingTx ? (
                      <div className="py-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                        Loading gift purchases...
                      </div>
                    ) : expenses.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <Gift size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-xs font-black text-slate-600 dark:text-slate-400">
                          No gift purchases recorded yet.
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Click "Record Gift Expense" above to log what was bought for a teammate.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {expenses.map((tx) => (
                          <div
                            key={tx.id}
                            className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-rose-300 dark:hover:border-rose-900/40 transition-all flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 font-bold text-xs">
                                🎁
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-xs text-slate-800 dark:text-slate-100">
                                    {tx.recipientName || 'Teammate'}
                                  </span>
                                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                                    For Birthday
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate mt-0.5">
                                  Item: <span className="text-slate-900 dark:text-slate-100">{tx.itemDescription}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-3 mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    {tx.date}
                                  </span>
                                  {tx.notes && <span>• {tx.notes}</span>}
                                  <span>• By {tx.recordedBy}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
                                  - ৳{tx.amount.toLocaleString()}
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase">
                                  Spent
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTx(tx)}
                                title="Delete record"
                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* DEPOSITS LIST */
                  <div>
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400 mb-2 px-1">
                      <span>Fund Deposits & Contributions ("Koto taka joma ache")</span>
                      <span>Total: ৳{summary.totalDeposits.toLocaleString()}</span>
                    </div>

                    {loadingTx ? (
                      <div className="py-8 text-center text-slate-400 text-xs font-bold animate-pulse">
                        Loading deposits...
                      </div>
                    ) : deposits.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <TrendingUp size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <p className="text-xs font-black text-slate-600 dark:text-slate-400">
                          No fund deposits recorded yet.
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          Click "Add Deposit" above to record money collected for the fund.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {deposits.map((tx) => (
                          <div
                            key={tx.id}
                            className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-300 dark:hover:border-emerald-900/40 transition-all flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                                💵
                              </div>
                              <div className="min-w-0">
                                <div className="font-black text-xs text-slate-800 dark:text-slate-100">
                                  {tx.itemDescription}
                                </div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-3 mt-0.5">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    {tx.date}
                                  </span>
                                  <span>• Logged by {tx.recordedBy}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  + ৳{tx.amount.toLocaleString()}
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase">
                                  Added
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTx(tx)}
                                title="Delete deposit"
                                className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 font-bold">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Fund balance is live for everyone • Details managed by Admin</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
