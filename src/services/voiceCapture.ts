/**
 * Natural-language transaction parser.
 *
 * Translates phrases like "paid ₹200 for swiggy" or "lunch 300" into
 * structured transaction data (amount, merchant, category, member).
 *
 * Design goals:
 * - Works offline, no API calls
 * - Handles INR symbols (₹, Rs, Rs.) and common separators
 * - Recognises ~30 common categories from keywords
 * - Learns new merchant→category mappings from merchant memory
 * - Graceful degradation: partial matches still produce usable data
 */

import { classificationService, memberService } from './index';

// ---------------------------------------------------------------- categories

export interface CategoryMatch {
  categoryId: string | null;
  name: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/** Common keywords → category name mapping. */
const KEYWORD_CATEGORIES: Record<string, string> = {
  // Food & Dining
  swiggy: 'Food & Dining',
  zomato: 'Food & Dining',
  swiggyinstamart: 'Groceries',
  zeptonow: 'Groceries',
  blinkit: 'Groceries',
  bigbasket: 'Groceries',
  amazonfresh: 'Groceries',
  restaurant: 'Food & Dining',
  cafe: 'Food & Dining',
  pizza: 'Food & Dining',
  burger: 'Food & Dining',
  lunch: 'Food & Dining',
  dinner: 'Food & Dining',
  breakfast: 'Food & Dining',
  tea: 'Food & Dining',
  coffee: 'Food & Dining',
  chai: 'Food & Dining',
  sandwich: 'Food & Dining',
  momo: 'Food & Dining',
  momos: 'Food & Dining',
  thali: 'Food & Dining',
  biryani: 'Food & Dining',
  food: 'Food & Dining',
  eat: 'Food & Dining',

  // Transport
  uber: 'Transport',
  ola: 'Transport',
  cab: 'Transport',
  taxi: 'Transport',
  auto: 'Transport',
  cabify: 'Transport',
  rapido: 'Transport',
  metro: 'Transport',
  bus: 'Transport',
  fuel: 'Transport',
  petrol: 'Transport',
  diesel: 'Transport',
  parking: 'Transport',

  // Shopping
  amazon: 'Shopping',
  flipkart: 'Shopping',
  myntra: 'Shopping',
  ajio: 'Shopping',
  nykaa: 'Shopping',
  trendyol: 'Shopping',
  clothing: 'Shopping',
  shoes: 'Shopping',
  electronics: 'Shopping',
  phone: 'Shopping',
  mobile: 'Shopping',

  // Bills & Utilities
  electricity: 'Bills',
  electric: 'Bills',
  water: 'Bills',
  gas: 'Bills',
  internet: 'Bills',
  wifi: 'Bills',
  broadband: 'Bills',
  phonebill: 'Bills',
  mobilebill: 'Bills',
  recharge: 'Bills',
  prepaid: 'Bills',
  postpaid: 'Bills',
  airtel: 'Bills',
  jio: 'Bills',
  vi: 'Bills',
  idea: 'Bills',

  // Health
  medicine: 'Health',
  medical: 'Health',
  hospital: 'Health',
  doctor: 'Health',
  pharmacy: 'Health',
  clinic: 'Health',

  // Education
  school: 'Education',
  tuition: 'Education',
  course: 'Education',
  fee: 'Education',
  books: 'Education',

  // Entertainment
  movie: 'Entertainment',
  netflix: 'Entertainment',
  prime: 'Entertainment',
  spotify: 'Entertainment',
  youtube: 'Entertainment',
  game: 'Entertainment',
  gaming: 'Entertainment',
  subscription: 'Entertainment',
  netflixprime: 'Entertainment',

  // Income
  salary: 'Salary',
  salaryd: 'Salary',
  salarya: 'Salary',
  salaryb: 'Salary',
  salaryc: 'Salary',
  salarye: 'Salary',
  salaryf: 'Salary',
  salaryg: 'Salary',
  salaryh: 'Salary',
  salaryi: 'Salary',
  salaryj: 'Salary',
  salaryk: 'Salary',
  salaryl: 'Salary',
  salarym: 'Salary',
  salaryn: 'Salary',
  salaryo: 'Salary',
  salaryp: 'Salary',
  salaryq: 'Salary',
  salaryr: 'Salary',
  salaries: 'Salary',
  salaryt: 'Salary',
  salaryu: 'Salary',
  salaryv: 'Salary',
  salaryw: 'Salary',
  salaryx: 'Salary',
  salaryy: 'Salary',
  salaryz: 'Salary',
  freelance: 'Freelance',
  freelancepayment: 'Freelance',
  refund: 'Refund',
  returned: 'Refund',
  gift: 'Gift',
  interest: 'Interest',
  investment: 'Investment',
  dividend: 'Investment',
  rentreceived: 'Rent',
  commission: 'Commission',
};

// Normalised version of keywords for matching
const NORMALISED_KEYWORDS = Object.fromEntries(
  Object.entries(KEYWORD_CATEGORIES).map(([k, v]) => [k.toLowerCase().replace(/[^a-z]/g, ''), v])
);

// ---------------------------------------------------------------- amounts

/**
 * Extract the first INR amount from text.
 * Handles: ₹200, Rs.200, Rs 200, 200 rupees, 2,500, etc.
 */
export function extractAmount(text: string): number | null {
  // Patterns: ₹200 | Rs.200 | Rs 200 | 200 rupees | 2,500
  const patterns = [
    /[\u20B9₹]\s*([\d,]+(?:\.\d{1,2})?)/i,    // ₹200 or Rs.200
    /rs[\.\s]\s*([\d,]+(?:\.\d{1,2})?)/i,       // Rs 200
    /([\d,]+(?:\.\d{1,2})?)\s*(?:rupees?|bucks|bucks?)/i, // 200 rupees
    /(?:paid|debited|spent|paid\s+for)\s+[\u20B9₹]?\s*([\d,]+(?:\.\d{1,2})?)/i, // paid ₹200
    /(?:received|credited|got|got\s+back)\s+[\u20B9₹]?\s*([\d,]+(?:\.\d{1,2})?)/i, // received ₹200
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseInt(match[1].replace(/,/g, ''), 10) * 100; // convert to paise
      if (amount > 0 && amount < 1_00_000_000) {
        return amount;
      }
    }
  }

