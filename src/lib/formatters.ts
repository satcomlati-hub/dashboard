/**
 * Standard date formatter for Satcom Dashboards.
 * Formats to yyyy/MM/dd as requested by the user.
 */
export const formatDate = (date: string | Date | null | undefined, includeTime = false): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  const datePart = `${year}/${month}/${day}`;
  
  if (!includeTime) return datePart;

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${datePart} ${hours}:${minutes}:${seconds}`;
};

/**
 * Formats a date for display in charts or summaries where space is limited.
 */
export const formatShortDate = (date: string | Date | null | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  // Return yyyy/MM/dd format (as per user request)
  return `${year}/${month}/${day}`;
};
