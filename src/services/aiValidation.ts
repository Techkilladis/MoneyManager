/**
 * AI Output Validation Service
 * 
 * Strictly validates AI classification output against local database
 * before it can be used in Quick Capture.
 */

import { LocalAIProvider, AIClassificationInput, AIClassificationOutput, ValidatedAISuggestion } from './aiClassificationProvider';
import { categoryRepository } from '../database/repositories/categoryRepository';
import { memberRepository } from '../database/repositories/memberRepository';
import { providerRegistry } from './aiClassificationProvider';

/**
 * Validation result with detailed error information
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
}

/**
 * Validate AI classification output
 */
export async function validateAIOutput(
  input: AIClassificationInput,
  output: AIClassificationOutput
): Promise<ValidationResult<ValidatedAISuggestion>> {
  const errors: string[] = [];

  // 1. Validate confidence
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(output.confidence)) {
    errors.push(`Invalid confidence: ${output.confidence}`);
  }

  // 2. Validate categoryId against available categories
  let validatedCategoryId: string | null = null;
  if (output.categoryId !== null) {
    const category = await categoryRepository.getById(output.categoryId);
    if (!category) {
      errors.push(`Invalid categoryId: ${output.categoryId} - not found in database`);
    } else {
      validatedCategoryId = output.categoryId;
    }
  }

  // 3. Validate memberId against available members
  let validatedMemberId: string | null = null;
  if (output.memberId !== null) {
    const member = await memberRepository.getById(output.memberId);
    if (!member) {
      errors.push(`Invalid memberId: ${output.memberId} - not found in database`);
    } else {
      validatedMemberId = output.memberId;
    }
  }

  // 4. Cross-validate with input's available lists
  if (output.categoryId && !input.availableCategories.some(c => c.id === output.categoryId)) {
    errors.push(`CategoryId ${output.categoryId} not in available categories`);
  }
  if (output.memberId && !input.availableMembers.some(m => m.id === output.memberId)) {
    errors.push(`MemberId ${output.memberId} not in available members`);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  // 5. Build validated suggestion
  const suggestion: ValidatedAISuggestion = {
    categoryId: validatedCategoryId,
    memberId: validatedMemberId,
    confidence: output.confidence as 'HIGH' | 'MEDIUM' | 'LOW',
    source: 'AI_SUGGESTED',
    reasoning: output.reasoning,
  };

  return { success: true, data: suggestion, errors: [] };
}

/**
 * Run AI classification with full validation
 * Returns validated suggestion or null (never throws)
 */
export async function runValidatedAIClassification(
  provider: LocalAIProvider,
  input: AIClassificationInput
): Promise<ValidatedAISuggestion | null> {
  // Check provider readiness
  if (!provider.isReady()) {
    console.warn('[AIValidation] Provider not ready:', provider.providerId);
    return null;
  }

  try {
    // Run inference
    const rawOutput = await provider.classify(input);
    if (!rawOutput) {
      return null;
    }

    // Validate output
    const validation = await validateAIOutput(input, rawOutput);
    if (!validation.success) {
      console.warn('[AIValidation] AI output validation failed:', validation.errors);
      return null;
    }

    // Add model provenance
    if (validation.data) {
      validation.data.modelInfo = {
        modelId: provider.modelId,
        modelVersion: provider.modelVersion,
        generatedAt: Date.now(),
      };
      return validation.data;
    }

    return null;
  } catch (error) {
    console.error('[AIValidation] Classification error:', error);
    return null;
  }
}

/**
 * Get the active provider from registry, initialize if needed
 */
export async function getActiveProvider(): Promise<LocalAIProvider | null> {
  const provider = providerRegistry.getActive();
  
  if (!provider) {
    return null;
  }

  if (!provider.isReady()) {
    const result = await provider.initialize();
    if (!result.success) {
      console.warn('[AIValidation] Provider initialization failed:', result.error);
      return null;
    }
  }

  return provider;
}

/**
 * Main entry point: run AI classification with fallback to null
 * This is safe to call from Quick Capture - never throws, never blocks
 */
export async function classifyWithAI(
  input: AIClassificationInput
): Promise<ValidatedAISuggestion | null> {
  const provider = await getActiveProvider();
  if (!provider) {
    return null;
  }

  return runValidatedAIClassification(provider, input);
}