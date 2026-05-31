import { crx, defineManifest } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';

const manifest = defineManifest({
  manifest_version: 3,
  name: '智能翻译助手',
  version: '1.0.0',
  description: '选中网页/PDF/视频中的文字即可翻译，支持多语言切换',
  permissions: ['storage', 'activeTab', 'scripting', 'contextMenus'],
  commands: {
    'translate-selection': {
      suggested_key: { default: 'Alt+T', mac: 'Alt+T' },
      description: '翻译当前选中文字',
    },
  },
  host_permissions: ['<all_urls>'],
  action: {
    default_popup: 'src/popup/popup.html',
    default_title: '智能翻译助手',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/webpage.ts'],
      run_at: 'document_end',
      all_frames: true,
    },
    {
      matches: ['<all_urls>'],
      js: ['src/content/subtitle.ts'],
      run_at: 'document_end',
      all_frames: true,
    },
    {
      matches: ['<all_urls>'],
      js: ['src/content/page-translate.ts'],
      run_at: 'document_end',
    },
    {
      matches: ['*://*/*.pdf', 'file://*/*.pdf', '*://*/*.PDF'],
      js: ['src/content/pdf.ts'],
      run_at: 'document_end',
    },
  ],
  icons: {
    '16': 'public/icons/icon16.png',
    '48': 'public/icons/icon48.png',
    '128': 'public/icons/icon128.png',
  },
});

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
