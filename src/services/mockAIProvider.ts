/**
 * Mock Local AI Provider
 * 
 * Used for development/testing without actual model inference.
 * Contains deterministic rules for common Indian merchants.
 */

import { LocalAIProvider, AIClassificationInput, AIClassificationOutput } from './aiClassificationProvider';

/**
 * Deterministic mock rules for known merchants
 * This mimics what a real model would learn
 */
const MOCK_MERCHANT_RULES: Record<string, { category: string; member: string | null; confidence: 'HIGH' | 'MEDIUM' | 'LOW' }> = {
  // Food
  'swiggy': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'zomato': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'dominos': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'pizza hut': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'kfc': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'mcdonalds': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'subway': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'cafe coffee day': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'starbucks': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'barbeque nation': { category: 'Food', member: 'Self', confidence: 'HIGH' },
  'restaurant': { category: 'Food', member: 'Self', confidence: 'MEDIUM' },
  'cafe': { category: 'Food', member: 'Self', confidence: 'MEDIUM' },
  'dhaba': { category: 'Food', member: 'Self', confidence: 'MEDIUM' },
  'mess': { category: 'Food', member: 'Self', confidence: 'MEDIUM' },
  'canteen': { category: 'Food', member: 'Self', confidence: 'MEDIUM' },
  
  // Travel
  'uber': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'ola': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'rapido': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'metro': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'bus': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'train': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'irctc': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'flight': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'indigo': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'spicejet': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'air india': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'makemytrip': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'goibibo': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'ixigo': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'fuel': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'petrol': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'diesel': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'cng': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  'ev charging': { category: 'Travel', member: 'Self', confidence: 'HIGH' },
  
  // Shopping
  'amazon': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'flipkart': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'myntra': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'ajio': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'nykaa': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'meesho': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'snapdeal': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'shopping': { category: 'Shopping', member: 'Self', confidence: 'MEDIUM' },
  'mall': { category: 'Shopping', member: 'Self', confidence: 'MEDIUM' },
  'store': { category: 'Shopping', member: 'Self', confidence: 'MEDIUM' },
  'market': { category: 'Shopping', member: 'Self', confidence: 'MEDIUM' },
  'mart': { category: 'Shopping', member: 'Self', confidence: 'MEDIUM' },
  'big bazaar': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'reliance': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'dmart': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'croma': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  'vijay sales': { category: 'Shopping', member: 'Self', confidence: 'HIGH' },
  
  // Bills
  'electricity': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'power': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'water': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'gas': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'broadband': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'wifi': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'internet': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'mobile recharge': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'recharge': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'postpaid': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'prepaid': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'airtel': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'jio': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'vi': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'bsnl': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'landline': { category: 'Bills', member: 'Self', confidence: 'HIGH' },
  'bill': { category: 'Bills', member: 'Self', confidence: 'MEDIUM' },
  
  // Entertainment
  'netflix': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'hotstar': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'prime video': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'sony liv': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'zee5': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'voot': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'bookmyshow': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'paytm movies': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'pvr': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'inox': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'cinepolis': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'spotify': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'gaana': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'wynk': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'youtube premium': { category: 'Entertainment', member: 'Self', confidence: 'HIGH' },
  'movie': { category: 'Entertainment', member: 'Self', confidence: 'MEDIUM' },
  'cinema': { category: 'Entertainment', member: 'Self', confidence: 'MEDIUM' },
  'streaming': { category: 'Entertainment', member: 'Self', confidence: 'MEDIUM' },
  
  // Health
  'apollo': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'pharmacy': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'medicine': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'hospital': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'clinic': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'diagnostic': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'lab': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'doctor': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'medical': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'health': { category: 'Health', member: 'Self', confidence: 'MEDIUM' },
  'pharmeasy': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  '1mg': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'netmeds': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  'medplus': { category: 'Health', member: 'Self', confidence: 'HIGH' },
  
  // Education
  'college': { category: 'Education', member: 'Self', confidence: 'HIGH' },
  'university': { category: 'Education', member: 'Self', confidence: 'HIGH' },
  'school': { category: 'Education', member: 'Self', confidence: 'HIGH' },
  'course': { category: 'Education', member: 'Self', confidence: 'HIGH' },
  'udemy': { category: 'Education', member: 'Self', confidence: 'HIGH' },
  'coursera': { category: 'Education', member: 'Self', confidence: 'HIGH' },
  'edx': { category: 'Education', member: 'Self', confidence: 'HIGH' },
  'education': { category: 'Education', member: 'Self', confidence: 'MEDIUM' },
  'fee': { category: 'Education', member: 'Self', confidence: 'MEDIUM' },
  'tuition': { category: 'Education', member: 'Self', confidence: 'MEDIUM' },
  
  // Subscriptions
  'subscription': { category: 'Subscriptions', member: 'Self', confidence: 'HIGH' },
  'monthly': { category: 'Subscriptions', member: 'Self', confidence: 'MEDIUM' },
  'yearly': { category: 'Subscriptions', member: 'Self', confidence: 'MEDIUM' },
  'recurring': { category: 'Subscriptions', member: 'Self', confidence: 'MEDIUM' },
  'membership': { category: 'Subscriptions', member: 'Self', confidence: 'MEDIUM' },
  
  // Family
  'family': { category: 'Family', member: 'Self', confidence: 'MEDIUM' },
  'parents': { category: 'Family', member: 'Self', confidence: 'MEDIUM' },
  'mother': { category: 'Family', member: 'Mom', confidence: 'MEDIUM' },
  'father': { category: 'Family', member: 'Dad', confidence: 'MEDIUM' },
  'brother': { category: 'Family', member: 'Brother', confidence: 'MEDIUM' },
  'sister': { category: 'Family', member: 'Self', confidence: 'MEDIUM' },
  'wife': { category: 'Family', member: 'Self', confidence: 'MEDIUM' },
  'husband': { category: 'Family', member: 'Self', confidence: 'MEDIUM' },
};

