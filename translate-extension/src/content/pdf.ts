// Content script: PDF text selection translation.
//
// Injected into PDF pages viewed in the browser's built-in PDF viewer.
// Modern browsers (Chrome/Edge/Firefox) render PDFs via an embedded viewer
// that creates a text layer for selection. This script hooks into that layer.
//
// The browser PDF viewer uses:
//   - Chrome/Edge: <embed> with type="application/pdf"; text layer in shadow DOM
//   - Firefox: pdf.js embedded directly in the page

import { showTranslationPopup, dismiss } from '../lib/ui';

const MIN_SELECTION_LENGTH = 2;
let selectionTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================
// Detection
// ============================================

function isPdfPage(): boolean {
  // Chrome/Edge PDF viewer
  if (document.querySelector('embed[type="application/pdf"]')) return true;
  // Firefox PDF viewer
  if (document.querySelector('#viewer.pdfViewer')) return true;
  // Generic: URL ends with .pdf
  if (window.location.pathname.toLowerCase().endsWith('.pdf')) return true;
  return false;
}

// ============================================
// Text extraction from PDF text layer
// ============================================

function getPdfSelectedText(): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return '';

  // For Chrome/Edge: text layer is inside an embed element
  // The selection API works across shadow DOM boundaries for getSelection()
  const text = selection.toString().trim();
  return text;
}

function getPdfSelectionRect(): DOMRect | undefined {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();
  if (rects.length === 0) return undefined;

  const first = rects[0];
  const last = rects[rects.length - 1];
  if (!first || !last) return undefined;

  return new DOMRect(
    first.left,
    first.top,
    last.right - first.left,
    last.bottom - first.top,
  );
}

// ============================================
// Handlers
// ============================================

function onSelectionChange(): void {
  if (!isPdfPage()) return;
  if (selectionTimer) clearTimeout(selectionTimer);

  selectionTimer = setTimeout(() => {
    const text = getPdfSelectedText();
    if (text.length >= MIN_SELECTION_LENGTH) {
      const rect = getPdfSelectionRect();
      dismiss();
      setTimeout(() => {
        const currentText = getPdfSelectedText();
        if (currentText === text && currentText.length >= MIN_SELECTION_LENGTH) {
          showTranslationPopup(currentText, rect).catch(() => {});
        }
      }, 200);
    }
  }, 400);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') dismiss();
}

// ============================================
// Initialization
// ============================================

// Only activate on PDF pages
if (isPdfPage()) {
  document.addEventListener('selectionchange', onSelectionChange);
  document.addEventListener('keydown', onKeyDown);

  // Also try to hook into iframes and embed elements
  const observer = new MutationObserver(() => {
    // The PDF text layer might appear asynchronously
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
