/**
 * Recursively removes all undefined properties from an object or array.
 * Useful for Firestore which does not allow 'undefined' values.
 */
export const cleanObject = (obj: any): any => {
  if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
    return obj;
  }

  const newObj: any = Array.isArray(obj) ? [] : {};
  Object.keys(obj).forEach((key) => {
    const val = obj[key];
    if (val === undefined) return;
    
    // Recursive cleaning
    newObj[key] = cleanObject(val);
  });
  
  return newObj;
};
