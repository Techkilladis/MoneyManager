/**
 * Local AI Classification Provider Abstraction
 * 
 * Clean interface for on-device AI classification.
 * The application depends only on this abstraction, not on specific models.
 */

import { MerchantMemorySource, MerchantMemoryConfidence } from '../database/schema';

/**
 * Structured input for AI classification
 * Minimal context required for the task
 */
export interface AIClassificationInput {
  /** Raw merchant name from notification */
  merchantName: string;
  /** Normalized merchant key */
  normalizedMerchant: string;
  /** Canonical display name */
  canonicalMerchant: string;
  /** Transaction amount in paise */
  amountPaise?: number;
  /** Source UPI app (Google Pay, PhonePe, etc.) */
  sourceApp?: string;
  /** Transaction timestamp */
  transactionTime?: number;
  /** Available category IDs and names for constrained output */
  availableCategories: Array<{ id: string; name: string }>;
  /** Available member IDs and names for constrained output */
  availableMembers: Array<{ id: string; name: string }>;
  /** Relevant merchant memory for context */
  relevantMemory?: Array<{
    categoryId: string | null;
    categoryName: string | null;
    memberId: string | null;
    memberName: string | null;
    source: MerchantMemorySource;
    confidence: MerchantMemoryConfidence;
    usageCount: number;
  }>;
  /** Recent user-confirmed patterns (anonymized) */
  recentPatterns?: Array<{
    merchant: string;
    categoryName: string;
    memberName: string;
  }>;
}

/**
 * Structured output from AI classification
 * Must be validated against local database
 */
export interface AIClassificationOutput {
  /** Category ID - MUST match availableCategories */
  categoryId: string | null;
  /** Member ID - MUST match availableMembers */
  memberId: string | null;
  /** Confidence level */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Optional reasoning (for debugging/provenance) */
  reasoning?: string;
}

/**
 * Validated AI suggestion ready for use
 */
export interface ValidatedAISuggestion {
  categoryId: string | null;
  memberId: string | null;
  confidence: MerchantMemoryConfidence;
  source: 'AI_SUGGESTED';
  reasoning?: string;
  modelInfo?: {
    modelId: string;
    modelVersion: string;
    generatedAt: number;
  };
}

/**
 * AI Provider interface - all implementations must satisfy this
 */
export interface LocalAIProvider {
  /** Unique identifier for this provider */
  readonly providerId: string;
  /** Human-readable name */
  readonly displayName: string;
  /** Model identifier/version for provenance */
  readonly modelId: string;
  readonly modelVersion: string;
  
  /** Initialize the provider (load model, warm up, etc.) */
  initialize(): Promise<{ success: boolean; error?: string }>;
  
  /** Check if provider is ready for inference */
  isReady(): boolean;
  
  /** Get current provider status */
  getStatus(): 'uninitialized' | 'initializing' | 'ready' | 'error' | 'unavailable';
  
  /** Run classification inference */
  classify(input: AIClassificationInput): Promise<AIClassificationOutput | null>;
  
  /** Clean up resources (unload model) */
  dispose(): Promise<void>;
}

/**
 * Classification Provider Registry
 * Manages available providers
 */
export class ClassificationProviderRegistry {
  private providers: Map<string, LocalAIProvider> = new Map();
  private activeProviderId: string | null = null;

  register(provider: LocalAIProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  get(providerId: string): LocalAIProvider | undefined {
    return this.providers.get(providerId);
  }

  getActive(): LocalAIProvider | undefined {
    if (!this.activeProviderId) return undefined;
    return this.providers.get(this.activeProviderId) || undefined;
  }

  setActive(providerId: string): boolean {
    if (this.providers.has(providerId)) {
      this.activeProviderId = providerId;
      return true;
    }
    return false;
  }

  list(): Array<{ providerId: string; displayName: string; status: string }> {
    return Array.from(this.providers.values()).map(p => ({
      providerId: p.providerId,
      displayName: p.displayName,
      status: p.getStatus(),
    }));
  }

  async initializeAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.initialize();
      } catch (error) {
        console.warn(`[ProviderRegistry] Failed to initialize ${provider.providerId}:`, error);
      }
    }
  }

  async disposeAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.dispose();
      } catch (error) {
        console.warn(`[ProviderRegistry] Failed to dispose ${provider.providerId}:`, error);
      }
    }
  }
}

// Global registry instance
export const providerRegistry = new ClassificationProviderRegistry();