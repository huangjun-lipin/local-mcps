// Embedder implementation with Transformers.js or remote embedding API

import { type DeviceType, env, pipeline } from '@huggingface/transformers';

// ============================================
// Type Definitions
// ============================================

/**
 * Embedder configuration
 */
export interface EmbedderConfig {
  /** HuggingFace model path */
  modelPath: string;
  /** Embedding backend type */
  provider?: 'local' | 'api';
  /** Batch size */
  batchSize: number;
  /** Model cache directory */
  cacheDir: string;
  /** Device type */
  device?: string;
  /** Embedding API base URL (e.g. https://api.openai.com/v1/embeddings) */
  apiBaseUrl?: string;
  /** Embedding API key */
  apiKey?: string;
  /** Embedding API model name */
  apiModel?: string;
  /** Custom headers for embedding API (e.g. {"X-API-Key": "..."}) */
  apiHeaders?: Record<string, string>;
  /** Embedding path to extract from response (default: "data[].embedding") */
  apiResponsePath?: string;
}

interface EmbeddingApiResponse {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
}

// ============================================
// Error Classes
// ============================================

/**
 * Embedding generation error
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

// ============================================
// Embedder Class
// ============================================

/**
 * Embedding generation class using Transformers.js
 *
 * Responsibilities:
 * - Generate embedding vectors (dimension depends on model)
 * - Transformers.js wrapper
 * - Batch processing (size 8)
 */
export class Embedder {
  // Using unknown to avoid TS2590 (union type too complex with @types/jsdom)
  private model: unknown = null;
  private initPromise: Promise<void> | null = null;
  private readonly config: EmbedderConfig;

  constructor(config: EmbedderConfig) {
    this.config = config;
  }

  /**
   * Release resources held by the Embedder pipeline
   */
  async dispose(): Promise<void> {
    const model = this.model as { dispose?: () => Promise<void> } | null;
    if (model && typeof model.dispose === 'function') {
      try {
        await model.dispose();
      } catch (error) {
        console.error('Error disposing embedder model:', error);
      }
    }
    this.model = null;
    this.initPromise = null;
  }

  /**
   * Initialize Transformers.js model
   */
  async initialize(): Promise<void> {
    // Skip if already initialized
    if (this.model) {
      return;
    }

    if (this.config.provider === 'api') {
      this.validateApiConfig();
      console.error(
        `Embedder: Using remote embedding API "${this.config.apiBaseUrl}" with model "${this.config.apiModel}"`,
      );
      this.model = { provider: 'api' };
      return;
    }

    // Set cache directory BEFORE creating pipeline
    env.cacheDir = this.config.cacheDir;

    // No fallback — if the requested device fails, init throws.
    const device = this.config.device || 'cpu';

    console.error(`Embedder: Setting cache directory to "${this.config.cacheDir}"`);
    console.error(`Embedder: Loading model "${this.config.modelPath}" on device "${device}"...`);

    try {
      this.model = await pipeline('feature-extraction', this.config.modelPath, {
        dtype: 'fp32',
        device: device as DeviceType,
      });
      console.error(`Embedder: Model loaded successfully (device=${device})`);
    } catch (error) {
      // Don't prepend "device=X" — the prior stderr line already says which
      // device was attempted, and transformers.js' own errors typically
      // include the device name. Just re-type the error.
      throw new EmbeddingError((error as Error).message, error as Error);
    }
  }

  private validateApiConfig(): void {
    if (!this.config.apiBaseUrl) {
      throw new EmbeddingError(
        'EMBEDDING_API_BASE_URL is required when EMBEDDING_PROVIDER=api',
      );
    }
    if (!this.config.apiKey) {
      throw new EmbeddingError(
        'EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER=api',
      );
    }
    if (!this.config.apiModel) {
      throw new EmbeddingError(
        'EMBEDDING_API_MODEL is required when EMBEDDING_PROVIDER=api',
      );
    }
  }

