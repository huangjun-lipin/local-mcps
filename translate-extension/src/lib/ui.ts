// Floating translation popup UI component.
//
// Injected into the page when the user selects text.
// Shows a loading spinner while translating, then displays the result.
// Clicking outside the popup dismisses it.

import { translate } from './translator';
import { getLanguageLabel } from './languages';

// ============================================
// Popup State
// ============================================

let popupEl: HTMLDivElement | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let isLoading = false;

// ============================================
// Style injection (runs once)
// ============================================

const POPUP_STYLE_ID = '__translate-popup-style__';

export function injectStyles(): void {
  if (document.getElementById(POPUP_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = POPUP_STYLE_ID;
  style.textContent = `
    .__tr-popup {
      all: initial;
      position: fixed;
      z-index: 2147483647;
      max-width: 520px;
      min-width: 200px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
      padding: 0;
      overflow: hidden;
      animation: __tr-popup-in 0.15s ease-out;
    }
    @keyframes __tr-popup-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .__tr-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: #f8f8f8;
      border-bottom: 1px solid #eee;
      font-size: 12px;
      color: #666;
      cursor: grab;
      user-select: none;
      -webkit-user-select: none;
    }
    .__tr-popup-header:active { cursor: grabbing; }
    .__tr-popup-header-left {
      display: flex;
      align-items: center;
      gap: 6px;
      pointer-events: none;
    }
    .__tr-popup-lang-tag {
      display: inline-block;
      padding: 2px 8px;
      background: #e8f0fe;
      color: #1a73e8;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }
    .__tr-popup-close {
      cursor: pointer;
      border: none;
      background: none;
      font-size: 18px;
      line-height: 1;
      color: #999;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .__tr-popup-close:hover {
      background: #eee;
      color: #333;
    }
    .__tr-popup-body {
      padding: 12px 14px;
      min-height: 30px;
      max-height: 360px;
      overflow-y: auto;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .__tr-popup-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #999;
    }
    .__tr-popup-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #e0e0e0;
      border-top-color: #1a73e8;
      border-radius: 50%;
      animation: __tr-spin 0.6s linear infinite;
    }
    @keyframes __tr-spin {
      to { transform: rotate(360deg); }
    }
    .__tr-popup-error {
      color: #d93025;
      font-size: 13px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .__tr-popup-source {
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px dashed #e8e8e8;
      color: #777;
      font-size: 13px;
      font-style: italic;
      max-height: 140px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.6;
    }
    .__tr-popup-result {
      color: #1a1a1a;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.7;
    }
    .__tr-popup-copy {
      cursor: pointer;
      border: none;
      background: none;
      font-size: 12px;
      color: #1a73e8;
      padding: 3px 8px;
      border-radius: 4px;
      margin-right: 6px;
      pointer-events: auto;
    }
    .__tr-popup-copy:hover {
      background: #e8f0fe;
    }
  `;
  document.head.appendChild(style);
}

// ============================================
// Positioning helper
// ============================================

function positionPopup(popup: HTMLElement, anchorRect: DOMRect): void {
  const margin = 10;
  const popupHeight = popup.offsetHeight || 200;
  const popupWidth = popup.offsetWidth || 300;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;

  // Default: below the selection, centered horizontally
  let top = anchorRect.bottom + margin;
  let left = anchorRect.left + anchorRect.width / 2 - popupWidth / 2;

  // If below would push off-screen, show above
  if (top + popupHeight > viewHeight - margin) {
    top = anchorRect.top - popupHeight - margin;
  }

  // Clamp horizontally
  if (left < margin) left = margin;
  if (left + popupWidth > viewWidth - margin) left = viewWidth - popupWidth - margin;

  // Clamp vertically
  if (top < margin) top = margin;

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}

// ============================================
// Drag helper
// ============================================

function makeDraggable(popup: HTMLElement, header: HTMLElement): void {
  let startX = 0, startY = 0, origX = 0, origY = 0;
  let dragging = false;

  header.addEventListener('pointerdown', (ev: PointerEvent) => {
    const target = ev.target as HTMLElement;
    if (target && (target.classList.contains('__tr-popup-close') || target.classList.contains('__tr-popup-copy'))) return;
    dragging = true;
    startX = ev.clientX;
    startY = ev.clientY;
    origX = popup.offsetLeft;
    origY = popup.offsetTop;
    header.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });

  header.addEventListener('pointermove', (ev: PointerEvent) => {
    if (!dragging) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    popup.style.left = Math.max(0, Math.min(window.innerWidth - popup.offsetWidth, origX + dx)) + 'px';
    popup.style.top = Math.max(0, Math.min(window.innerHeight - popup.offsetHeight, origY + dy)) + 'px';
  });

  header.addEventListener('pointerup', () => { dragging = false; });
  header.addEventListener('pointercancel', () => { dragging = false; });
}

// ============================================
// Build popup DOM
// ============================================

async function getTargetLang(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['targetLang'], (result) => {
      resolve((result['targetLang'] as string) || 'zh-CN');
    });
  });
}

