import { NativeModules, Platform } from 'react-native';
import { LocalAIProvider, AIClassificationInput, AIClassificationOutput } from '../../src/services/aiClassificationProvider';

const { MoneyManagerLocalAI } = NativeModules;

interface LocalAIModelInfo {
  modelId: string;
  modelVersion: string;
  modelPath: string;
  contextSize: number;
  parameterCount: string;
  quantization: string;
}

interface NativeClassificationOutput {
  categoryId: string | null;
  memberId: string | null;
  confidence: string;
  reasoning?: string;
}

interface NativeModuleInterface {
  initializeModel(modelPath: string, contextSize: number): Promise<{ success: boolean; error?: string }>;
  isModelReady(): Promise<boolean>;
  getModelInfo(): Promise<LocalAIModelInfo | null>;
  classify(input: {
    merchantName: string;
    normalizedMerchant: string;
    canonicalMerchant: string;
    amountPaise?: number;
    sourceApp?: string;
    transactionTime?: number;
    availableCategories: Array<{ id: string; name: string }>;
    availableMembers: Array<{ id: string; name: string }>;
    relevantMemory?: Array<{
      categoryId: string | null;
      categoryName: string | null;
      memberId: string | null;
      memberName: string | null;
      source: string;
      confidence: string;
      usageCount: number;
    }>;
    recentPatterns?: Array<{
      merchant: string;
      categoryName: string;
      memberName: string;
    }>;
  }): Promise<NativeClassificationOutput | null>;
  disposeModel(): Promise<void>;
}

class LocalAIProviderImpl implements LocalAIProvider {
  readonly providerId = 'llama-cpp-local-ai';
  readonly displayName = 'Llama.cpp Local AI';
  readonly modelId = 'Phi-3-mini-4k-instruct-q4';
  readonly modelVersion = '1.0.0';
  
  private status: 'uninitialized' | 'initializing' | 'ready' | 'error' | 'unavailable' = 'uninitialized';
  private initError: string | null = null;
  private modelLoaded = false;
  private modelPath = '';

  constructor() {
    if (Platform.OS !== 'android') {
      this.status = 'unavailable';
    }
  }

  async initialize(modelPath?: string): Promise<{ success: boolean; error?: string }> {
    if (Platform.OS !== 'android' || !MoneyManagerLocalAI) {
      this.status = 'unavailable';
      return { success: false, error: 'Native module not available on this platform' };
    }

    if (this.status === 'ready') {
      return { success: true };
    }

    if (this.status === 'initializing') {
      return { success: false, error: 'Already initializing' };
    }

    this.status = 'initializing';
    this.initError = null;

    try {
      const path = modelPath || 'models/phi-3-mini-4k-instruct-q4.gguf';
      this.modelPath = path;
      
      const result = await MoneyManagerLocalAI.initializeModel(path, 4096);
      
      if (result.success) {
        this.status = 'ready';
        this.modelLoaded = true;
        return { success: true };
      } else {
        this.status = 'error';
        this.initError = result.error || 'Model initialization failed';
        return { success: false, error: this.initError ?? undefined };
      }
    } catch (error) {
      this.status = 'error';
      this.initError = error instanceof Error ? error.message : 'Unknown initialization error';
      console.error('[LocalAIProvider] Initialization failed:', error);
      return { success: false, error: this.initError ?? undefined };
    }
  }

  isReady(): boolean {
    return this.status === 'ready' && this.modelLoaded;
  }

  getStatus(): 'uninitialized' | 'initializing' | 'ready' | 'error' | 'unavailable' {
    return this.status;
  }

  async classify(input: AIClassificationInput): Promise<AIClassificationOutput | null> {
    if (!this.isReady() || Platform.OS !== 'android' || !MoneyManagerLocalAI) {
      return null;
    }

    try {
      const nativeInput = {
        merchantName: input.merchantName,
        normalizedMerchant: input.normalizedMerchant,
        canonicalMerchant: input.canonicalMerchant,
        amountPaise: input.amountPaise,
        sourceApp: input.sourceApp,
        transactionTime: input.transactionTime,
        availableCategories: input.availableCategories,
        availableMembers: input.availableMembers,
        relevantMemory: input.relevantMemory,
        recentPatterns: input.recentPatterns,
      };

      const result = await MoneyManagerLocalAI.classify(nativeInput);
      
      if (!result) {
        return null;
      }

      const confidence = ['HIGH', 'MEDIUM', 'LOW'].includes(result.confidence) 
        ? result.confidence as 'HIGH' | 'MEDIUM' | 'LOW'
        : 'LOW';

      return {
        categoryId: result.categoryId,
        memberId: result.memberId,
        confidence,
        reasoning: result.reasoning,
      };
    } catch (error) {
      console.error('[LocalAIProvider] Classification failed:', error);
      return null;
    }
  }

  async dispose(): Promise<void> {
    if (this.modelLoaded && MoneyManagerLocalAI) {
      try {
        await MoneyManagerLocalAI.disposeModel();
      } catch (error) {
        console.warn('[LocalAIProvider] Dispose error:', error);
      }
    }
    this.status = 'uninitialized';
    this.modelLoaded = false;
  }
}

export const localAIProvider = new LocalAIProviderImpl();
export { LocalAIProviderImpl };