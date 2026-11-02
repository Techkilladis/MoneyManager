// Display formatting for money and dates. All money is integer paise.

const groupFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * ₹1,23,456.50 — paise are shown only when non-zero unless `decimals`
 * forces them, so lists stay compact while exact amounts stay exact.
 */
export function formatINR(paise: number, options: { decimals?: 'auto' | 'always' | 'never'; sign?: boolean } = {}): string {
  const { decimals = 'auto', sign = false } = options;
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  // Without paise, round to the nearest rupee rather than truncating.
  const rupees = decimals === 'never' ? Math.round(abs / 100) : Math.floor(abs / 100);
  const fraction = abs % 100;

  let body = groupFormatter.format(rupees);
  const showFraction = decimals === 'always' || (decimals === 'auto' && fraction !== 0);
  if (showFraction) body += '.' + String(fraction).padStart(2, '0');

  const prefix = negative ? '−' : sign ? '+' : '';
  return `${prefix}₹${body}`;
}

/** Splits an amount for display with de-emphasised paise: ["₹1,250", ".50"]. */
export function splitINR(paise: number): [string, string] {
  const abs = Math.abs(Math.round(paise));
  const whole = `₹${groupFormatter.format(Math.floor(abs / 100))}`;
  const fraction = `.${String(abs % 100).padStart(2, '0')}`;
  return [paise < 0 ? `−${whole}` : whole, fraction];
}

/** ₹950 · ₹12.4K · ₹3.2L · ₹1.1Cr (Indian units) */
export function formatCompactINR(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const sign = paise < 0 ? '−' : '';
  const trim = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '');
  if (rupees >= 1e7) return `${sign}₹${trim(rupees / 1e7)}Cr`;
  if (rupees >= 1e5) return `${sign}₹${trim(rupees / 1e5)}L`;
  if (rupees >= 1e3) return `${sign}₹${trim(rupees / 1e3)}K`;
  return `${sign}₹${Math.round(rupees)}`;
}

/** Text in an amount field → paise (null when empty/invalid). */
export function parseAmount(input: string): number | null {
  const clean = input.replace(/[₹,\s]/g, '');
  if (!/^\d*\.?\d{0,2}$/.test(clean) || clean === '' || clean === '.') return null;
  const value = Math.round(parseFloat(clean) * 100);
  return Number.isFinite(value) ? value : null;
}

/** Paise → text for an amount field ("1250" or "1250.50"). */
export function amountToInput(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const fraction = paise % 100;
  return fraction === 0 ? String(rupees) : `${rupees}.${String(fraction).padStart(2, '0')}`;
}

/** Keeps only digits and one decimal point with at most two decimals. */
export function sanitizeAmountInput(text: string): string {
  let clean = text.replace(/[^0-9.]/g, '');
  const firstDot = clean.indexOf('.');
  if (firstDot !== -1) {
    clean = clean.slice(0, firstDot + 1) + clean.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  }
  clean = clean.replace(/^0+(?=\d)/, '');
  return clean.slice(0, 12);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(ts: number | Date): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** "Today", "Yesterday", "Mon, 13 Oct", or "13 Oct 2024" for other years. */
export function formatDayLabel(ts: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  if (day === today) return 'Today';
  if (day === today - DAY_MS) return 'Yesterday';
  const date = new Date(ts);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-IN', {
    weekday: sameYear ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

export function formatTime(ts: number): string {
  return new Date(ts)
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?(am|pm)$/i, (m) => ' ' + m.trim().toUpperCase());
}

export function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMonthYear(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Human-readable UPI source app name from the stored identifier. */
export function formatSourceApp(source: string | null | undefined): string | null {
  if (!source) return null;
  const known: Record<string, string> = {
    GOOGLE_PAY: 'Google Pay',
    PHONEPE: 'PhonePe',
    PAYTM: 'Paytm',
    BHIM: 'BHIM',
    AMAZON_PAY: 'Amazon Pay',
    CRED: 'CRED',
    BANK_SMS: 'Bank SMS',
    MANUAL: 'Manual',
  };
  const key = source.toUpperCase().replace(/\s+/g, '_');
  if (known[key]) return known[key];
  return source
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** "just now", "5 min ago", "3 hours ago", "2 days ago", then a date. */
export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${pluralize(hours, 'hour')} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${pluralize(days, 'day')} ago`;
  return formatFullDate(ts);
}
