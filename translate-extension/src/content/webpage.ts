// Content script: webpage text selection translation.
//
// Injected into every page via manifest.json content_scripts.
// Listens for text selection and shows the translation popup.
// Handles both mouse selection and keyboard selection (Shift+Arrow keys).

import { showTranslationPopup, dismiss } from '../lib/ui';

// ============================================
// Configuration
// ============================================

/** Minimum characters selected to trigger translation */
const MIN_SELECTION_LENGTH = 2;

/** Debounce timer for selection changes */
let selectionTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 400;

// ============================================
// Selection handler
// ============================================

function getSelectedText(): string {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return '';
  return selection.toString().trim();
}

function getSelectionRect(): DOMRect | undefined {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return undefined;

  const range = selection.getRangeAt(0);
  const rects = range.getClientRects();

  if (rects.length > 0) {
    const first = rects[0];
    const last = rects[rects.length - 1];
    if (first && last) {
      return new DOMRect(
        first.left,
        first.top,
        last.right - first.left,
        last.bottom - first.top,
      );
    }
  }

  return undefined;
}

function onSelectionChange(): void {
  if (selectionTimer) clearTimeout(selectionTimer);

  selectionTimer = setTimeout(() => {
    const text = getSelectedText();

    if (text.length >= MIN_SELECTION_LENGTH) {
      const rect = getSelectionRect();
      // Dismiss any stale popup before showing new one
      dismiss();

      // Small delay so the user can see the selection highlight
      setTimeout(() => {
        const currentText = getSelectedText();
        if (currentText === text && currentText.length >= MIN_SELECTION_LENGTH) {
          showTranslationPopup(currentText, rect).catch(() => {
            // Translation failed — popup already shows error state
          });
        }
      }, 200);
    }
  }, DEBOUNCE_MS);
}

// ============================================
// Keyboard shortcut (Alt+T)
// ============================================

function onKeyDown(e: KeyboardEvent): void {
  // Alt+T or Cmd+Shift+T — translate current selection
  if ((e.altKey || (e.metaKey && e.shiftKey)) && e.key === 't') {
    e.preventDefault();
    const text = getSelectedText();
    if (text.length >= MIN_SELECTION_LENGTH) {
      const rect = getSelectionRect();
      showTranslationPopup(text, rect).catch(() => {});
    }
  }

  // Escape — dismiss popup
  if (e.key === 'Escape') {
    dismiss();
  }
}

// ============================================
// Initialization
// ============================================

document.addEventListener('selectionchange', onSelectionChange);
document.addEventListener('keydown', onKeyDown);

// Clean up when the popup is clicked outside — already handled in ui.ts
