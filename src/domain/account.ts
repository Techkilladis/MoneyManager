import { Account, AccountType } from '@/database/schema';
import { IconName } from '@/components/ui';

export interface PendingAccountMeta {
  bankName?: string;
  mask?: string;
  resolved?: boolean;
}

const GENERIC_BANK_WORDS = /\b(bank|credit|card|debit|savings|current|account|ltd|limited|india)\b/g;

/** Safely extracts `pendingAccount` metadata from a transaction's `parserMetadata` JSON. */
export function extractPendingAccount(parserMetadata?: string | null): PendingAccountMeta | null {
  if (!parserMetadata) return null;
  try {
    const meta = JSON.parse(parserMetadata);
    if (meta && meta.pendingAccount && typeof meta.pendingAccount === 'object') {
      return meta.pendingAccount as PendingAccountMeta;
    }
  } catch {
    // Ignore malformed JSON metadata
  }
  return null;
}

/** Normalizes a bank name by stripping generic banking/card terms for flexible matching. */
export function normalizeBankName(bankName?: string | null): string {
  const raw = (bankName ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!raw) return '';
  const stripped = raw.replace(GENERIC_BANK_WORDS, ' ').replace(/\s+/g, ' ').trim();
  return stripped || raw;
}

/** Returns true if two bank names refer to the same bank (allowing variants like "HDFC" vs "HDFC Credit Card"). */
export function bankNamesMatch(a?: string | null, b?: string | null): boolean {
  const rawA = (a ?? '').trim().toLowerCase();
  const rawB = (b ?? '').trim().toLowerCase();
  if (!rawA || !rawB) return true;
  if (rawA === rawB) return true;
  const normA = normalizeBankName(rawA);
  const normB = normalizeBankName(rawB);
  if (!normA || !normB) return true;
  if (normA === normB) return true;
  return normA.length >= 3 && normB.length >= 3 && (normA.includes(normB) || normB.includes(normA));
}

/** Finds the best matching non-cash account for a parsed bank name and account/card mask. */
export function findMatchingAccount(
  accounts: Account[],
  bankName?: string | null,
  mask?: string | null
): Account | null {
  const normMask = (mask ?? '').trim();
  if (!normMask) return null;

  const byMask = accounts.filter((a) => a.type !== 'CASH' && (a.mask ?? '').trim() === normMask);
  if (byMask.length === 0) return null;

  const rawBank = (bankName ?? '').trim().toLowerCase();
  if (rawBank) {
    const exact = byMask.find((a) => (a.bankName ?? '').trim().toLowerCase() === rawBank);
    if (exact) return exact;

    const flexible = byMask.find((a) => a.bankName && bankNamesMatch(a.bankName, rawBank));
    if (flexible) return flexible;

    const noBank = byMask.find((a) => !(a.bankName ?? '').trim());
    if (noBank) return noBank;

    return null;
  }

  if (byMask.length === 1) return byMask[0];
  return byMask.find((a) => !(a.bankName ?? '').trim()) ?? byMask[0];
}

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