  // Fallback: find any standalone number that looks like an amount (100-99999999)
  const fallback = text.match(/(?<!\d)(\d{3,8})(?!\d)/);
  if (fallback) {
    const num = parseInt(fallback[1].replace(/,/g, ''), 10);
    if (num >= 100 && num <= 99999999) {
      return num * 100; // convert to paise
    }
  }

  return null;
}

// ---------------------------------------------------------------- merchants

/**
 * Extract a potential merchant name from text.
 * Looks for: "for X", "to X", "from X", "at X", or the last meaningful word.
 */
export function extractMerchant(text: string): string | null {
  const patterns = [
    /(?:for|to|at|from|via)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s.]{2,30})$/i,
    /(?:paid|debited|spent|sent)\s+(?:₹|Rs\.?\s*[\d,]+\s+)?(?:to|for)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s.]{2,30})/i,
    /(?:received|credited|got)\s+(?:₹|Rs\.?\s*[\d,]+\s+)?(?:from)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s.]{2,30})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim().replace(/[^a-zA-Z\u0900-\u097F\s.]/g, '');
      if (name.length >= 2) return name;
    }
  }

  // Fallback: find known merchant names in text
  const lower = text.toLowerCase();
  const knownMerchants = ['swiggy', 'zomato', 'uber', 'ola', 'amazon', 'flipkart', 'myntra', 'jio', 'airtel'];
  for (const m of knownMerchants) {
    if (lower.includes(m)) {
      return m.charAt(0).toUpperCase() + m.slice(1);
    }
  }

  return null;
}

