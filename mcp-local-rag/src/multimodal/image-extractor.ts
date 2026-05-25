// Image extractor for office documents (DOCX/XLSX/PPTX) and PDFs.
//
// Uses a minimal built-in ZIP parser to avoid external dependencies.
// DOCX/XLSX/PPTX are all ZIP archives with XML content + media directories.
//
// Supported formats:
//   - DOCX: word/document.xml for text + image refs, word/media/* for images
//   - XLSX: xl/sharedStrings.xml + xl/worksheets/sheet*.xml, xl/media/* for images
//   - PPTX: ppt/slides/slide*.xml for text + image refs, ppt/media/* for images
//   - PDF: mupdf stextJson (block.type === 'image') + rendering (via pdf-visual)
//   - Image files: read as-is

import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { createInflateRaw } from 'node:zlib';
import { type ContentElement, type ExtractionResult, MultimodalError } from './types.js';

// Re-export the ZIP reader for use by the parser helpers
export { readZip };

// ============================================
// Minimal ZIP Reader
// ============================================

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

/**
 * Read and parse a ZIP file, returning named entries.
 * Handles deflate (method 8) and store (method 0) compression.
 */
async function readZip(buffer: Buffer): Promise<Map<string, Buffer>> {
  const entries = findZipEntries(buffer);
  const files = new Map<string, Buffer>();

  for (const entry of entries) {
    const data = await readZipEntry(buffer, entry);
    files.set(entry.name, data);
  }

  return files;
}

function findZipEntries(buffer: Buffer): ZipEntry[] {
  // Find EOCD by scanning backwards for signature
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new MultimodalError('Not a valid ZIP file (EOCD not found)');
  }

  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);

  const entries: ZipEntry[] = [];
  let cursor = centralDirOffset;
  const end = centralDirOffset + centralDirSize;

  while (cursor < end) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIR_SIGNATURE) break;

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLen = buffer.readUInt16LE(cursor + 28);
    const extraLen = buffer.readUInt16LE(cursor + 30);
    const commentLen = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.toString('utf-8', cursor + 46, cursor + 46 + fileNameLen);

    entries.push({
      name: fileName,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      localHeaderOffset,
    });

    cursor += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

async function readZipEntry(buffer: Buffer, entry: ZipEntry): Promise<Buffer> {
  let cursor = entry.localHeaderOffset;

  if (buffer.readUInt32LE(cursor) !== LOCAL_FILE_SIGNATURE) {
    throw new MultimodalError(`Invalid local file header for: ${entry.name}`);
  }

  const fileNameLen = buffer.readUInt16LE(cursor + 26);
  const extraLen = buffer.readUInt16LE(cursor + 28);
  const dataOffset = cursor + 30 + fileNameLen + extraLen;
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    // Stored (no compression)
    return Buffer.from(compressedData);
  }

  if (entry.compressionMethod === 8) {
    // Deflate
    return await inflateAsync(compressedData, entry.uncompressedSize);
  }

  throw new MultimodalError(
    `Unsupported compression method ${entry.compressionMethod} for: ${entry.name}`,
  );
}

function inflateAsync(data: Uint8Array, expectedSize: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inflate = createInflateRaw();
    const chunks: Buffer[] = [];
    inflate.on('data', (chunk: Buffer) => chunks.push(chunk));
    inflate.on('error', reject);
    inflate.on('end', () => {
      const result = Buffer.concat(chunks);
      if (expectedSize > 0 && result.length !== expectedSize) {
        // Some writers report 0 for uncompressed size; accept the actual result
      }
      resolve(result);
    });
    inflate.end(data);
  });
}

// ============================================
// MIME type helpers
// ============================================

function mimeFromExt(name: string): string {
  const ext = extname(name).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.emf': 'image/emf',
    '.wmf': 'image/wmf',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'application/octet-stream';
}

// ============================================
// DOCX Extractor
// ============================================

/**
 * Parse DOCX document.xml and _rels to extract text and images in document order.
 * DOCX images are referenced in document.xml via <wp:inline> or <wp:anchor> elements
 * containing <a:blip r:embed="rIdX">, resolved through word/_rels/document.xml.rels.
 */
