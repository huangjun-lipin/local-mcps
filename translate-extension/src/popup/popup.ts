// Popup script — language selection and settings management.

import { DEFAULT_TARGET_LANG } from '../lib/languages';

// ============================================
// DOM elements
// ============================================

const targetLangSelect = document.getElementById('targetLang') as HTMLSelectElement;
const saveLangBtn = document.getElementById('saveLangBtn') as HTMLButtonElement;
const langStatus = document.getElementById('langStatus') as HTMLDivElement;

const subtitleToggle = document.getElementById('subtitleToggle') as HTMLInputElement;

const apiConfigSection = document.getElementById('apiConfigSection') as HTMLDivElement;
const showApiBtn = document.getElementById('showApiBtn') as HTMLButtonElement;
const hideApiBtn = document.getElementById('hideApiBtn') as HTMLButtonElement;
const saveApiBtn = document.getElementById('saveApiBtn') as HTMLButtonElement;
const saveStatus = document.getElementById('saveStatus') as HTMLDivElement;

const apiUrlInput = document.getElementById('apiUrl') as HTMLInputElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const modelInput = document.getElementById('model') as HTMLInputElement;

// ============================================
// Load saved settings
// ============================================

async function loadSettings(): Promise<void> {
  const items = await chrome.storage.sync.get([
    'targetLang',
    'subtitleOverlay',
    'apiUrl',
    'apiKey',
    'model',
  ]);

  // Target language
  const targetLang = (items['targetLang'] as string) || DEFAULT_TARGET_LANG;
  targetLangSelect.value = targetLang;

  // Subtitle overlay
  subtitleToggle.checked = items['subtitleOverlay'] === true;

  // API settings
  apiUrlInput.value = (items['apiUrl'] as string) || 'https://api.openai.com/v1/chat/completions';
  apiKeyInput.value = (items['apiKey'] as string) || '';
  modelInput.value = (items['model'] as string) || 'gpt-4o-mini';
}

// ============================================
// Event handlers
// ============================================

// Save target language
saveLangBtn.addEventListener('click', async () => {
  await chrome.storage.sync.set({ targetLang: targetLangSelect.value });
  showStatus(langStatus);
});

// Toggle subtitle overlay
subtitleToggle.addEventListener('change', async () => {
  const enabled = subtitleToggle.checked;
  await chrome.storage.sync.set({ subtitleOverlay: enabled });

  // Notify active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'ENABLE_SUBTITLE_OVERLAY',
      enabled,
    }).catch(() => {});
  }
});

// Show API config
showApiBtn.addEventListener('click', () => {
  apiConfigSection.style.display = '';
  showApiBtn.style.display = 'none';
});

// Hide API config
hideApiBtn.addEventListener('click', () => {
  apiConfigSection.style.display = 'none';
  showApiBtn.style.display = '';
});

// Save API config
saveApiBtn.addEventListener('click', async () => {
  await chrome.storage.sync.set({
    apiUrl: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    model: modelInput.value.trim(),
  });
  apiConfigSection.style.display = 'none';
  showApiBtn.style.display = '';
  showStatus(saveStatus);
});

// ============================================
// Helpers
// ============================================

function showStatus(el: HTMLElement): void {
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

// ============================================
// Init
// ============================================

loadSettings().catch(console.error);
