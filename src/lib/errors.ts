import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  const errStr = errInfo.error.toLowerCase();
  if (errStr.includes('quota') || errStr.includes('resource-exhausted') || errStr.includes('resource_exhausted')) {
    // Silence quota errors so they don't flood developer console or break application UI
    return;
  } else {
    console.error('Firestore Error: \n' + JSON.stringify(errInfo));
  }
  // We remove the throw to prevent crashing the app on quota exceeded errors, especially in onSnapshot listeners.
}
