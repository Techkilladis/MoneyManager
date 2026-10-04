/**
 * Classification Service
 * 
 * Deterministic suggestion logic for category and member based on merchant memory.
 * Priority: USER_EXPLICIT_CHOICE > USER_MERCHANT_MEMORY > SYSTEM_RULE > AI_SUGGESTION > NONE
 */

import { merchantRepository } from '../database/repositories/merchantRepository';
import { merchantMemoryRepository } from '../database/repositories/merchantMemoryRepository';
import { normalizeMerchantFull } from './merchantNormalization';
import { MerchantMemorySource, MerchantMemoryConfidence } from '../database/schema';

export interface ClassificationSuggestion {
  categoryId: string | null;
  memberId: string | null;
  confidence: MerchantMemoryConfidence;
  source: MerchantMemorySource;
  merchantId?: string;
  merchantName?: string;
}

export interface ClassificationInput {
  merchant: string;
  amountPaise?: number;
  categoryId?: string | null;
  memberId?: string | null;
  sourceEventId?: string;
}

export interface ClassificationResult {
  suggestion: ClassificationSuggestion | null;
  merchant: {
    id: string;
    canonicalName: string;
    normalizedKey: string;
  };
}

/**
 * Calculate confidence based on usage count and source
 */
function calculateConfidence(
  usageCount: number,
  source: MerchantMemorySource
): MerchantMemoryConfidence {
  // Base confidence from source
  let baseScore = 0;
  switch (source) {
    case 'USER_CONFIRMED':
      baseScore = 2; // Start at MEDIUM for user confirmed
      break;
    case 'SYSTEM_DEFAULT':
      baseScore = 1; // Start at LOW for system
      break;
    case 'AI_SUGGESTED':
      baseScore = 1; // Start at LOW for AI
      break;
  }
  
  // Boost by usage count
  if (usageCount >= 5) baseScore += 2;
  else if (usageCount >= 3) baseScore += 1;
  
  // Map to confidence levels
  if (baseScore >= 4) return 'HIGH';
  if (baseScore >= 2) return 'MEDIUM';
  return 'LOW';
}

/**
 * Get deterministic classification suggestion for a transaction
 * 
 * Priority order:
 * 1. USER_EXPLICIT_CHOICE (explicit categoryId/memberId passed in)
 * 2. USER_MERCHANT_MEMORY (user's historical choices for this merchant)
 * 3. SYSTEM_RULE (generic category rules - not implemented yet)
 * 4. AI_SUGGESTION (not implemented in Phase 5)
 * 5. NONE
 */
export async function getClassificationSuggestion(
  input: ClassificationInput
): Promise<ClassificationResult> {
  // Step 1: Normalize merchant
  const { normalizedKey, canonicalName } = normalizeMerchantFull(input.merchant);
  
  // Step 2: Get or create merchant entity
  const merchant = await merchantRepository.getOrCreateByNormalizedKey(
    normalizedKey,
    canonicalName
  );
  
  // Step 3: Check for explicit user choice (highest priority)
  if (input.categoryId || input.memberId) {
    return {
      suggestion: {
        categoryId: input.categoryId || null,
        memberId: input.memberId || null,
        confidence: 'HIGH',
        source: 'USER_CONFIRMED',
        merchantId: merchant.id,
        merchantName: merchant.canonicalName,
      },
      merchant: {
        id: merchant.id,
        canonicalName: merchant.canonicalName,
        normalizedKey: merchant.normalizedKey,
      },
    };
  }
  
  // Step 4: Get merchant memory suggestion (user's historical choices)
  const memorySuggestion = await merchantMemoryRepository.getBestSuggestion(merchant.id);
  
  if (memorySuggestion) {
    // Recalculate confidence based on actual usage
    const memories = await merchantMemoryRepository.getByMerchantId(merchant.id);
    const matchingMemory = memories.find(m => 
      m.categoryId === memorySuggestion.categoryId && 
      m.memberId === memorySuggestion.memberId
    );
    
    const confidence = matchingMemory 
      ? calculateConfidence(matchingMemory.usageCount, matchingMemory.source)
      : memorySuggestion.confidence;
    
    return {
      suggestion: {
        categoryId: memorySuggestion.categoryId,
        memberId: memorySuggestion.memberId,
        confidence,
        source: memorySuggestion.source,
        merchantId: merchant.id,
        merchantName: merchant.canonicalName,
      },
      merchant: {
        id: merchant.id,
        canonicalName: merchant.canonicalName,
        normalizedKey: merchant.normalizedKey,
      },
    };
  }
  
  // Step 5: No suggestion available
  return {
    suggestion: null,
    merchant: {
      id: merchant.id,
      canonicalName: merchant.canonicalName,
      normalizedKey: merchant.normalizedKey,
    },
  };
}

/**
 * Record a user's classification decision to update merchant memory
 * Called after user confirms a transaction in Quick Capture
 */
export async function recordClassification(
  merchantId: string,
  categoryId: string | null,
  memberId: string | null,
  source: MerchantMemorySource = 'USER_CONFIRMED'
): Promise<void> {
  // Calculate confidence based on existing memory
  const existingMemories = await merchantMemoryRepository.getByMerchantId(merchantId);
  const matchingMemory = existingMemories.find(m => 
    m.categoryId === categoryId && m.memberId === memberId
  );
  
  let confidence: MerchantMemoryConfidence = 'LOW';
  if (matchingMemory) {
    confidence = calculateConfidence(matchingMemory.usageCount + 1, source);
  } else if (source === 'USER_CONFIRMED') {
    confidence = 'MEDIUM'; // First user confirmation = MEDIUM
  }
  
  // Upsert the memory entry
  await merchantMemoryRepository.getOrCreate({
    merchantId,
    categoryId,
    memberId,
    source,
    confidence,
  });
}

/**
 * Record an explicit user correction (when user changes a suggestion)
 * This has higher priority than historical memory
 */
export async function recordCorrection(
  merchantId: string,
  oldCategoryId: string | null,
  oldMemberId: string | null,
  newCategoryId: string | null,
  newMemberId: string | null
): Promise<void> {
  // Record the new choice with USER_CONFIRMED source (highest priority)
  await recordClassification(merchantId, newCategoryId, newMemberId, 'USER_CONFIRMED');
  
  // Optionally: reduce confidence of old suggestion
  // We don't delete it because history matters for trend detection
  // But we could mark it as superseded
}

/**
 * Get memory stats for debugging/display
 */
export async function getMerchantMemoryStats(merchantId: string) {
  return merchantMemoryRepository.getStats(merchantId);
}

/**
 * Check if a suggestion should be prefilled based on confidence
 * 
 * Policy:
 * - HIGH: prefill normally, still editable
 * - MEDIUM: prefill but visually mark as suggestion
 * - LOW: do not prefill automatically
 */
export function shouldPrefill(confidence: MerchantMemoryConfidence): boolean {
  return confidence === 'HIGH' || confidence === 'MEDIUM';
}

/**
 * Get prefill mode for UI rendering
 */
export function getPrefillMode(confidence: MerchantMemoryConfidence): 'none' | 'suggestion' | 'confident' {
  switch (confidence) {
    case 'HIGH':
      return 'confident';
    case 'MEDIUM':
      return 'suggestion';
    case 'LOW':
    default:
      return 'none';
  }
}