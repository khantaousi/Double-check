import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { BirthdayWish, UserProfile } from '../types';
import { formatBST } from './utils';

/**
 * Checks whether a user's registered birthday matches today's date in BST.
 */
export function isUserBirthdayToday(birthday?: string): boolean {
  if (!birthday) return false;
  const todayBST = formatBST(new Date(), 'yyyy-MM-dd');
  const todayParts = todayBST.split('-'); // ['2026', '10', '03']
  const bdayParts = birthday.split('-');
  if (bdayParts.length < 3) return false;
  
  const bdayMonth = parseInt(bdayParts[1], 10);
  const bdayDay = parseInt(bdayParts[2], 10);
  const todayMonth = parseInt(todayParts[1], 10);
  const todayDay = parseInt(todayParts[2], 10);
  
  return bdayMonth === todayMonth && bdayDay === todayDay;
}

/**
 * Sends a birthday wish from one user to another.
 * Stored in `birthday_wishes` Firestore collection.
 * Creates an in-app notification for the celebrant.
 */
export async function sendBirthdayWish({
  recipient,
  sender,
  message
}: {
  recipient: UserProfile;
  sender: UserProfile;
  message: string;
}): Promise<string> {
  const trimmedMsg = message.trim();
  if (!trimmedMsg) {
    throw new Error('Birthday wish message cannot be empty.');
  }

  const todayBST = formatBST(new Date(), 'yyyy-MM-dd');
  const nowIso = new Date().toISOString();

  const recipientId = recipient.id || recipient.email;
  const recipientName = recipient.displayName || recipient.email?.split('@')[0] || 'Teammate';
  const recipientEmail = recipient.email || '';

  const senderId = sender.id || sender.email;
  const senderName = sender.displayName || sender.email?.split('@')[0] || 'A Teammate';
  const senderEmail = sender.email || '';
  const senderRole = sender.role === 'admin' ? 'Admin' : (sender.designation || 'Agent');

  const wishData: Omit<BirthdayWish, 'id'> = {
    recipientId,
    recipientName,
    recipientEmail,
    recipientBirthday: recipient.birthday || '',
    senderId,
    senderName,
    senderEmail,
    senderRole,
    message: trimmedMsg,
    wishDate: todayBST,
    createdAt: nowIso
  };

  const docRef = await addDoc(collection(db, 'birthday_wishes'), wishData);

  // Send real-time notification to the celebrant
  try {
    await addDoc(collection(db, 'notifications'), {
      userId: recipientId,
      title: `🎉 Birthday Wish from ${senderName}!`,
      message: `${senderName} wished you: "${trimmedMsg.length > 90 ? trimmedMsg.substring(0, 87) + '...' : trimmedMsg}"`,
      type: 'system',
      isRead: false,
      createdAt: nowIso
    });
  } catch (err) {
    console.warn('Could not post birthday notification:', err);
  }

  return docRef.id;
}

/**
 * Deletes a birthday wish (allowed for sender or admin).
 */
export async function deleteBirthdayWish(wishId: string): Promise<void> {
  if (!wishId) return;
  await deleteDoc(doc(db, 'birthday_wishes', wishId));
}

/**
 * Real-time subscriber for birthday wishes.
 * Strictly filters visibility so ONLY:
 * 1. The recipient ("jake wish korche se")
 * 2. Admin
 * 3. The sender ("je wish korche")
 * can view the wish.
 */
export function subscribeToBirthdayWishes(
  currentUser: UserProfile | null,
  isAdmin: boolean,
  onUpdate: (wishes: BirthdayWish[]) => void
): () => void {
  if (!currentUser) {
    onUpdate([]);
    return () => {};
  }

  const wishesCollection = collection(db, 'birthday_wishes');

  // If Admin: can see all wishes across the platform
  if (isAdmin) {
    const adminQuery = query(wishesCollection, orderBy('createdAt', 'desc'));
    return onSnapshot(adminQuery, (snapshot) => {
      const items: BirthdayWish[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as BirthdayWish);
      });
      onUpdate(items);
    }, (error) => {
      console.warn('Admin birthday_wishes listener error:', error);
    });
  }

  // If Normal User: query where user is either sender or recipient
  const myId = currentUser.id || '';
  const myEmail = currentUser.email || '';

  // Subscribe to wishes sent to me OR wishes sent by me
  let receivedWishes: BirthdayWish[] = [];
  let sentWishes: BirthdayWish[] = [];

  const updateCombined = () => {
    const map = new Map<string, BirthdayWish>();
    receivedWishes.forEach(w => map.set(w.id, w));
    sentWishes.forEach(w => map.set(w.id, w));
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    onUpdate(merged);
  };

  const unsubRecv = onSnapshot(
    query(wishesCollection, where('recipientId', '==', myId || myEmail)),
    (snapshot) => {
      receivedWishes = [];
      snapshot.forEach(d => {
        receivedWishes.push({ id: d.id, ...d.data() } as BirthdayWish);
      });
      updateCombined();
    },
    (err) => console.warn('Received wishes listener error:', err)
  );

  const unsubSent = onSnapshot(
    query(wishesCollection, where('senderId', '==', myId || myEmail)),
    (snapshot) => {
      sentWishes = [];
      snapshot.forEach(d => {
        sentWishes.push({ id: d.id, ...d.data() } as BirthdayWish);
      });
      updateCombined();
    },
    (err) => console.warn('Sent wishes listener error:', err)
  );

  return () => {
    unsubRecv();
    unsubSent();
  };
}
