// Background Service Worker — translation API proxy + context menu + keyboard shortcut.

import { translate } from './lib/translator';
import { getLanguageLabel } from './lib/languages';

// ============================================
// Context menu
// ============================================

const CONTEXT_MENU_ID = 'translate-selection';

chrome.runtime.onInstalled.addListener(async () => {
  const items = await chrome.storage.sync.get([
    'targetLang', 'apiUrl', 'apiKey', 'model',
  ]);
  const defaults: Record<string, string> = {};
  if (!items['targetLang']) defaults['targetLang'] = 'zh-CN';
  if (!items['apiUrl']) defaults['apiUrl'] = 'https://api.openai.com/v1/chat/completions';
  if (!items['model']) defaults['model'] = 'gpt-4o-mini';
  if (Object.keys(defaults).length > 0) {
    await chrome.storage.sync.set(defaults);
  }

  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: '🌐 翻译选中文字',
    contexts: ['selection'],
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes['targetLang']) {
    const label = getLanguageLabel(changes['targetLang'].newValue as string);
    chrome.contextMenus.update(CONTEXT_MENU_ID, {
      title: `🌐 翻译为${label}`,
    }).catch(() => {});
  }
});

// ============================================
// Context menu click → inject popup + translate + update
// ============================================

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;
  const text = info.selectionText?.trim();
  if (!text || text.length < 2 || !tab?.id) return;

  const tabId = tab.id;

  try {
    // Step 1: inject loading popup
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: createLoadingPopupInPage,
      args: [text],
    });

    // Step 2: call translation API
    let translation: string;
    try {
      translation = await translate(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '翻译失败';
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: updatePopupWithError,
        args: [text, msg],
      });
      return;
    }

    // Step 3: update popup with result
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: updatePopupWithResult,
      args: [text, translation],
    });
  } catch {
    // scripting.executeScript may fail on restricted pages
  }
});

// ============================================
// Keyboard command
// ============================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  // Use executeScript to get selection + translate
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: translateSelectionInPage,
    });
  } catch {
    // page may not support injection
  }
});

// ============================================
// Message handler (for content-script-initiated translations)
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRANSLATE') {
    handleTranslate(message.text as string)
      .then((result) => sendResponse({ translation: result }))
      .catch((err) => sendResponse({ error: err instanceof Error ? err.message : '翻译失败' }));
    return true;
  }

  if (message.type === 'TRANSLATE_SUBTITLE') {
    handleTranslate(message.text as string)
      .then((result) => sendResponse({ translation: result }))
      .catch(() => sendResponse({ translation: '' }));
    return true;
  }

  if (message.type === 'GET_CONFIG') {
    chrome.storage.sync.get(['targetLang', 'apiUrl', 'apiKey', 'model'], (items) => {
      sendResponse(items);
    });
    return true;
  }

  if (message.type === 'SET_CONFIG') {
    chrome.storage.sync.set(message.config as Record<string, string>, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  return false;
});

async function handleTranslate(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  return translate(text);
}

// ============================================
// Injected functions (self-contained, run in MAIN world)
// These must be standalone — no imports, no closures over outer scope.
// They're serialized and injected via chrome.scripting.executeScript.
// ============================================

