import { 
  collection, 
  doc, 
  addDoc, 
  deleteDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { BirthdayFundSummary, BirthdayFundTransaction, UserProfile } from '../types';
import { formatBST } from './utils';

/**
 * Subscribes to the public Birthday Fund Summary.
 * All signed-in team members can view the aggregate balance.
 */
export function subscribeToBirthdayFundSummary(
  onUpdate: (summary: BirthdayFundSummary) => void
): () => void {
  const summaryDocRef = doc(db, 'birthday_fund_summary', 'current');
  
  return onSnapshot(
    summaryDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          currentBalance: Number(data.currentBalance ?? 0),
          totalDeposits: Number(data.totalDeposits ?? 0),
          totalExpenses: Number(data.totalExpenses ?? 0),
          lastUpdated: data.lastUpdated,
          updatedBy: data.updatedBy,
        });
      } else {
        // Initial clean state if never saved yet
        onUpdate({
          currentBalance: 0,
          totalDeposits: 0,
          totalExpenses: 0,
        });
      }
    },
    (error) => {
      console.warn('Birthday fund summary subscription error:', error);
      onUpdate({
        currentBalance: 0,
        totalDeposits: 0,
        totalExpenses: 0,
      });
    }
  );
}

/**
 * Subscribes to itemized Birthday Fund transactions (gift purchases and deposits).
 * Strictly for Admins only. Regular users receive empty list and no Firestore query is run.
 */
export function subscribeToBirthdayFundTransactions(
  isAdmin: boolean,
  onUpdate: (txs: BirthdayFundTransaction[]) => void
): () => void {
  if (!isAdmin) {
    onUpdate([]);
    return () => {};
  }

  const txCollection = collection(db, 'birthday_fund_transactions');
  const q = query(txCollection, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: BirthdayFundTransaction[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as BirthdayFundTransaction);
      });
      onUpdate(items);
    },
    (error) => {
      console.warn('Birthday fund transactions subscription error:', error);
      onUpdate([]);
    }
  );
}

/**
 * Admin records a gift purchase for a teammate ("kar koto taka diye jinish kine dichi").
 * Only visible to admin; updates the fund balance visible to everyone.
 */
export async function recordGiftPurchase({
  recipient,
  itemDescription,
  amount,
  date,
  notes,
  adminUser,
  currentSummary,
}: {
  recipient: { id?: string; displayName?: string; email?: string };
  itemDescription: string;
  amount: number;
  date?: string;
  notes?: string;
  adminUser: UserProfile;
  currentSummary: BirthdayFundSummary;
}): Promise<string> {
  if (!itemDescription.trim()) {
    throw new Error('Please enter the gift/item description.');
  }
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Please enter a valid gift purchase amount.');
  }

  const nowIso = new Date().toISOString();
  const txDate = date || formatBST(new Date(), 'yyyy-MM-dd');

  const newTx: Omit<BirthdayFundTransaction, 'id'> = {
    type: 'expense',
    amount: Number(amount),
    recipientId: recipient.id || recipient.email || '',
    recipientName: recipient.displayName || recipient.email?.split('@')[0] || 'Teammate',
    recipientEmail: recipient.email || '',
    itemDescription: itemDescription.trim(),
    date: txDate,
    notes: notes?.trim() || '',
    recordedBy: adminUser.displayName || adminUser.email || 'Admin',
    createdAt: nowIso,
  };

  const docRef = await addDoc(collection(db, 'birthday_fund_transactions'), newTx);

  // Update aggregate summary
  const newBalance = Math.round((currentSummary.currentBalance - amount) * 100) / 100;
  const newTotalExpenses = Math.round((currentSummary.totalExpenses + amount) * 100) / 100;

  await setDoc(
    doc(db, 'birthday_fund_summary', 'current'),
    {
      currentBalance: newBalance,
      totalDeposits: currentSummary.totalDeposits,
      totalExpenses: newTotalExpenses,
      lastUpdated: nowIso,
      updatedBy: adminUser.displayName || adminUser.email || 'Admin',
    },
    { merge: true }
  );

  return docRef.id;
}

