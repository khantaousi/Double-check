import { formatInTimeZone } from 'date-fns-tz';

export const BANGLADESH_TZ = 'Asia/Dhaka';

/**
 * Returns current date/time in Bangladesh Standard Time (UTC+6) in ISO format.
 */
export const getBSTISOString = (date: Date = new Date()) => {
  return formatInTimeZone(date, BANGLADESH_TZ, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
};

/**
 * Formats a date specifically for Bangladesh Time.
 */
export const formatBST = (date: Date | string | number, formatStr: string) => {
  return formatInTimeZone(date, BANGLADESH_TZ, formatStr);
};

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
