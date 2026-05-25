// Generate minimal placeholder PNG icons for the extension.
// Run: node scripts/generate-icons.js

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Minimal valid 1x1 transparent PNG (base64 decoded)
const MINI_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const png = Buffer.from(MINI_PNG_BASE64, 'base64');

const sizes = [16, 48, 128];
const iconsDir = join(import.meta.dirname, '..', 'public', 'icons');

for (const size of sizes) {
  writeFileSync(join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
}

// Also create a slightly larger placeholder with a colored background
// for better appearance in the toolbar
