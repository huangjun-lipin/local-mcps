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
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: createLoadingPopupInPage,
      args: [text],
    });

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

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: translateSelectionInPage,
    });
  } catch {
    // ignore
  }
});

// ============================================
// Message handler
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
// Injected popup functions
// CRITICAL: Must be 100% self-contained — no closure over outer scope.
// chrome.scripting.executeScript serializes the function body ONLY,
// so every variable/helper must be defined INSIDE the function.
// ============================================

function createLoadingPopupInPage(sourceText: string): void {
  // -- inline helpers (no outer scope references!) --
  const esc = (t: string) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  const makeDraggable = (popup: HTMLElement, header: HTMLElement) => {
    let sx = 0, sy = 0, ox = 0, oy = 0, on = false;
    header.addEventListener('pointerdown', (ev: PointerEvent) => {
      const t = ev.target as HTMLElement;
      if (t && (t.classList.contains('__tr-popup-close') || t.classList.contains('__tr-popup-copy'))) return;
      on = true; sx = ev.clientX; sy = ev.clientY; ox = popup.offsetLeft; oy = popup.offsetTop;
      header.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    header.addEventListener('pointermove', (ev: PointerEvent) => {
      if (!on) return;
      popup.style.left = Math.max(0, Math.min(window.innerWidth - popup.offsetWidth, ox + ev.clientX - sx)) + 'px';
      popup.style.top  = Math.max(0, Math.min(window.innerHeight - popup.offsetHeight, oy + ev.clientY - sy)) + 'px';
    });
    header.addEventListener('pointerup', () => { on = false; });
    header.addEventListener('pointercancel', () => { on = false; });
  };

  const CSS = '.__tr-popup *{box-sizing:border-box}' +
    '.__tr-popup{all:initial;position:fixed;z-index:2147483647;max-width:560px;min-width:240px;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;' +
    'line-height:1.7;color:#1a1a1a;background:#fff;border:1px solid #d0d0d0;border-radius:14px;' +
    'box-shadow:0 12px 40px rgba(0,0,0,0.15),0 4px 12px rgba(0,0,0,0.08);padding:0;overflow:hidden}' +
    '.__tr-popup-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;' +
    'background:#f8f8f8;border-bottom:1px solid #eee;font-size:12px;color:#666;cursor:grab;' +
    'user-select:none;-webkit-user-select:none}' +
    '.__tr-popup-header:active{cursor:grabbing}' +
    '.__tr-popup-header-left{display:flex;align-items:center;gap:6px;pointer-events:none}' +
    '.__tr-popup-close{cursor:pointer;font-size:20px;line-height:1;color:#999;padding:2px 6px;' +
    'border-radius:6px;background:none;border:none;pointer-events:auto}' +
    '.__tr-popup-close:hover{background:#e8e8e8;color:#333}' +
    '.__tr-popup-copy{cursor:pointer;border:none;background:none;font-size:12px;color:#1a73e8;' +
    'padding:3px 8px;border-radius:4px;margin-right:6px;pointer-events:auto}' +
    '.__tr-popup-copy:hover{background:#e8f0fe}' +
    '.__tr-popup-body{padding:14px 16px;min-height:40px;max-height:420px;overflow-y:auto;' +
    'word-break:break-word;white-space:pre-wrap;line-height:1.7}' +
    '.__tr-popup-source{margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed #e8e8e8;' +
    'color:#777;font-size:13px;font-style:italic;max-height:140px;overflow-y:auto;' +
    'white-space:pre-wrap;word-break:break-word;line-height:1.6}' +
    '.__tr-popup-result{color:#1a1a1a;white-space:pre-wrap;word-break:break-word;line-height:1.7}' +
    '.__tr-popup-error{color:#d93025;font-size:13px;white-space:pre-wrap;word-break:break-word}' +
    '.__tr-popup-spinner{width:18px;height:18px;border:2px solid #e0e0e0;border-top-color:#1a73e8;' +
    'border-radius:50%;animation:__tr-spin 0.6s linear infinite;display:inline-block;vertical-align:middle;margin-right:8px}' +
    '@keyframes __tr-spin{to{transform:rotate(360deg)}}';
  // -- end helpers --

  const existing = document.querySelector('.__tr-popup') as HTMLElement | null;
  if (existing) existing.remove();

  if (!document.getElementById('__tr-popup-style')) {
    const s = document.createElement('style'); s.id = '__tr-popup-style'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  const truncated = sourceText.length > 300 ? sourceText.slice(0, 300) + '…' : sourceText;
  const div = document.createElement('div'); div.className = '__tr-popup';
  div.innerHTML =
    '<div class="__tr-popup-header"><div class="__tr-popup-header-left">🌐 翻译中…</div>' +
    '<button class="__tr-popup-close">×</button></div>' +
    '<div class="__tr-popup-body"><div class="__tr-popup-source">' + esc(truncated) + '</div>' +
    '<div><span class="__tr-popup-spinner"></span>翻译中…</div></div>';
  document.body.appendChild(div);
  div.style.top = (window.innerHeight / 3) + 'px';
  div.style.left = Math.max(10, (window.innerWidth - 560) / 2) + 'px';

  const hdr = div.querySelector('.__tr-popup-header') as HTMLElement;
  if (hdr) makeDraggable(div, hdr);

  (div.querySelector('.__tr-popup-close') as HTMLElement | null)?.addEventListener('click', () => div.remove());

  const onOut = function(e: MouseEvent) {
    if (!div.contains(e.target as Node)) { div.remove(); document.removeEventListener('mousedown', onOut); }
    else document.addEventListener('mousedown', onOut, { once: true });
  };
  setTimeout(() => document.addEventListener('mousedown', onOut, { once: true }), 0);
}

function updatePopupWithResult(sourceText: string, translation: string): void {
  const esc = (t: string) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  const popup = document.querySelector('.__tr-popup') as HTMLElement | null;
  if (!popup) return;

  const truncated = sourceText.length > 300 ? sourceText.slice(0, 300) + '…' : sourceText;
  const body = popup.querySelector('.__tr-popup-body');
  if (body) {
    body.innerHTML =
      '<div class="__tr-popup-source">' + esc(truncated) + '</div>' +
      '<div class="__tr-popup-result">' + esc(translation) + '</div>';
  }

  const header = popup.querySelector('.__tr-popup-header');
  if (header) {
    const left = header.querySelector('.__tr-popup-header-left');
    if (left) (left as HTMLElement).textContent = '🌐 翻译';

    const copyBtn = document.createElement('button');
    copyBtn.className = '__tr-popup-copy'; copyBtn.textContent = '📋 复制';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(translation).catch(() => {});
      copyBtn.textContent = '✅ 已复制'; setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
    });
    const closeBtn = header.querySelector('.__tr-popup-close');
    if (closeBtn) header.insertBefore(copyBtn, closeBtn); else header.appendChild(copyBtn);
  }
}

function updatePopupWithError(sourceText: string, error: string): void {
  const esc = (t: string) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
  const popup = document.querySelector('.__tr-popup') as HTMLElement | null;
  if (!popup) return;

  const truncated = sourceText.length > 200 ? sourceText.slice(0, 200) + '…' : sourceText;
  const body = popup.querySelector('.__tr-popup-body');
  if (body) {
    body.innerHTML =
      '<div class="__tr-popup-source">' + esc(truncated) + '</div>' +
      '<div class="__tr-popup-error">❌ ' + esc(error) + '</div>';
  }
  const header = popup.querySelector('.__tr-popup-header');
  if (header) {
    const left = header.querySelector('.__tr-popup-header-left');
    if (left) (left as HTMLElement).textContent = '🌐 翻译失败';
  }
}

function translateSelectionInPage(): void {
  const selection = window.getSelection();
  const text = selection?.toString().trim() || '';
  if (text.length < 2) return;
  window.postMessage({ type: '__TR_TRANSLATE_SELECTION__', text }, '*');
}