function createPopup(sourceText: string, targetLangCode: string): HTMLDivElement {
  const langLabel = getLanguageLabel(targetLangCode);

  const popup = document.createElement('div');
  popup.className = '__tr-popup';

  popup.innerHTML = `
    <div class="__tr-popup-header">
      <div class="__tr-popup-header-left">
        <span>🌐 翻译为</span>
        <span class="__tr-popup-lang-tag">${langLabel}</span>
      </div>
      <div>
        <button class="__tr-popup-copy" title="复制翻译结果" style="display:none">📋 复制</button>
        <button class="__tr-popup-close" title="关闭">×</button>
      </div>
    </div>
    <div class="__tr-popup-body">
      <div class="__tr-popup-source">${escapeHtml(sourceText.slice(0, 300))}${sourceText.length > 300 ? '…' : ''}</div>
      <div class="__tr-popup-loading">
        <span class="__tr-popup-spinner"></span>
        <span>翻译中…</span>
      </div>
    </div>
  `;

  // Close button
  popup.querySelector('.__tr-popup-close')?.addEventListener('click', () => dismiss());

  // Make draggable
  const header = popup.querySelector('.__tr-popup-header') as HTMLElement;
  if (header) makeDraggable(popup, header);

  return popup;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Public API
// ============================================

/**
 * Show the translation popup for the selected text near the selection anchor.
 */
export async function showTranslationPopup(
  text: string,
  anchorRect?: DOMRect,
): Promise<void> {
  // Dismiss any existing popup
  dismiss();

  // Inject styles
  injectStyles();

  const targetLangCode = await getTargetLang();
  const popup = createPopup(text, targetLangCode);
  document.body.appendChild(popup);
  popupEl = popup;
  isLoading = true;

  // Make draggable
  const headerEl = popup.querySelector('.__tr-popup-header') as HTMLElement;
  if (headerEl) makeDraggable(popup, headerEl);

  // Position near the selection or center of viewport
  const rect = anchorRect || getViewportCenter();
  positionPopup(popup, rect);

  // Click-outside listener
  setTimeout(() => {
    document.addEventListener('mousedown', onOutsideClick, { once: true });
  }, 0);

  // Start translation
  try {
    const result = await translate(text);
    if (!popupEl || popupEl !== popup) return; // dismissed while loading

    const body = popup.querySelector('.__tr-popup-body');
    if (body) {
      body.innerHTML = `<div class="__tr-popup-result">${escapeHtml(result)}</div>`;
    }

    // Show copy button
    const copyBtn = popup.querySelector('.__tr-popup-copy') as HTMLButtonElement | null;
    if (copyBtn) {
      copyBtn.style.display = '';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(result).catch(() => {
          // fallback
        });
        copyBtn.textContent = '✅ 已复制';
        setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
      });
    }

    isLoading = false;
  } catch (err) {
    if (!popupEl || popupEl !== popup) return;

    const message = err instanceof Error ? err.message : '翻译失败';
    const body = popup.querySelector('.__tr-popup-body');
    if (body) {
      body.innerHTML = `<div class="__tr-popup-error">❌ ${escapeHtml(message)}</div>`;
    }
    isLoading = false;
  }
}