/**
 * Admin deposits / adds money to the birthday fund ("fund e taka joma dewa").
 */
export async function recordFundDeposit({
  amount,
  sourceNote,
  date,
  adminUser,
  currentSummary,
}: {
  amount: number;
  sourceNote: string;
  date?: string;
  adminUser: UserProfile;
  currentSummary: BirthdayFundSummary;
}): Promise<string> {
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Please enter a valid deposit amount.');
  }

  const nowIso = new Date().toISOString();
  const txDate = date || formatBST(new Date(), 'yyyy-MM-dd');

  const newTx: Omit<BirthdayFundTransaction, 'id'> = {
    type: 'deposit',
    amount: Number(amount),
    itemDescription: sourceNote.trim() || 'Fund Deposit / Contribution',
    date: txDate,
    recordedBy: adminUser.displayName || adminUser.email || 'Admin',
    createdAt: nowIso,
  };

  const docRef = await addDoc(collection(db, 'birthday_fund_transactions'), newTx);

  const newBalance = Math.round((currentSummary.currentBalance + amount) * 100) / 100;
  const newTotalDeposits = Math.round((currentSummary.totalDeposits + amount) * 100) / 100;

  await setDoc(
    doc(db, 'birthday_fund_summary', 'current'),
    {
      currentBalance: newBalance,
      totalDeposits: newTotalDeposits,
      totalExpenses: currentSummary.totalExpenses,
      lastUpdated: nowIso,
      updatedBy: adminUser.displayName || adminUser.email || 'Admin',
    },
    { merge: true }
  );

  return docRef.id;
}

/**
 * Admin deletes a transaction and recalculates the summary.
 */
export async function deleteBirthdayFundTransaction({
  tx,
  currentSummary,
  adminUser,
}: {
  tx: BirthdayFundTransaction;
  currentSummary: BirthdayFundSummary;
  adminUser: UserProfile;
}): Promise<void> {
  if (!tx.id) return;
  await deleteDoc(doc(db, 'birthday_fund_transactions', tx.id));

  const nowIso = new Date().toISOString();
  let newBalance = currentSummary.currentBalance;
  let newTotalDeposits = currentSummary.totalDeposits;
  let newTotalExpenses = currentSummary.totalExpenses;

  if (tx.type === 'expense') {
    newBalance = Math.round((newBalance + tx.amount) * 100) / 100;
    newTotalExpenses = Math.round((Math.max(0, newTotalExpenses - tx.amount)) * 100) / 100;
  } else if (tx.type === 'deposit') {
    newBalance = Math.round((newBalance - tx.amount) * 100) / 100;
    newTotalDeposits = Math.round((Math.max(0, newTotalDeposits - tx.amount)) * 100) / 100;
  }

  await setDoc(
    doc(db, 'birthday_fund_summary', 'current'),
    {
      currentBalance: newBalance,
      totalDeposits: newTotalDeposits,
      totalExpenses: newTotalExpenses,
      lastUpdated: nowIso,
      updatedBy: adminUser.displayName || adminUser.email || 'Admin',
    },
    { merge: true }
  );
}

/**
 * Admin reconciles or sets the initial balance directly.
 */
export async function reconcileBirthdayFundBalance({
  newBalance,
  adminUser,
  currentSummary,
}: {
  newBalance: number;
  adminUser: UserProfile;
  currentSummary: BirthdayFundSummary;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  await setDoc(
    doc(db, 'birthday_fund_summary', 'current'),
    {
      currentBalance: Number(newBalance),
      totalDeposits: Math.max(currentSummary.totalDeposits, Number(newBalance) + currentSummary.totalExpenses),
      totalExpenses: currentSummary.totalExpenses,
      lastUpdated: nowIso,
      updatedBy: adminUser.displayName || adminUser.email || 'Admin',
    },
    { merge: true }
  );
}
