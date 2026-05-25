// Multimodal document processing pipeline.
//
// Entry point for the multimodal ingest path: extract images from documents
// (DOCX/PDF/XLSX/PPTX/image files), generate captions via a configurable
// multimodal LLM API, and interleave captions with text in original document
// order to produce a single plain-text document for chunking + embedding.
//
// Usage:
//   import { processMultimodalDocument } from '../multimodal/index.js';
//   const { text } = await processMultimodalDocument(filePath, vlmConfig);

import { captionImages } from './api-captioner.js';
import { extractContentElements } from './image-extractor.js';
import { interleave } from './interleaver.js';
import { type MultimodalConfig, MultimodalError } from './types.js';

export { extractContentElements } from './image-extractor.js';
export { captionImages } from './api-captioner.js';
export { interleave } from './interleaver.js';
export { MultimodalError } from './types.js';
export type { CaptionResult, ContentElement, ExtractionResult, MultimodalConfig } from './types.js';

/**
 * Process a document through the full multimodal pipeline:
 *   1. Extract text + images in document order
 *   2. Generate captions for all images via the configured VLM API
 *   3. Interleave captions with text in original order
 *
 * @param filePath - Absolute path to the document
 * @param config   - Multimodal LLM API configuration
 * @returns Combined text with image descriptions interleaved
 */
export async function processMultimodalDocument(
  filePath: string,
  config: MultimodalConfig,
): Promise<{ text: string; elementCount: number; imageCount: number }> {
  // Step 1: Extract content elements
  console.error(`Multimodal: Extracting content from ${filePath}...`);
  const { elements } = await extractContentElements(filePath);

  const imageElements = elements.filter((el) => el.type === 'image');
  console.error(
    `Multimodal: Found ${elements.length} elements (${imageElements.length} images)`,
  );

  // Step 2: Caption images (if any)
  let captions = [];
  if (imageElements.length > 0) {
    console.error(
      `Multimodal: Captioning ${imageElements.length} images via ${config.apiModel}...`,
    );
    captions = await captionImages(elements, config);
    console.error(`Multimodal: Generated ${captions.length} captions`);
  }

  // Step 3: Interleave text and captions
  const text = interleave(elements, captions);
  console.error(`Multimodal: Interleaved text length: ${text.length} characters`);

  return {
    text,
    elementCount: elements.length,
    imageCount: imageElements.length,
  };
}
