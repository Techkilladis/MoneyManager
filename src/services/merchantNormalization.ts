/**
 * Merchant Normalization Service
 * 
 * Deterministic normalization of merchant names from UPI notifications.
 * Preserves display-friendly canonical names while creating stable normalized keys.
 */

// Suffixes to remove for normalization (careful - only remove payment-specific ones)
const PAYMENT_SUFFIXES = [
  ' payments',
  ' payment',
  ' pay',
  ' private limited',
  ' pvt ltd',
  ' pvt. ltd.',
  ' pvt ltd.',
  ' ltd',
  ' ltd.',
  ' limited',
  ' inc',
  ' inc.',
  ' corp',
  ' corp.',
  ' india',
  ' in',
];

// Suffixes that indicate the actual merchant name (don't remove these)
const PRESERVED_SUFFIXES = [
  ' online',
  ' digital',
  ' app',
  ' store',
  ' shop',
  ' mart',
  ' bazaar',
  ' market',
  ' express',
  ' delivery',
  ' services',
  ' service',
  ' solutions',
  ' technologies',
  ' tech',
  ' systems',
  ' enterprises',
  ' enterprise',
  ' group',
  ' industries',
  ' industry',
  ' foods',
  ' food',
  ' restaurant',
  ' cafe',
  ' kitchen',
  ' bakery',
  ' sweets',
  ' pharmacy',
  ' medical',
  ' hospital',
  ' clinic',
  ' diagnostics',
  ' labs',
  ' lab',
];

/**
 * Normalize a merchant name for comparison/lookup
 * Returns a stable key for matching merchant identities
 */
export function normalizeMerchant(rawMerchant: string): string {
  if (!rawMerchant || typeof rawMerchant !== 'string') {
    return '';
  }

  let normalized = rawMerchant.toLowerCase().trim();
  
  // Normalize whitespace: replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Remove common payment reference patterns that appear in UPI notifications
  // These are patterns like "*1234" or "ref 12345" at the end
  normalized = normalized.replace(/\s*\*?\d{4,}$/, ''); // Remove trailing *1234 or 12345
  normalized = normalized.replace(/\s*ref\.?\s*\w+$/i, ''); // Remove "ref ABC123" at end
  normalized = normalized.replace(/\s*txn\.?\s*\w+$/i, ''); // Remove "txn ABC123" at end
  normalized = normalized.replace(/\s*utr\.?\s*\w+$/i, ''); // Remove "utr ABC123" at end
  
  // Remove common UPI notification suffixes (but be conservative)
  for (const suffix of PAYMENT_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      // Check if the remaining part is meaningful (not just 1-2 chars)
      const remaining = normalized.slice(0, -suffix.length).trim();
      if (remaining.length > 2) {
        normalized = remaining;
        break; // Only remove one suffix to avoid over-aggressive stripping
      }
    }
  }
  
  // Final trim
  normalized = normalized.trim();
  
  return normalized;
}

/**
 * Get a display-friendly canonical name from a raw merchant string
 * Attempts to format it nicely while preserving recognizable brand names
 */
export function canonicalizeMerchant(rawMerchant: string): string {
  if (!rawMerchant || typeof rawMerchant !== 'string') {
    return 'Unknown Merchant';
  }

  let canonical = rawMerchant.trim();
  
  // Normalize whitespace
  canonical = canonical.replace(/\s+/g, ' ');
  
  // Remove payment reference patterns
  canonical = canonical.replace(/\s*\*?\d{4,}$/, '');
  canonical = canonical.replace(/\s*ref\.?\s*\w+$/i, '');
  canonical = canonical.replace(/\s*txn\.?\s*\w+$/i, '');
  canonical = canonical.replace(/\s*utr\.?\s*\w+$/i, '');
  
  // Title case for display (but preserve known brands that are all caps)
  const knownAllCaps = ['UPI', 'BHIM', 'NPCI', 'SBI', 'HDFC', 'ICICI', 'AXIS', 'KOTAK', 'YES', 'IDFC', 'RBL', 'PNB', 'BOB', 'CANB', 'UNION', 'INDIAN', 'CENTRAL', 'BANK', 'PAY', 'GP', 'PP', 'PTM'];
  
  const words = canonical.split(' ');
  const titleCased = words.map(word => {
    const upper = word.toUpperCase();
    if (knownAllCaps.includes(upper)) {
      return upper;
    }
    // Handle camelCase brands like "PhonePe", "Paytm", "GooglePay"
    if (/^[a-z]+[A-Z][a-z]+/.test(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  canonical = titleCased.join(' ');
  
  // Clean up any trailing punctuation
  canonical = canonical.replace(/[.,;:]+$/, '');
  
  // If empty after cleaning, return fallback
  if (!canonical) {
    return 'Unknown Merchant';
  }
  
  return canonical;
}

/**
 * Combined result of merchant normalization
 */
export interface NormalizedMerchant {
  normalizedKey: string;
  canonicalName: string;
}

/**
 * Normalize a raw merchant string into both normalized key and display name
 */
export function normalizeMerchantFull(rawMerchant: string): NormalizedMerchant {
  return {
    normalizedKey: normalizeMerchant(rawMerchant),
    canonicalName: canonicalizeMerchant(rawMerchant),
  };
}

/**
 * Check if two raw merchant strings likely refer to the same merchant
 */
export function merchantsMatch(merchant1: string, merchant2: string): boolean {
  const norm1 = normalizeMerchant(merchant1);
  const norm2 = normalizeMerchant(merchant2);
  return norm1 === norm2 && norm1 !== '';
}

export { PAYMENT_SUFFIXES, PRESERVED_SUFFIXES };