  private async embedViaApi(texts: string[]): Promise<number[][]> {
    this.validateApiConfig();

    // Build headers: default Authorization + custom headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // If custom headers provided, use them; otherwise default Bearer auth
    if (this.config.apiHeaders && Object.keys(this.config.apiHeaders).length > 0) {
      Object.assign(headers, this.config.apiHeaders);
    } else {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(this.config.apiBaseUrl as string, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.apiModel,
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new EmbeddingError(
        `Embedding API request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;

    // Try standard OpenAI format first (data[].embedding), then custom path
    const dataArray = (
      this.config.apiResponsePath
        ? this.resolveJsonPath(payload, this.config.apiResponsePath)
        : (payload as EmbeddingApiResponse).data
    ) as Array<{ embedding?: number[]; index?: number }> | undefined;

    if (!dataArray || !Array.isArray(dataArray) || dataArray.length !== texts.length) {
      throw new EmbeddingError(
        `Embedding API returned invalid data shape. Expected array of length ${texts.length}, got ${JSON.stringify(Object.keys(payload))}`,
      );
    }

    const ordered = [...dataArray].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    const embeddings = ordered.map((item) => {
      // Support both "embedding" and "vector" key names
      return item.embedding ?? (item as Record<string, unknown>)['vector'] as number[] | undefined;
    });
    if (embeddings.some((item) => !Array.isArray(item) || item.length === 0)) {
      throw new EmbeddingError('Embedding API returned empty embedding vector');
    }

    return embeddings as number[][];
  }

  /**
   * Resolve a dot-separated JSON path (e.g. "data.embedding" → payload.data.embedding)
   */
  private resolveJsonPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Ensure model is initialized (lazy initialization)
   * This method is called automatically by embed() and embedBatch()
   */
  private async ensureInitialized(): Promise<void> {
    // Already initialized
    if (this.model) {
      return;
    }

    // Initialization already in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    console.error(
      'Embedder: First use detected. Initializing model (downloading ~90MB, may take 1-2 minutes)...',
    );

    this.initPromise = this.initialize().catch((error) => {
      // Clear initPromise on failure to allow retry on the next call.
      this.initPromise = null;
      throw error;
    });

    await this.initPromise;
  }

  /**
   * Convert single text to embedding vector
   *
   * @param text - Text
   * @returns Embedding vector (dimension depends on model)
   */
  async embed(text: string): Promise<number[]> {
    // Reject empty input before paying for model init.
    if (text.length === 0) {
      throw new EmbeddingError('Cannot generate embedding for empty text');
    }

    // Lazy initialization: initialize on first use if not already initialized
    await this.ensureInitialized();

    try {
      if (this.config.provider === 'api') {
        const [embedding] = await this.embedViaApi([text]);
        return embedding;
      }

      const options = { pooling: 'mean', normalize: true };
      const modelCall = this.model as (
        text: string,
        options: unknown,
      ) => Promise<{ data: Float32Array }>;
      const output = await modelCall(text, options);

      // Access raw data via .data property
      const embedding = Array.from(output.data);
      return embedding;
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(
        `Failed to generate embedding: ${(error as Error).message}`,
        error as Error,
      );
    }
  }

  /**
   * Convert multiple texts to embedding vectors with batch processing
   *
   * @param texts - Array of texts
   * @returns Array of embedding vectors (dimension depends on model)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Nothing to embed → skip model init entirely.
    if (texts.length === 0) {
      return [];
    }

    // Validate empty texts BEFORE initializing the model (fail-fast).
    if (texts.some((text) => text.length === 0)) {
      throw new EmbeddingError('Cannot generate embedding for empty text');
    }

    // Lazy initialization: initialize on first use if not already initialized
    await this.ensureInitialized();

    try {

      if (this.config.provider === 'api') {
        const embeddings: number[][] = [];
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
          const batch = texts.slice(i, i + this.config.batchSize);
          const batchEmbeddings = await this.embedViaApi(batch);
          embeddings.push(...batchEmbeddings);
        }
        return embeddings;
      }

      const embeddings: number[][] = [];

      // Process in batches according to batch size
      for (let i = 0; i < texts.length; i += this.config.batchSize) {
        const batch = texts.slice(i, i + this.config.batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map((text) => this.embed(text)),
        );
        embeddings.push(...batchEmbeddings);
      }

      return embeddings;
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error;
      }
      throw new EmbeddingError(
        `Failed to generate batch embeddings: ${(error as Error).message}`,
        error as Error,
      );
    }
  }
}