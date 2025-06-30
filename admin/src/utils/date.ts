/**
 * Safely formats a date string or Date object to a localized string
 * @param date The date to format (can be string, Date, or null/undefined)
 * @param options Intl.DateTimeFormatOptions to customize the output format
 * @returns Formatted date string or 'N/A' if date is invalid
 */
export const formatDate = (
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string => {
  console.log('formatDate called with:', { date, type: typeof date });
  
  if (!date) {
    console.log('No date provided, returning N/A');
    return 'N/A';
  }
  
  try {
    let dateObj: Date;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string') {
      // Try parsing the date string directly first
      dateObj = new Date(date);
      
      // If that fails, try parsing as ISO 8601 with timezone
      if (isNaN(dateObj.getTime())) {
        // Try removing any timezone information and parse as UTC
        const isoString = date.endsWith('Z') ? date : `${date}Z`;
        dateObj = new Date(isoString);
      }
    } else {
      console.warn('Unsupported date format:', date);
      return 'N/A';
    }
    
    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      console.warn('Invalid date:', { 
        input: date, 
        type: typeof date, 
        parsed: dateObj.toString() 
      });
      return 'N/A';
    }
    
    // Format the date using the provided options
    const formattedDate = dateObj.toLocaleString(undefined, options);
    console.log('Successfully formatted date:', { 
      input: date, 
      formatted: formattedDate 
    });
    
    return formattedDate;
  } catch (error) {
    console.error('Error formatting date:', { 
      error, 
      date, 
      type: typeof date 
    });
    return 'N/A';
  }
};

/**
 * Formats a date to a relative time string (e.g., "2 hours ago")
 * @param date The date to format
 * @returns Relative time string
 */
export const formatRelativeTime = (date: string | Date): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    // Less than a minute
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    // Less than an hour
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    }
    
    // Less than a day
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    }
    
    // Less than a week
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    }
    
    // Otherwise, return the full date
    return dateObj.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'N/A';
  }
};
