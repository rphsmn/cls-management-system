/**
 * Date utility functions for handling Firestore Timestamps and date operations
 */

/**
 * Convert a date value (Firestore Timestamp, string, or Date) to a Date object
 * @param dateValue - The date value to convert
 * @returns Date object or current date if conversion fails
 */
export function toDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  if (dateValue.toDate) return dateValue.toDate(); // Firestore Timestamp
  if (typeof dateValue === 'string' || dateValue instanceof Date) return new Date(dateValue);
  return new Date();
}

/**
 * Get the month from a date value (Firestore Timestamp, string, or Date)
 * @param dateValue - The date value to extract month from
 * @returns Month number (0-11) or -1 if invalid
 */
export function getMonth(dateValue: any): number {
  if (!dateValue) return -1;
  if (dateValue.toDate) return dateValue.toDate().getMonth(); // Firestore Timestamp
  if (typeof dateValue === 'string' || dateValue instanceof Date) return new Date(dateValue).getMonth();
  return -1;
}

/**
 * Check if a target date falls within a period string
 * @param target - The date to check
 * @param period - Period string in format "YYYY-MM-DD to YYYY-MM-DD" or "YYYY-MM-DD - YYYY-MM-DD"
 * @returns True if target date is within the period
 */
export function isDateInPeriod(target: Date, period: string): boolean {
  if (!period) return false;
  const sep = period.includes(' to ') ? ' to ' : ' - ';
  const parts = period.split(sep);
  const start = new Date(parts[0]);
  const end = parts[1] ? new Date(parts[1]) : start;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return target >= start && target <= end;
}

/**
 * Format a date string to a localized format
 * @param dateStr - ISO date string
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string or 'N/A' if invalid
 */
export function formatDate(dateStr: string | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options || defaultOptions);
  } catch {
    return dateStr;
  }
}

/**
 * Calculate years of service from a joined date
 * @param joinedDate - ISO date string or Firestore Timestamp
 * @returns Formatted string representing years of service
 */
export function calculateYearsOfService(joinedDate: string | undefined): string {
  if (!joinedDate) return 'N/A';
  
  const joinDate = toDate(joinedDate);
  if (isNaN(joinDate.getTime())) return 'N/A';
  
  const today = new Date();
  const years = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  if (years < 1) {
    return 'Less than 1 year';
  } else if (years < 2) {
    return '1 year';
  } else {
    return `${Math.floor(years)} years`;
  }
}
