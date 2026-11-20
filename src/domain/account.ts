import { AccountType } from '@/database/schema';
import { IconName } from '@/components/ui';

export function accountIcon(type: AccountType): IconName {
  switch (type) {
    case 'CREDIT_CARD':
      return 'creditCard';
    case 'CASH':
      return 'wallet';
    case 'SAVINGS':
    case 'CURRENT':
    default:
      return 'landmark';
  }
}

export function formatAccountType(type: AccountType): string {
  switch (type) {
    case 'SAVINGS':
      return 'Savings Account';
    case 'CURRENT':
      return 'Current Account';
    case 'CREDIT_CARD':
      return 'Credit Card';
    case 'CASH':
      return 'Cash';
  }
}

export function formatAccountLabel(account: { name: string; type: AccountType; mask?: string | null }): string {
  if (account.type === 'CASH') return 'Cash';
  return account.mask ? `${account.name} (••${account.mask})` : account.name;
}
