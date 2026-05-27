// Inline popup injection helpers — self-contained functions sent via
// chrome.scripting.executeScript so they work even on PDF viewer pages
// where content script messaging is unreliable.

// ============================================
// CSS (injected as a <style> element)
// ============================================

const POPUP_CSS = `
.__tr-popup *, .__tr-popup *::before, .__tr-popup *::after { all: unset; }
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
  box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08);
  padding: 0;
  overflow: hidden;
  animation: __tr-fade-in 0.15s ease-out;
}
@keyframes __tr-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.__tr-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #f7f7f7;
  border-bottom: 1px solid #eee;
  font-size: 12px;
  color: #666;
}
.__tr-popup-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
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
.__tr-popup-close:hover { background: #eee; color: #333; }
.__tr-popup-body {
  padding: 12px 14px;
  min-height: 30px;
  max-height: 360px;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
}
.__tr-popup-source {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #e8e8e8;
  color: #555;
  font-size: 13px;
  font-style: italic;
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.__tr-popup-result { color: #1a1a1a; }
.__tr-popup-error { color: #d93025; font-size: 13px; }
.__tr-popup-copy {
  cursor: pointer;
  border: none;
  background: none;
  font-size: 12px;
  color: #1a73e8;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}
.__tr-popup-copy:hover { background: #e8f0fe; }
.__tr-popup-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e0e0e0;
  border-top-color: #1a73e8;
  border-radius: 50%;
  animation: __tr-spin 0.6s linear infinite;
  display: inline-block;
}
@keyframes __tr-spin { to { transform: rotate(360deg); } }
`;

// ============================================
// Self-contained popup functions (no imports)
// ============================================

/**
 * Show a loading popup. Returns the popup element and its body div for later updates.
 * Call with translation '' to show the spinner; then update the body when translation arrives.
 */
export function createLoadingPopup(sourceText: string): { popup: HTMLElement; body: HTMLElement } {
  // Clean up any existing popup
  const existing = document.querySelector('.__tr-popup') as HTMLElement | null;
  if (existing) existing.remove();

  // Inject styles once
  if (!document.getElementById('__tr-popup-style')) {
    const style = document.createElement('style');
    style.id = '__tr-popup-style';
    style.textContent = POPUP_CSS;
    document.head.appendChild(style);
  }

  const escaped = escapeText(sourceText.slice(0, 300));
  const suffix = sourceText.length > 300 ? '…' : '';

  const popup = document.createElement('div');
  popup.className = '__tr-popup';
  popup.innerHTML =
    '<div class="__tr-popup-header">' +
    '<div class="__tr-popup-header-left"><span>🌐 翻译中…</span></div>' +
    '<div><button class="__tr-popup-close">×</button></div>' +
    '</div>' +
    '<div class="__tr-popup-body">' +
    '<div class="__tr-popup-source">' + escaped + suffix + '</div>' +
    '<div><span class="__tr-popup-spinner"></span> 翻译中…</div>' +
    '</div>';

  document.body.appendChild(popup);

  // Position near center of viewport
  popup.style.top = (window.innerHeight / 3) + 'px';
  popup.style.left = Math.max(10, (window.innerWidth - 520) / 2) + 'px';

  // Close button
  const closeBtn = popup.querySelector('.__tr-popup-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => popup.remove());
  }

  // Click outside to dismiss
  const onOutside = (e: MouseEvent) => {
    if (!popup.contains(e.target as Node)) {
      popup.remove();
      document.removeEventListener('mousedown', onOutside);
    } else {
      document.addEventListener('mousedown', onOutside, { once: true });
    }
  };
  setTimeout(() => document.addEventListener('mousedown', onOutside, { once: true }), 0);

  const body = popup.querySelector('.__tr-popup-body') as HTMLElement;
  return { popup, body };
}

/**
 * Update a loading popup with the translation result.
 */
export function updatePopupResult(body: HTMLElement, sourceText: string, translation: string): void {
  const escapedSrc = escapeText(sourceText.slice(0, 300));
  const srcSuffix = sourceText.length > 300 ? '…' : '';
  const escapedTr = escapeText(translation);

  body.innerHTML =
    '<div class="__tr-popup-source">' + escapedSrc + srcSuffix + '</div>' +
    '<div class="__tr-popup-result">' + escapedTr + '</div>';

  // Add copy button to header
  const popup = body.closest('.__tr-popup');
  if (popup) {
    const header = popup.querySelector('.__tr-popup-header');
    if (header) {
      const headerLeft = header.querySelector('.__tr-popup-header-left');
      if (headerLeft) headerLeft.innerHTML = '<span>🌐 翻译</span>';

      const copyBtn = document.createElement('button');
      copyBtn.className = '__tr-popup-copy';
      copyBtn.textContent = '📋 复制';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(translation).catch(() => {});
        copyBtn.textContent = '✅ 已复制';
        setTimeout(() => { copyBtn.textContent = '📋 复制'; }, 2000);
      });
      const closeBtn = header.querySelector('.__tr-popup-close');
      if (closeBtn) {
        header.insertBefore(copyBtn, closeBtn);
      } else {
        header.appendChild(copyBtn);
      }
    }
  }
}

/**
 * Update a loading popup with an error message.
 */
export function updatePopupError(body: HTMLElement, sourceText: string, error: string): void {
  const escapedSrc = escapeText(sourceText.slice(0, 200));
  const escapedErr = escapeText(error);

  body.innerHTML =
    '<div class="__tr-popup-source">' + escapedSrc + '</div>' +
    '<div class="__tr-popup-error">❌ ' + escapedErr + '</div>';

  const popup = body.closest('.__tr-popup');
  if (popup) {
    const headerLeft = popup.querySelector('.__tr-popup-header-left');
    if (headerLeft) headerLeft.innerHTML = '<span>🌐 翻译失败</span>';
  }
}

// ============================================
// Helpers
// ============================================

function escapeText(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