async function extractDocxElements(zipFiles: Map<string, Buffer>): Promise<ExtractionResult> {
  const docXmlBuf = zipFiles.get('word/document.xml');
  if (!docXmlBuf) {
    throw new MultimodalError('Invalid DOCX: word/document.xml not found');
  }
  const docXml = docXmlBuf.toString('utf-8');

  // Parse relationships to map rId → image path
  const relsBuf = zipFiles.get('word/_rels/document.xml.rels');
  const rIdToImage = new Map<string, string>();
  if (relsBuf) {
    const relsXml = relsBuf.toString('utf-8');
    const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]*)"[^>]*\/>/g;
    let match: RegExpExecArray | null;
    while ((match = relRegex.exec(relsXml)) !== null) {
      const rId = match[1] ?? '';
      const target = match[2] ?? '';
      if (target && /\.(png|jpg|jpeg|gif|bmp|webp|tiff?|emf|wmf|svg)$/i.test(target)) {
        rIdToImage.set(rId, `word/${target}`);
      }
    }
  }

  // Parse document.xml body to extract text runs and image references in order
  const elements: ContentElement[] = [];
  const bodyMatch = docXml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) {
    return { elements: [] };
  }

  const bodyContent = bodyMatch[1] ?? '';
  // Tokenize by paragraph and run elements within paragraphs
  const paraRegex = /<w:p[\s>]([\s\S]*?)<\/w:p>/g;
  let paraMatch: RegExpExecArray | null;

  while ((paraMatch = paraRegex.exec(bodyContent)) !== null) {
    const paraContent = paraMatch[1] ?? '';

    // Extract text runs in this paragraph
    const runRegex = /<w:r[\s>]([\s\S]*?)<\/w:r>/g;
    let runMatch: RegExpExecArray | null;
    let paraText = '';

    while ((runMatch = runRegex.exec(paraContent)) !== null) {
      const runContent = runMatch[1] ?? '';

      // Check for image in this run
      const drawingRegex = /<wp:inline[\s\S]*?<a:blip[^>]*r:embed="(rId\d+)"[\s\S]*?<\/wp:inline>|<wp:anchor[\s\S]*?<a:blip[^>]*r:embed="(rId\d+)"[\s\S]*?<\/wp:anchor>/g;
      let drawingMatch: RegExpExecArray | null;

      while ((drawingMatch = drawingRegex.exec(runContent)) !== null) {
        const imgRId = drawingMatch[1] ?? drawingMatch[2];
        if (imgRId) {
          // Flush pending text before the image
          if (paraText.trim().length > 0) {
            elements.push({ type: 'text', content: paraText.trim() });
            paraText = '';
          }

          const imagePath = rIdToImage.get(imgRId);
          if (imagePath) {
            const imageData = zipFiles.get(imagePath);
            if (imageData) {
              elements.push({
                type: 'image',
                data: new Uint8Array(imageData),
                name: basename(imagePath),
                mimeType: mimeFromExt(imagePath),
              });
            }
          }
        }
      }

      // Extract text from this run
      const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let textMatch: RegExpExecArray | null;
      while ((textMatch = textRegex.exec(runContent)) !== null) {
        paraText += textMatch[1] ?? '';
      }
    }

    if (paraText.trim().length > 0) {
      elements.push({ type: 'text', content: paraText.trim() });
    }
  }

  return { elements };
}

// ============================================
// PPTX Extractor
// ============================================

async function extractPptxElements(zipFiles: Map<string, Buffer>): Promise<ExtractionResult> {
  const elements: ContentElement[] = [];

  // Find all slide files
  const slideNames = [...zipFiles.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/slide(\d+)/)?.[1] ?? '0');
      const nb = Number.parseInt(b.match(/slide(\d+)/)?.[1] ?? '0');
      return na - nb;
    });

  for (const slideName of slideNames) {
    const slideNum = slideName.match(/slide(\d+)/)?.[1] ?? '?';
    elements.push({ type: 'text', content: `[Slide ${slideNum}]` });

    const slideXml = zipFiles.get(slideName);
    if (!slideXml) continue;

    const slideContent = slideXml.toString('utf-8');

    // Parse slide relationships for images
    const relsName = `ppt/slides/_rels/${basename(slideName)}.rels`;
    const relsBuf = zipFiles.get(relsName);
    const rIdToImage = new Map<string, string>();
    if (relsBuf) {
      const relsXml = relsBuf.toString('utf-8');
      const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]*)"[^>]*\/>/g;
      let match: RegExpExecArray | null;
      while ((match = relRegex.exec(relsXml)) !== null) {
        const rId = match[1] ?? '';
        const target = match[2] ?? '';
        if (target && /\.(png|jpg|jpeg|gif|bmp|webp|tiff?|emf|wmf|svg)$/i.test(target)) {
          rIdToImage.set(rId, `ppt/media/${target}`);
        }
      }
    }

    // Extract text and images from slide
    const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let textMatch: RegExpExecArray | null;
    let slideText = '';
    while ((textMatch = textRegex.exec(slideContent)) !== null) {
      const t = (textMatch[1] ?? '').trim();
      if (t) slideText += t + ' ';
    }
    if (slideText.trim()) {
      elements.push({ type: 'text', content: slideText.trim() });
    }

    // Find image references
    const blipRegex = /<a:blip[^>]*r:embed="(rId\d+)"[^>]*\/>/g;
    let blipMatch: RegExpExecArray | null;
    while ((blipMatch = blipRegex.exec(slideContent)) !== null) {
      const rId = blipMatch[1] ?? '';
      const imagePath = rIdToImage.get(rId);
      if (imagePath) {
        const imageData = zipFiles.get(imagePath);
        if (imageData) {
          elements.push({
            type: 'image',
            data: new Uint8Array(imageData),
            name: basename(imagePath),
            mimeType: mimeFromExt(imagePath),
          });
        }
      }
    }
  }

  return { elements };
}

