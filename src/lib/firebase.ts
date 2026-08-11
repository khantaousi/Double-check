import { initializeApp, getApp, getApps } from 'firebase/app';
import { setLogLevel } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut as fbSignOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress excessive verbose logs from Firebase SDK
setLogLevel('error');

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Initialize a secondary app for admin-only user creation
export const secondaryApp = initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);
export const secondaryDb = getFirestore(secondaryApp, firebaseConfig.firestoreDatabaseId);

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export const logInWithHandle = async (handle: string, pass: string) => {
  let email = handle;
  
  // If not an email-like string, try to find by loginHandle
  if (!handle.includes('@')) {
    const q = query(collection(db, 'users'), where('loginHandle', '==', handle));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      email = querySnapshot.docs[0].data().email;
    } else {
      // If not found, it might still be a custom ID mapped to dummy email
      const slug = handle.toLowerCase().replace(/[^a-z0-9]/g, '');
      email = `${slug}@internal.parcelintel.com`;
    }
  }
  
  return signInWithEmailAndPassword(auth, email, pass);
};

export const logInWithEmail = logInWithHandle; // Keep compatible
export const signOut = () => fbSignOut(auth);

export const authReady = new Promise<void>((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, () => {
    resolve();
    unsubscribe();
  });
});

async function initFirebase() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Gracefully handle connection or quota error silently
  }
}
initFirebase();
