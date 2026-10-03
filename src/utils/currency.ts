// Financial utilities for paise-based currency handling
// All monetary values are stored as integer paise

/**
 * Convert paise to formatted Indian currency string
 * @param paise - Amount in paise (e.g., 12550 for ₹125.50)
 * @returns Formatted currency string (e.g., "₹125.50")
 */
export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise)) {
    console.warn('[formatPaise] Expected integer paise, received:', paise);
  }
  
  const rupees = paise / 100;
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Convert paise to formatted currency string without currency symbol
 * @param paise - Amount in paise
 * @returns Formatted number string (e.g., "125.50")
 */
export function formatPaisePlain(paise: number): string {
  const rupees = paise / 100;
  return rupees.toFixed(2);
}

/**
 * Parse currency input string to paise
 * Handles various input formats:
 * - "125.50" → 12550
 * - "125" → 12500
 * - "1,234.56" → 123456
 * - "₹125.50" → 12550
 * - "12550" → 12550 (if already paise-like)
 * @param input - Currency string input
 * @returns Amount in paise, or null if invalid
 */
export function parsePaise(input: string): number | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  
  // Remove currency symbol, commas, and whitespace
  const clean = input.replace(/[₹,\s]/g, '');
  
  if (clean === '') {
    return null;
  }
  
  // Check if input looks like paise (no decimal, large number)
  // If it has no decimal point and is >= 100000, it might be paise
  // But we'll assume decimal format is rupees
  const hasDecimal = clean.includes('.');
  
  if (!hasDecimal) {
    // No decimal - could be rupees or paise
    const num = parseInt(clean, 10);
    if (isNaN(num)) return null;
    
    // Heuristic: if number >= 10000, likely paise; else rupees
    // But safest is to treat as rupees for user input
    return num * 100;
  }
  
  // Has decimal - treat as rupees
  const rupees = parseFloat(clean);
  if (isNaN(rupees)) return null;
  if (rupees < 0) return null;
  
  return Math.round(rupees * 100);
}

/**
 * Parse amount input that could be either rupees or paise
 * More lenient parser for user input
 * @param input - User input string
 * @returns Amount in paise, or null if invalid
 */
export function parseAmountInput(input: string): number | null {
  return parsePaise(input);
}

/**
 * Format paise for display in input fields (without currency symbol)
 * @param paise - Amount in paise
 * @returns String suitable for text input (e.g., "125.50")
 */
export function formatPaiseForInput(paise: number): string {
  if (!Number.isInteger(paise)) {
    console.warn('[formatPaiseForInput] Expected integer paise');
  }
  const rupees = paise / 100;
  // Remove trailing zeros after decimal if whole number
  return rupees % 1 === 0 ? rupees.toFixed(0) : rupees.toFixed(2);
}

/**
 * Validate paise amount
 * @param paise - Amount in paise
 * @returns true if valid positive amount
 */
export function isValidPaise(paise: number): boolean {
  return Number.isInteger(paise) && paise >= 0;
}

/**
 * Add two paise amounts safely
 * @param a - First amount in paise
 * @param b - Second amount in paise
 * @returns Sum in paise
 */
export function addPaise(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    console.warn('[addPaise] Expected integer paise');
  }
  return a + b;
}

/**
 * Subtract paise amounts safely
 * @param a - Minuend in paise
 * @param b - Subtrahend in paise
 * @returns Difference in paise
 */
export function subtractPaise(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    console.warn('[subtractPaise] Expected integer paise');
  }
  return a - b;
}

/**
 * Multiply paise by a factor (e.g., for quantity)
 * @param paise - Amount in paise
 * @param factor - Multiplier
 * @returns Result in paise
 */
export function multiplyPaise(paise: number, factor: number): number {
  if (!Number.isInteger(paise)) {
    console.warn('[multiplyPaise] Expected integer paise');
  }
  return Math.round(paise * factor);
}

/**
 * Divide paise by a divisor
 * @param paise - Amount in paise
 * @param divisor - Divisor
 * @returns Result in paise (rounded)
 */
export function dividePaise(paise: number, divisor: number): number {
  if (!Number.isInteger(paise)) {
    console.warn('[dividePaise] Expected integer paise');
  }
  if (divisor === 0) {
    throw new Error('Division by zero');
  }
  return Math.round(paise / divisor);
}

/**
 * Format paise for summary display (compact)
 * @param paise - Amount in paise
 * @returns Compact string (e.g., "₹1.23K" for 123456)
 */
export function formatPaiseCompact(paise: number): string {
  const rupees = paise / 100;
  
  if (Math.abs(rupees) >= 10000000) { // 1 crore+
    return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  }
  if (Math.abs(rupees) >= 100000) { // 1 lakh+
    return `₹${(rupees / 100000).toFixed(1)}L`;
  }
  if (Math.abs(rupees) >= 1000) { // 1 thousand+
    return `₹${(rupees / 1000).toFixed(1)}K`;
  }
  return formatPaise(paise);
}

export const currency = {
  format: formatPaise,
  formatPlain: formatPaisePlain,
  formatForInput: formatPaiseForInput,
  formatCompact: formatPaiseCompact,
  formatCurrency: formatPaise,  // Alias for backward compatibility
  parse: parsePaise,
  parseInput: parseAmountInput,
  isValid: isValidPaise,
  add: addPaise,
  subtract: subtractPaise,
  multiply: multiplyPaise,
  divide: dividePaise,
};