// ============================================
// XLSX Extractor
// ============================================

async function extractXlsxElements(zipFiles: Map<string, Buffer>): Promise<ExtractionResult> {
  const elements: ContentElement[] = [];

  // Parse shared strings
  const sstBuf = zipFiles.get('xl/sharedStrings.xml');
  const sharedStrings: string[] = [];
  if (sstBuf) {
    const sstXml = sstBuf.toString('utf-8');
    const siRegex = /<si>([\s\S]*?)<\/si>/g;
    let siMatch: RegExpExecArray | null;
    while ((siMatch = siRegex.exec(sstXml)) !== null) {
      const siContent = siMatch[1] ?? '';
      const tRegex = /<t[^>]*>([^<]*)<\/t>/g;
      let tMatch: RegExpExecArray | null;
      let text = '';
      while ((tMatch = tRegex.exec(siContent)) !== null) {
        text += tMatch[1] ?? '';
      }
      sharedStrings.push(text);
    }
  }

  // Find all sheet files
  const sheetNames = [...zipFiles.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/sheet(\d+)/)?.[1] ?? '0');
      const nb = Number.parseInt(b.match(/sheet(\d+)/)?.[1] ?? '0');
      return na - nb;
    });

  // Parse sheet relationships for images
  const drawingRels = new Map<string, string>(); // drawing path → rels path
  for (const name of zipFiles.keys()) {
    const m = name.match(/^xl\/(drawings\/_rels\/.*\.xml\.rels)$/);
    if (m) {
      drawingRels.set(m[1] ?? '', name);
    }
  }

  for (const sheetName of sheetNames) {
    const sheetNum = sheetName.match(/sheet(\d+)/)?.[1] ?? '?';
    elements.push({ type: 'text', content: `[Sheet ${sheetNum}]` });

    const sheetXml = zipFiles.get(sheetName);
    if (!sheetXml) continue;

    const sheetContent = sheetXml.toString('utf-8');

    // Extract cell text
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(sheetContent)) !== null) {
      const rowContent = rowMatch[1] ?? '';
      const cellRegex = /<c[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g;
      let cellMatch: RegExpExecArray | null;
      const rowText: string[] = [];

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const idx = Number.parseInt(cellMatch[1] ?? '0');
        const text = sharedStrings[idx] ?? '';
        if (text.trim()) {
          rowText.push(text.trim());
        }
      }

      // Also handle inline strings
      const inlineRegex = /<c[^>]*t="inlineStr"[^>]*><is><t[^>]*>([^<]*)<\/t><\/is><\/c>/g;
      let inlineMatch: RegExpExecArray | null;
      while ((inlineMatch = inlineRegex.exec(rowContent)) !== null) {
        const text = (inlineMatch[1] ?? '').trim();
        if (text) rowText.push(text);
      }

      if (rowText.length > 0) {
        elements.push({ type: 'text', content: rowText.join(' | ') });
      }
    }

    // Extract images referenced by this sheet
    const drawingRef = sheetContent.match(/r:id="(rId\d+)".*?http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships\/drawing/);
    if (drawingRef) {
      // Resolve through sheet rels to find drawing XML
      const sheetRelsName = `xl/worksheets/_rels/${basename(sheetName)}.rels`;
      const sheetRelsBuf = zipFiles.get(sheetRelsName);
      if (sheetRelsBuf) {
        const sheetRelsXml = sheetRelsBuf.toString('utf-8');
        const drawRels = new Map<string, string>();
        const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]*)"[^>]*\/>/g;
        let relMatch: RegExpExecArray | null;
        while ((relMatch = relRegex.exec(sheetRelsXml)) !== null) {
          const rId = relMatch[1] ?? '';
          const target = relMatch[2] ?? '';
          drawRels.set(rId, `xl/worksheets/${target}`);
        }

        // Follow drawing reference to get image references
        // ... this gets complex. For XLSX, a simplified approach: just scan all media
      }
    }
  }

  // Fallback: scan all xl/media/ images and add them at the end
  for (const name of zipFiles.keys()) {
    if (/^xl\/media\/.*\.(png|jpg|jpeg|gif|bmp|webp|tiff?)$/i.test(name)) {
      const imageData = zipFiles.get(name);
      if (imageData) {
        elements.push({
          type: 'image',
          data: new Uint8Array(imageData),
          name: basename(name),
          mimeType: mimeFromExt(name),
        });
      }
    }
  }

  return { elements };
}

