// Date utilities for transaction date handling

export type DateFilterPreset = 'today' | 'this_week' | 'this_month' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset?: DateFilterPreset;
}

/**
 * Get start of day for a given date
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day for a given date
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get date range for a preset filter
 */
export function getDateRangeForPreset(preset: DateFilterPreset, customRange?: DateRange): DateRange {
  const now = new Date();
  const today = startOfDay(now);
  
  switch (preset) {
    case 'today':
      return {
        startDate: today,
        endDate: endOfDay(now),
        preset: 'today',
      };
    
    case 'this_week': {
      // Start of week (Sunday)
      const dayOfWeek = today.getDay(); // 0 = Sunday
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - dayOfWeek);
      return {
        startDate: startOfWeek,
        endDate: endOfDay(now),
        preset: 'this_week',
      };
    }
    
    case 'this_month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: startOfMonth,
        endDate: endOfDay(now),
        preset: 'this_month',
      };
    }
    
    case 'custom':
      if (customRange) {
        return {
          startDate: startOfDay(customRange.startDate),
          endDate: endOfDay(customRange.endDate),
          preset: 'custom',
        };
      }
      // Fallback to today
      return {
        startDate: today,
        endDate: endOfDay(now),
        preset: 'today',
      };
  }
}

/**
 * Convert date range to timestamp range for database queries
 */
export function dateRangeToTimestamps(range: DateRange): { startTimestamp: number; endTimestamp: number } {
  return {
    startTimestamp: range.startDate.getTime(),
    endTimestamp: range.endDate.getTime(),
  };
}

/**
 * Check if a timestamp falls within a date range
 */
export function isTimestampInRange(timestamp: number, range: DateRange): boolean {
  const { startTimestamp, endTimestamp } = dateRangeToTimestamps(range);
  return timestamp >= startTimestamp && timestamp <= endTimestamp;
}

/**
 * Format date for display (e.g., "Today", "Yesterday", "Jan 15, 2024")
 */
export function formatDisplayDate(date: Date): string {
  const today = startOfDay(new Date());
  const targetDate = startOfDay(date);
  const diffDays = Math.floor((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  
  // Format as "Jan 15, 2024"
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date for list items (e.g., "Jan 15, 2024")
 */
export function formatListDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format time for list items (e.g., "7:42 PM")
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format full datetime for detail screen
 */
export function formatDateTime(date: Date): { date: string; time: string } {
  return {
    date: formatListDate(date),
    time: formatTime(date),
  };
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  
  return formatListDate(date);
}

/**
 * Parse date string to Date object
 * Handles ISO strings and common formats
 */
export function parseDate(input: string): Date | null {
  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

/**
 * Format date for input fields (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format time for input fields (HH:MM)
 */
export function formatTimeForInput(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Combine date and time strings into Date object
 */
export function combineDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Get available date filter presets with labels
 */
/**
 * Get available date filter presets with labels
 */
export function getDateFilterPresets(): { value: DateFilterPreset; label: string }[] {
  return [
    { value: 'today', label: 'Today' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' },
  ];
}

/**
 * Simple date format for list display (e.g., "Jan 15, 2024")
 */
export function formatDate(date: Date): string {
  return formatListDate(date);
}

export const date = {
  startOfDay,
  endOfDay,
  getDateRangeForPreset,
  dateRangeToTimestamps,
  isTimestampInRange,
  formatDisplayDate,
  formatListDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  parseDate,
  formatDateForInput,
  formatTimeForInput,
  combineDateTime,
  getDateFilterPresets,
  formatDate,
};