function onOutsideClick(e: MouseEvent): void {
  if (!popupEl) return;
  const target = e.target as HTMLElement;
  if (!popupEl.contains(target)) {
    dismiss();
  } else {
    // Re-attach listener
    document.addEventListener('mousedown', onOutsideClick, { once: true });
  }
}

function getViewportCenter(): DOMRect {
  return new DOMRect(
    window.innerWidth / 2 - 150,
    window.innerHeight / 3,
    300,
    0,
  );
}

/**
 * Show a pre-translated result popup (no loading spinner).
 * Used by the background context menu handler.
 */
export function createResultPopup(
  sourceText: string,
  translatedText: string,
  anchorRect: DOMRect,
): void {
  dismiss();

  const popup = document.createElement('div');
  popup.className = '__tr-popup';

  popup.innerHTML = `
    <div class="__tr-popup-header">
      <div class="__tr-popup-header-left">
        <span>🌐 翻译</span>
      </div>
      <div>
        <button class="__tr-popup-copy" title="复制翻译结果">📋 复制</button>
        <button class="__tr-popup-close" title="关闭">×</button>
      </div>
    </div>
    <div class="__tr-popup-body">
      <div class="__tr-popup-source">${escapeHtml(sourceText.slice(0, 300))}${sourceText.length > 300 ? '…' : ''}</div>
      <div class="__tr-popup-result">${escapeHtml(translatedText)}</div>
    </div>
  `;

  document.body.appendChild(popup);
  popupEl = popup;

  // Position
  positionPopup(popup, anchorRect);

  // Close button
  popup.querySelector('.__tr-popup-close')?.addEventListener('click', () => dismiss());

  // Make draggable
  const headerR = popup.querySelector('.__tr-popup-header') as HTMLElement;
  if (headerR) makeDraggable(popup, headerR);

  // Copy button
  const copyBtn = popup.querySelector('.__tr-popup-copy') as HTMLButtonElement | null;
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(translatedText).catch(() => {});
      copyBtn.textContent = '✅ 已复制';
      setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
    });
  }

  // Click-outside listener
  setTimeout(() => {
    document.addEventListener('mousedown', onOutsideClick, { once: true });
  }, 0);
}

/**
 * Show an error popup.
 */
export function createErrorPopup(
  sourceText: string,
  errorMessage: string,
  anchorRect: DOMRect,
): void {
  dismiss();

  const popup = document.createElement('div');
  popup.className = '__tr-popup';

  popup.innerHTML = `
    <div class="__tr-popup-header">
      <div class="__tr-popup-header-left">
        <span>🌐 翻译</span>
      </div>
      <div>
        <button class="__tr-popup-close" title="关闭">×</button>
      </div>
    </div>
    <div class="__tr-popup-body">
      <div class="__tr-popup-source">${escapeHtml(sourceText.slice(0, 200))}</div>
      <div class="__tr-popup-error">❌ ${escapeHtml(errorMessage)}</div>
    </div>
  `;

  document.body.appendChild(popup);
  popupEl = popup;

  positionPopup(popup, anchorRect);

  popup.querySelector('.__tr-popup-close')?.addEventListener('click', () => dismiss());

  // Make draggable
  const headerE = popup.querySelector('.__tr-popup-header') as HTMLElement;
  if (headerE) makeDraggable(popup, headerE);

  setTimeout(() => {
    document.addEventListener('mousedown', onOutsideClick, { once: true });
  }, 0);
}

/**
 * Dismiss the current popup if visible.
 */
export function dismiss(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  if (popupEl) {
    popupEl.remove();
    popupEl = null;
  }
  isLoading = false;
}