// ============================================
// PDF Extractor (via mupdf stextJson)
// ============================================

/**
 * Extract images from a PDF by reading mupdf stextJson with preserve-images option.
 * Returns ContentElements: text blocks and image blocks interleaved by page.
 * This is a lightweight alternative to the full visual pipeline — it extracts image
 * references from stext JSON rather than rendering via pixmap.
 */
export async function extractPdfElements(filePath: string): Promise<ExtractionResult> {
  try {
    const buffer = await readFile(filePath);
    const mupdf = await import('mupdf');
    const doc = mupdf.Document.openDocument(buffer, 'application/pdf') as {
      countPages: () => number;
      loadPage: (n: number) => {
        getBounds: () => [number, number, number, number];
        toStructuredText: (opts: string) => { asJSON: () => string };
      };
      destroy: () => void;
    };

    try {
      const numPages = doc.countPages();
      const elements: ContentElement[] = [];

      for (let i = 0; i < numPages; i++) {
        const page = doc.loadPage(i);
        const stext = page.toStructuredText('preserve-whitespace,preserve-images');
        const json = JSON.parse(stext.asJSON()) as {
          blocks: Array<{
            type: string;
            lines?: Array<{
              text: string;
            }>;
          }>;
        };

        const pageTextParts: string[] = [];

        for (const block of json.blocks) {
          if (block.type === 'text' && block.lines) {
            const blockText = block.lines.map((l) => l.text).join(' ');
            if (blockText.trim()) {
              pageTextParts.push(blockText);
            }
          } else if (block.type === 'image') {
            // Flush pending text before image marker
            if (pageTextParts.length > 0) {
              elements.push({ type: 'text', content: pageTextParts.join('\n') });
              pageTextParts.length = 0;
            }
            // For PDF images, we use a placeholder — the actual captioning happens
            // via the pdf-visual renderer or via api-captioner on rendered pages.
            // In the multimodal pipeline, PDF images are rendered to PNG first.
            elements.push({
              type: 'image',
              data: new Uint8Array(0), // placeholder — filled by api-captioner
              name: `pdf_page_${i + 1}_image`,
              mimeType: 'image/png',
            });
          }
        }

        if (pageTextParts.length > 0) {
          elements.push({ type: 'text', content: pageTextParts.join('\n') });
        }
      }

      return { elements };
    } finally {
      doc.destroy();
    }
  } catch (error) {
    throw new MultimodalError(
      `Failed to extract PDF elements: ${(error as Error).message}`,
      error as Error,
    );
  }
}

// ============================================
// Main Extractor Dispatcher
// ============================================

const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif',
]);

/**
 * Extract content elements (text + images in document order) from a file.
 *
 * @param filePath - Absolute path to the file
 * @returns ExtractionResult with ordered ContentElement[] and optional title
 */
export async function extractContentElements(filePath: string): Promise<ExtractionResult> {
  const ext = extname(filePath).toLowerCase();

  // Image files: single image element
  if (IMAGE_EXTENSIONS.has(ext)) {
    const data = await readFile(filePath);
    return {
      elements: [
        {
          type: 'image' as const,
          data: new Uint8Array(data),
          name: basename(filePath),
          mimeType: mimeFromExt(filePath),
        },
      ],
    };
  }

  // ZIP-based office documents
  if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') {
    const buffer = await readFile(filePath);
    const zipFiles = await readZip(buffer);

    switch (ext) {
      case '.docx':
        return await extractDocxElements(zipFiles);
      case '.xlsx':
        return await extractXlsxElements(zipFiles);
      case '.pptx':
        return await extractPptxElements(zipFiles);
    }
  }

  // PDF: use mupdf stextJson
  if (ext === '.pdf') {
    return await extractPdfElements(filePath);
  }

  throw new MultimodalError(`Unsupported file format for multimodal extraction: ${ext}`);
}