function createLoadingPopupInPage(sourceText: string): void {
  // Remove any existing popup
  const existing = document.querySelector('.__tr-popup') as HTMLElement | null;
  if (existing) existing.remove();

  // Inject styles once
  if (!document.getElementById('__tr-popup-style')) {
    const style = document.createElement('style');
    style.id = '__tr-popup-style';
    style.textContent =
      '.__tr-popup *,.__tr-popup *::before,.__tr-popup *::after{all:unset;}' +
      '.__tr-popup{all:initial;position:fixed;z-index:2147483647;max-width:520px;min-width:200px;' +
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;' +
      'line-height:1.6;color:#1a1a1a;background:#fff;border:1px solid #e0e0e0;border-radius:12px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.14),0 2px 8px rgba(0,0,0,0.08);padding:0;overflow:hidden;' +
      'animation:__tr-fade-in 0.15s ease-out;}' +
      '@keyframes __tr-fade-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}' +
      '.__tr-popup-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;' +
      'background:#f7f7f7;border-bottom:1px solid #eee;font-size:12px;color:#666}' +
      '.__tr-popup-close{cursor:pointer;font-size:18px;line-height:1;color:#999;padding:2px 4px;border-radius:4px}' +
      '.__tr-popup-close:hover{background:#eee;color:#333}' +
      '.__tr-popup-body{padding:12px 14px;min-height:30px;max-height:360px;overflow-y:auto;word-break:break-word;white-space:pre-wrap}' +
      '.__tr-popup-source{margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed #e8e8e8;color:#555;font-size:13px;' +
      'font-style:italic;max-height:120px;overflow-y:auto;white-space:pre-wrap;word-break:break-word}' +
      '.__tr-popup-result{color:#1a1a1a}' +
      '.__tr-popup-error{color:#d93025;font-size:13px}' +
      '.__tr-popup-spinner{width:16px;height:16px;border:2px solid #e0e0e0;border-top-color:#1a73e8;' +
      'border-radius:50%;animation:__tr-spin 0.6s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px}' +
      '@keyframes __tr-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  const esc = (t: string) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  const truncated = sourceText.length > 300 ? sourceText.slice(0, 300) + '…' : sourceText;
  const div = document.createElement('div');
  div.className = '__tr-popup';
  div.innerHTML =
    '<div class="__tr-popup-header"><span>🌐 翻译中…</span>' +
    '<button class="__tr-popup-close">×</button></div>' +
    '<div class="__tr-popup-body"><div class="__tr-popup-source">' + esc(truncated) + '</div>' +
    '<div><span class="__tr-popup-spinner"></span>翻译中…</div></div>';

  document.body.appendChild(div);
  div.style.top = (window.innerHeight / 3) + 'px';
  div.style.left = Math.max(10, (window.innerWidth - 520) / 2) + 'px';

  const closeBtn = div.querySelector('.__tr-popup-close');
  if (closeBtn) closeBtn.addEventListener('click', () => div.remove());

  const onOutside = function(e: MouseEvent) {
    if (!div.contains(e.target as Node)) { div.remove(); document.removeEventListener('mousedown', onOutside); }
    else document.addEventListener('mousedown', onOutside, { once: true });
  };
  setTimeout(() => document.addEventListener('mousedown', onOutside, { once: true }), 0);
}

function updatePopupWithResult(sourceText: string, translation: string): void {
  const popup = document.querySelector('.__tr-popup') as HTMLElement | null;
  if (!popup) return;

  const esc = (t: string) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  const truncated = sourceText.length > 300 ? sourceText.slice(0, 300) + '…' : sourceText;

  const body = popup.querySelector('.__tr-popup-body');
  if (body) {
    body.innerHTML =
      '<div class="__tr-popup-source">' + esc(truncated) + '</div>' +
      '<div class="__tr-popup-result">' + esc(translation) + '</div>';
  }

  const header = popup.querySelector('.__tr-popup-header');
  if (header) {
    const span = header.querySelector('span');
    if (span) span.textContent = '🌐 翻译';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 复制';
    copyBtn.style.cssText =
      'cursor:pointer;border:none;background:none;font-size:12px;color:#1a73e8;padding:2px 6px;border-radius:4px;margin-right:6px';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(translation).catch(() => {});
      copyBtn.textContent = '✅ 已复制';
      setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
    });
    const closeBtn = header.querySelector('.__tr-popup-close');
    if (closeBtn) header.insertBefore(copyBtn, closeBtn);
    else header.appendChild(copyBtn);
  }
}

function updatePopupWithError(sourceText: string, error: string): void {
  const popup = document.querySelector('.__tr-popup') as HTMLElement | null;
  if (!popup) return;

  const esc = (t: string) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  const truncated = sourceText.length > 200 ? sourceText.slice(0, 200) + '…' : sourceText;

  const body = popup.querySelector('.__tr-popup-body');
  if (body) {
    body.innerHTML =
      '<div class="__tr-popup-source">' + esc(truncated) + '</div>' +
      '<div class="__tr-popup-error">❌ ' + esc(error) + '</div>';
  }

  const header = popup.querySelector('.__tr-popup-header');
  if (header) {
    const span = header.querySelector('span');
    if (span) span.textContent = '🌐 翻译失败';
  }
}

function translateSelectionInPage(): void {
  const selection = window.getSelection();
  const text = selection?.toString().trim() || '';
  if (text.length < 2) return;

  // Trigger translation via the content script's existing mechanism
  // by posting a message that the webpage content script listens for
  window.postMessage({ type: '__TR_TRANSLATE_SELECTION__', text }, '*');
}
