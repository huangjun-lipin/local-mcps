// Multimodal ingest pipeline — shared by CLI and MCP server dispatch sites.
//
// Calls the multimodal module (image extraction + API captioning + interleaving)
// and returns the standard chunks + embeddings for persistence by the caller.

import type { SemanticChunker, TextChunk } from '../chunker/index.js';
import type { EmbedderInterface } from '../chunker/semantic-chunker.js';
import type { MultimodalConfig } from '../multimodal/types.js';
import { processMultimodalDocument } from '../multimodal/index.js';
import { buildChunksAndEmbeddings } from './compute.js';

/**
 * Result of multimodal ingest computation.
 * Mirrors PrepareVisualPdfChunksResult from ingest/visual.ts so the dispatch
 * sites can treat both identically.
 */
export interface MultimodalIngestResult {
  chunks: TextChunk[];
  embeddings: number[][];
  title: string | null;
  /** The interleaved (text + image descriptions) plain-text content */
  text: string;
  /** Number of content elements extracted */
  elementCount: number;
  /** Number of images captioned */
  imageCount: number;
}

/**
 * Run the multimodal ingest flow:
 *   1. Extract text + images from document
 *   2. Caption images via VLM API
 *   3. Interleave captions with text
 *   4. Chunk + embed the resulting text
 *
 * @param filePath  - Absolute path to the document
 * @param vlmConfig - Multimodal LLM API configuration
 * @param chunker   - Semantic chunker instance
 * @param embedder  - Embedder instance
 * @param title     - Optional document title (may be derived from filename)
 */
export async function multimodalIngest(
  filePath: string,
  vlmConfig: MultimodalConfig,
  chunker: SemanticChunker,
  embedder: EmbedderInterface,
  title: string | null = null,
): Promise<MultimodalIngestResult> {
  // Steps 1-3: Extract, caption, interleave
  const { text, elementCount, imageCount } = await processMultimodalDocument(
    filePath,
    vlmConfig,
  );

  if (!text || text.trim().length === 0) {
    return {
      chunks: [],
      embeddings: [],
      title,
      text: '',
      elementCount,
      imageCount,
    };
  }

  // Step 4: Chunk + embed (reuses the existing pipeline)
  const { chunks, embeddings } = await buildChunksAndEmbeddings(
    text,
    title,
    chunker,
    embedder,
  );

  return { chunks, embeddings, title, text, elementCount, imageCount };
}