/**
 * Find best matching rule for a normalized merchant name
 */
function findMatchingRule(normalizedMerchant: string): { category: string; member: string | null; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } | null {
  const normalized = normalizedMerchant.toLowerCase().trim();
  
  // Exact match
  if (MOCK_MERCHANT_RULES[normalized]) {
    return MOCK_MERCHANT_RULES[normalized];
  }
  
  // Partial match - check if any rule key is contained in the normalized merchant
  for (const [key, rule] of Object.entries(MOCK_MERCHANT_RULES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return rule;
    }
  }
  
  // Check individual words
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (word.length >= 3 && MOCK_MERCHANT_RULES[word]) {
      return MOCK_MERCHANT_RULES[word];
    }
  }
  
  return null;
}

/**
 * Mock Local AI Provider Implementation
 * Returns deterministic suggestions based on merchant name matching
 */
export class MockLocalAIProvider implements LocalAIProvider {
  readonly providerId = 'mock-local-ai';
  readonly displayName = 'Mock AI (Development)';
  readonly modelId = 'mock-deterministic-rules';
  readonly modelVersion = '1.0.0';
  
  private status: 'uninitialized' | 'initializing' | 'ready' | 'error' | 'unavailable' = 'uninitialized';
  private initError: string | null = null;

  async initialize(): Promise<{ success: boolean; error?: string }> {
    this.status = 'initializing';
    this.initError = null;
    
    // Simulate brief initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.status = 'ready';
    return { success: true };
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  getStatus(): 'uninitialized' | 'initializing' | 'ready' | 'error' | 'unavailable' {
    return this.status;
  }

  async classify(input: AIClassificationInput): Promise<AIClassificationOutput | null> {
    if (!this.isReady()) {
      return null;
    }

    // Simulate inference latency (10-50ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 10));

    // Look up mock rule
    const rule = findMatchingRule(input.normalizedMerchant);
    
    if (!rule) {
      return null;
    }

    // Validate category exists in available categories
    const validCategory = input.availableCategories.find(c => c.name === rule.category);
    if (!validCategory) {
      return null;
    }

    // Validate member exists in available members (or null)
    let validMember: { id: string; name: string } | null = null;
    if (rule.member) {
      validMember = input.availableMembers.find(m => m.name === rule.member) || null;
    }

    return {
      categoryId: validCategory.id,
      memberId: validMember?.id || null,
      confidence: rule.confidence,
      reasoning: `Mock rule matched: ${rule.category} (${rule.confidence})`,
    };
  }

  async dispose(): Promise<void> {
    this.status = 'uninitialized';
  }
}

// Export singleton instance
export const mockLocalAIProvider = new MockLocalAIProvider();