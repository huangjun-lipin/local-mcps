// API-based multimodal image captioner using OpenAI-compatible vision APIs.
//
// Sends images as base64 data URLs to a configurable multimodal LLM endpoint
// and returns descriptive text for retrieval search indexing.
//
// Supported API formats:
//   - OpenAI (gpt-4o, gpt-4-vision-preview)
//   - Anthropic-compatible (claude-3-opus, etc.) via OpenAI-compatible proxy
//   - Any OpenAI-compatible endpoint (vLLM, Ollama, etc.)

import {
  type CaptionResult,
  type ContentElement,
  type MultimodalConfig,
  MultimodalError,
} from './types.js';

/**
 * Prompt tuned for retrieval search indexing — asks the VLM to describe
 * the image content for embedding and semantic search purposes.
 */
const CAPTION_PROMPT =
  'Describe this image for document retrieval and search indexing. ' +
  'Identify visible text, labels, titles, diagrams, charts, tables, ' +
  'and key visual elements. Use short searchable phrases. ' +
  'Include exact readable text from the image when visible. ' +
  'Output only the description — no preamble, no meta-commentary.';

/**
 * Generate captions for all images in a ContentElement list.
 *
 * Text elements pass through unchanged; image elements are sent to the
 * multimodal LLM for description.
 *
 * @param elements - Ordered content elements from extractContentElements
 * @param config  - Multimodal LLM API configuration
 * @returns CaptionResult[] mapping image names to captions
 */
export async function captionImages(
  elements: ContentElement[],
  config: MultimodalConfig,
): Promise<CaptionResult[]> {
  const imageElements = elements.filter(
    (el): el is ContentElement & { type: 'image' } => el.type === 'image',
  );

  if (imageElements.length === 0) return [];

  const concurrency = config.concurrency ?? 3;
  const results: CaptionResult[] = [];

  // Process in batches with concurrency limit
  for (let i = 0; i < imageElements.length; i += concurrency) {
    const batch = imageElements.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((img) => captionSingleImage(img, config)),
    );
    results.push(...batchResults);
  }

  return results;
}

async function captionSingleImage(
  img: ContentElement & { type: 'image' },
  config: MultimodalConfig,
): Promise<CaptionResult> {
  try {
    // Convert image data to base64 data URL
    const base64 = bufferToBase64(img.data);
    const dataUrl = `data:${img.mimeType};base64,${base64}`;

    // Build OpenAI-compatible request
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: CAPTION_PROMPT },
        ],
      },
    ];

    const response = await fetch(config.apiBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.apiModel,
        messages,
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new MultimodalError(
        `VLM API request failed: ${response.status} ${response.statusText} - ${errorText.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      content?: Array<{ text?: string }>;
    };

    // OpenAI format: choices[0].message.content
    let caption = payload.choices?.[0]?.message?.content;

    // Anthropic format (via proxy): content[0].text
    if (!caption && payload.content) {
      const first = payload.content[0];
      if (first?.text) {
        caption = first.text;
      }
    }

    if (!caption || !caption.trim()) {
      throw new MultimodalError(`Empty caption response for image: ${img.name}`);
    }

    return { imageName: img.name, caption: caption.trim() };
  } catch (error) {
    if (error instanceof MultimodalError) throw error;
    throw new MultimodalError(
      `Failed to caption image "${img.name}": ${(error as Error).message}`,
      error as Error,
    );
  }
}

/**
 * Convert Uint8Array to base64 string (browser-compatible, no Buffer dependency).
 */
function bufferToBase64(data: Uint8Array): string {
  // Use Node.js Buffer for efficiency
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data).toString('base64');
  }
  // Fallback: manual base64 encoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i] ?? 0;
    const b2 = data[i + 1] ?? 0;
    const b3 = data[i + 2] ?? 0;
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < data.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < data.length ? chars[b3 & 63] : '=';
  }
  return result;
}
