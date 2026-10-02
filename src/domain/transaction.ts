// Domain Types
export * from '../database/schema';

// Re-export formatCurrency from db
export { formatCurrency } from '../database/db';

// Formatted Transaction for UI
export interface FormattedTransaction {
  id: string;
  amount: string;           // Formatted currency string (₹1,250.00)
  amountPaise: number;      // Raw paise value
  currency: string;
  merchant: string;
  date: string;             // Formatted date string
  time: string;             // Formatted time string
  timestamp: number;        // Raw timestamp
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  member: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  note: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'EDITED' | 'CANCELLED';
  sourceApp: string | null;
}

// Home screen data
export interface HomeData {
  totalSpending: number;        // In paise
  totalSpendingFormatted: string;
  pendingCount: number;
  recentTransactions: FormattedTransaction[];
  pendingTransactions: FormattedTransaction[];
}

// Date formatting utilities
export function formatDate(timestamp: number): { date: string; time: string } {
  const date = new Date(timestamp);
  
  const dateStr = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  
  const timeStr = date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  
  return { date: dateStr, time: timeStr };
}

export function formatRelativeDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

// Transaction status helpers
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'EDITED':
      return 'Edited';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

export function getStatusVariant(status: string): 'pending' | 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'CONFIRMED':
      return 'success';
    case 'EDITED':
      return 'warning';
    case 'CANCELLED':
      return 'error';
    default:
      return 'neutral';
  }
}