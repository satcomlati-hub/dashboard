/**
 * Standard date formatter for Satcom Dashboards.
 * Formats to yyyy/MM/dd as requested by the user.
 */
export const formatDate = (date: string | Date | null | undefined, includeTime = false): string => {
  if (!date) return '-';
  
  let d: Date;
  
  if (typeof date === 'string') {
    // Try to parse standard formats first
    d = new Date(date);
    
    // If invalid, try to parse common local formats like D/M/YYYY or DD/MM/YYYY
    if (isNaN(d.getTime())) {
      // Handle "30/3/2026, 1:30:28 p. m." or "30/3/2026"
      const parts = date.split(',')[0].split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        
        // Handle time if present
        let hours = 0, minutes = 0, seconds = 0;
        const timePart = date.split(',')[1];
        if (timePart) {
          const timeMatch = timePart.match(/(\d+):(\d+):(\d+)/);
          if (timeMatch) {
            hours = parseInt(timeMatch[1], 10);
            minutes = parseInt(timeMatch[2], 10);
            seconds = parseInt(timeMatch[3], 10);
            
            // Handle p. m. / a. m.
            if (timePart.toLowerCase().includes('p. m.') && hours < 12) hours += 12;
            if (timePart.toLowerCase().includes('a. m.') && hours === 12) hours = 0;
          }
        }
        
        d = new Date(year, month, day, hours, minutes, seconds);
      }
    }
  } else {
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) return String(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  const datePart = `${year}/${month}/${day}`;
  
  if (!includeTime) return datePart;

  const hoursStr = String(d.getHours()).padStart(2, '0');
  const minutesStr = String(d.getMinutes()).padStart(2, '0');
  const secondsStr = String(d.getSeconds()).padStart(2, '0');
  
  return `${datePart} ${hoursStr}:${minutesStr}:${secondsStr}`;
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
