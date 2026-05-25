// Interleaver — combines text and image descriptions in document order.
//
// Walks the ContentElement[] list and produces a single plain-text document
// where image elements are replaced by their VLM-generated descriptions,
// wrapped in a marker format suitable for embedding and search retrieval.

import { type CaptionResult, type ContentElement } from './types.js';

/**
 * Interleave text and image captions in original document order.
 *
 * Text elements pass through directly. Image elements are replaced with
 * a `[Image: <caption>]` marker. The resulting text is suitable for the
 * existing chunking + embedding pipeline.
 *
 * @param elements - Ordered content elements from the document
 * @param captions - Caption results from captionImages()
 * @returns Combined text with image descriptions interleaved in position
 */
export function interleave(elements: ContentElement[], captions: CaptionResult[]): string {
  const captionMap = new Map(captions.map((c) => [c.imageName, c.caption]));

  const parts: string[] = [];
  let pendingText = '';

  for (const element of elements) {
    if (element.type === 'text') {
      // Accumulate consecutive text elements
      if (pendingText) {
        pendingText += '\n\n' + element.content;
      } else {
        pendingText = element.content;
      }
    } else if (element.type === 'image') {
      // Flush pending text before image
      if (pendingText.trim()) {
        parts.push(pendingText.trim());
        pendingText = '';
      }

      // Look up caption
      const caption = captionMap.get(element.name);
      if (caption) {
        parts.push(`[Image: ${caption}]`);
      } else {
        // Image without caption — add a placeholder so downstream knows
        // there was an image at this position
        parts.push(`[Image: ${element.name} (no description available)]`);
      }
    }
  }

  // Flush remaining text
  if (pendingText.trim()) {
    parts.push(pendingText.trim());
  }

  return parts.join('\n\n');
}