// ---------------------------------------------------------------- members

/**
 * Extract a member name from text (for income: "from Rahul").
 */
export function extractMember(text: string, members: { id: string; name: string }[]): string | null {
  const fromMatch = text.match(/from\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s]{2,20})/i);
  if (fromMatch) {
    const name = fromMatch[1].trim();
    // Check if it matches a known member
    const match = members.find((m) => m.name.toLowerCase() === name.toLowerCase());
    return match?.id ?? null;
  }
  return null;
}

// ---------------------------------------------------------------- parsing

export interface ParsedTransaction {
  amountPaise: number | null;
  merchant: string | null;
  categoryId: string | null;
  categoryName: string | null;
  memberId: string | null;
  kind: 'EXPENSE' | 'INCOME';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  note: string | null;
}

/**
 * Parse a natural-language transaction description.
 */
export async function parseTransaction(text: string): Promise<ParsedTransaction> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Determine kind
  const isIncome = /\b(received|got|credited|income|salary|freelance|refund|gift|interest|commission)\b/i.test(lower);
  const kind: 'EXPENSE' | 'INCOME' = isIncome ? 'INCOME' : 'EXPENSE';

  // Extract amount
  const amountPaise = extractAmount(trimmed);

  // Extract merchant
  const merchant = extractMerchant(trimmed);

  // Extract member (for income)
  const members = await memberService.getAll();
  let memberId: string | null = null;
  if (isIncome) {
    memberId = extractMember(trimmed, members);
  }

  // Determine category from keywords
  const categoryMatch = findCategoryFromKeywords(trimmed);

  // Try to refine with merchant memory
  let categoryId = categoryMatch?.categoryId ?? null;
  let categoryName = categoryMatch?.name ?? null;
  let confidence = categoryMatch?.confidence ?? 'LOW';

  if (merchant && categoryId === null) {
    try {
      const suggestion = await classificationService.getSuggestion({ merchant });
      if (suggestion.suggestion?.categoryId) {
        categoryId = suggestion.suggestion.categoryId;
        categoryName = categoryMatch?.name ?? null;
        confidence = suggestion.suggestion.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM';
      }
    } catch {
      // merchant memory unavailable — use keyword match
    }
  }

  // Build a note from the original text if it's long
  const note = trimmed.length > 30 ? trimmed : null;

  return {
    amountPaise,
    merchant,
    categoryId,
    categoryName,
    memberId,
    kind,
    confidence,
    note,
  };
}

function findCategoryFromKeywords(text: string): CategoryMatch | null {
  const lower = text.toLowerCase();
  let bestMatch: CategoryMatch | null = null;
  let bestScore = 0;

  for (const [keyword, category] of Object.entries(NORMALISED_KEYWORDS)) {
    const normalisedText = lower.replace(/[^a-z]/g, '');
    const score = normalisedText.includes(keyword) ? keyword.length : 0;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { categoryId: null, name: category, confidence: score > 4 ? 'HIGH' : 'MEDIUM' };
    }
  }

  return bestMatch;
}

/**
 * Preprocess text for better parsing (normalise symbols, etc.)
 */
export function preprocessText(text: string): string {
  return text
    .replace(/₹/g, 'Rs ')
    .replace(/\u20B9/g, 'Rs ')
    .replace(/Rs\./g, 'Rs')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Quick hint generation for the UI — a short phrase showing what was detected.
 */
export function hintFromParsed(parsed: ParsedTransaction): string {
  const parts: string[] = [];
  if (parsed.amountPaise) parts.push(`₹${(parsed.amountPaise / 100).toLocaleString('en-IN')}`);
  if (parsed.merchant) parts.push(parsed.merchant);
  if (parsed.categoryName) parts.push(parsed.categoryName);
  if (parsed.kind === 'INCOME' && parsed.memberId) parts.push('from a contact');
  return parts.length > 0 ? parts.join(' · ') : 'Tap to fill details';
}
