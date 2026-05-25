// PPTX text-only parser — slide text extraction.
// Used by DocumentParser.parsePptx() for the non-multimodal path.

import { createInflateRaw } from 'node:zlib';

// ============================================
// Minimal ZIP Reader (shared with xlsx-parser)
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
// PPTX Text Extraction
// ============================================

/**
 * Extract text from all slides in order.
 */
export function parseSlideText(zipFiles: Map<string, Buffer>): string {
  const slideNames = [...zipFiles.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number.parseInt(a.match(/slide(\d+)/)?.[1] ?? '0');
      const nb = Number.parseInt(b.match(/slide(\d+)/)?.[1] ?? '0');
      return na - nb;
    });

  const parts: string[] = [];

  for (const slideName of slideNames) {
    const slideNum = slideName.match(/slide(\d+)/)?.[1] ?? '?';
    const slideBuf = zipFiles.get(slideName);
    if (!slideBuf) continue;

    const slideXml = slideBuf.toString('utf-8');

    // Extract text from <a:t> elements
    const textRegex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let match: RegExpExecArray | null;
    const lines: string[] = [];
    while ((match = textRegex.exec(slideXml)) !== null) {
      const t = (match[1] ?? '').trim();
      if (t) lines.push(t);
    }

    if (lines.length > 0) {
      parts.push(`=== Slide ${slideNum} ===`);
      parts.push(lines.join('\n'));
    }
  }

  return parts.join('\n\n');
}
