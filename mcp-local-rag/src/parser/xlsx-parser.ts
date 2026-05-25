// XLSX text-only parser — shared strings + cell values.
// Used by DocumentParser.parseXlsx() for the non-multimodal path.
// Also exported for use by image-extractor in the multimodal path.

import { createInflateRaw } from 'node:zlib';

// ============================================
// Minimal ZIP Reader (shared with pptx-parser)
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

export async function readZip(buffer: Buffer): Promise<Map<string, Buffer>> {
  const entries = findZipEntries(buffer);
  const files = new Map<string, Buffer>();

  for (const entry of entries) {
    const data = await readZipEntry(buffer, entry);
    files.set(entry.name, data);
  }

  return files;
}

function findZipEntries(buffer: Buffer): ZipEntry[] {
  let eocdOffset = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('Not a valid ZIP file');

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
    entries.push({ name: fileName, compressedSize, uncompressedSize, compressionMethod, localHeaderOffset });
    cursor += 46 + fileNameLen + extraLen + commentLen;
  }
  return entries;
}

async function readZipEntry(buffer: Buffer, entry: ZipEntry): Promise<Buffer> {
  let cursor = entry.localHeaderOffset;
  if (buffer.readUInt32LE(cursor) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`Invalid local header for: ${entry.name}`);
  }
  const fileNameLen = buffer.readUInt16LE(cursor + 26);
  const extraLen = buffer.readUInt16LE(cursor + 28);
  const dataOffset = cursor + 30 + fileNameLen + extraLen;
  const compressedData = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) return Buffer.from(compressedData);
  if (entry.compressionMethod === 8) return await inflateAsync(compressedData);
  throw new Error(`Unsupported compression: ${entry.compressionMethod}`);
}

function inflateAsync(data: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inflate = createInflateRaw();
    const chunks: Buffer[] = [];
    inflate.on('data', (chunk: Buffer) => chunks.push(chunk));
    inflate.on('error', reject);
    inflate.on('end', () => resolve(Buffer.concat(chunks)));
    inflate.end(data);
  });
}

// ============================================
// XLSX Text Extraction
// ============================================

/**
 * Parse shared strings from xl/sharedStrings.xml
 */
export function parseSharedStrings(zipFiles: Map<string, Buffer>): string[] {
  const sstBuf = zipFiles.get('xl/sharedStrings.xml');
  if (!sstBuf) return [];

  const sstXml = sstBuf.toString('utf-8');
  const strings: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;

  while ((match = siRegex.exec(sstXml)) !== null) {
    const siContent = match[1] ?? '';
    const tRegex = /<t[^>]*>([^<]*)<\/t>/g;
    let tMatch: RegExpExecArray | null;
    let text = '';
    while ((tMatch = tRegex.exec(siContent)) !== null) {
      text += tMatch[1] ?? '';
    }
    strings.push(text);
  }
  return strings;
}

/**
 * Extract cell text from all sheets in order.
 */
export function parseSheetText(
  zipFiles: Map<string, Buffer>,
  sharedStrings: string[],
): string {
  const sheetNames = [...zipFiles.keys()]
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/sheet(\d+)/)?.[1] ?? '0');
      const nb = Number.parseInt(b.match(/sheet(\d+)/)?.[1] ?? '0');
      return na - nb;
    });

  const parts: string[] = [];

  for (const sheetName of sheetNames) {
    const sheetNum = sheetName.match(/sheet(\d+)/)?.[1] ?? '?';
    parts.push(`=== Sheet ${sheetNum} ===`);

    const sheetBuf = zipFiles.get(sheetName);
    if (!sheetBuf) continue;

    const sheetContent = sheetBuf.toString('utf-8');

    // Extract rows with shared string references
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(sheetContent)) !== null) {
      const rowContent = rowMatch[1] ?? '';

      // Shared string cells
      const cellRegex = /<c[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/g;
      let cellMatch: RegExpExecArray | null;
      const rowText: string[] = [];

      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const idx = Number.parseInt(cellMatch[1] ?? '0');
        const text = sharedStrings[idx] ?? '';
        if (text.trim()) rowText.push(text.trim());
      }

      // Inline string cells
      const inlineRegex = /<c[^>]*t="inlineStr"[^>]*><is><t[^>]*>([^<]*)<\/t><\/is><\/c>/g;
      let inlineMatch: RegExpExecArray | null;
      while ((inlineMatch = inlineRegex.exec(rowContent)) !== null) {
        const text = (inlineMatch[1] ?? '').trim();
        if (text) rowText.push(text);
      }

      if (rowText.length > 0) {
        parts.push(rowText.join('\t'));
      }
    }
  }

  return parts.join('\n');
}
