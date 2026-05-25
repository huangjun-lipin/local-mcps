// Shared types for the multimodal document processing pipeline

/**
 * A single element in document content order — either a text block or an image.
 */
export type ContentElement =
  | { type: 'text'; content: string }
  | { type: 'image'; data: Uint8Array; name: string; mimeType: string };

/**
 * Configuration for the multimodal processing pipeline.
 */
export interface MultimodalConfig {
  /** VLM API base URL (OpenAI-compatible) */
  apiBaseUrl: string;
  /** VLM API key */
  apiKey: string;
  /** VLM model name */
  apiModel: string;
  /** Maximum number of images to process concurrently */
  concurrency?: number;
}

/**
 * Image extraction result from a document.
 */
export interface ExtractionResult {
  /** Ordered content elements (text + images in document order) */
  elements: ContentElement[];
  /** Document title (if extractable) */
  title?: string;
}

/**
 * Caption result for a single image.
 */
export interface CaptionResult {
  /** Original image name */
  imageName: string;
  /** Generated caption text */
  caption: string;
}

/**
 * Error thrown during multimodal processing.
 */
export class MultimodalError extends Error {
  constructor(
    message: string,
    public override readonly cause?: Error,
  ) {
    super(message);
    this.name = 'MultimodalError';
  }
}
