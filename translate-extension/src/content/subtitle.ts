// Content script: video subtitle/caption translation.
//
// Two detection strategies:
//   1. Native TextTrack API — for <track>-based subtitles (self-hosted videos)
//   2. DOM polling — for platforms that render captions in custom DOM
//      (YouTube, extensible via CAPTION_SOURCES below)
//
// Two modes:
//   A. Auto-capture — shows a floating translated-subtitle overlay
//   B. Manual — user clicks on a subtitle line to translate it

import { showTranslationPopup, dismiss } from '../lib/ui';

// ============================================
// Platform caption sources (DOM-based)
// ============================================

interface CaptionSource {
  name: string;
  containerSelector: string;
  textSelector: string;
}

const CAPTION_SOURCES: CaptionSource[] = [
  {
    name: 'YouTube',
    containerSelector: '.ytp-caption-window-container',
    textSelector: '.ytp-caption-segment',
  },
  // Extend for other platforms:
  // { name: 'Bilibili', containerSelector: '.bpx-player-subtitle-text', textSelector: '.bpx-player-subtitle-text' },
  // { name: 'Netflix', containerSelector: '.player-timedtext-text-container', textSelector: 'span' },
];

// ============================================
// Subtitle overlay (auto-translated captions)
// ============================================

let overlayEl: HTMLDivElement | null = null;
let overlayEnabled = false;
let currentSubtitleText = '';
let lastTranslated: { source: string; result: string } | null = null;

// DOM polling state
let domPollTimer: ReturnType<typeof setInterval> | null = null;
let lastDOMCaptionText = '';

const OVERLAY_ID = '__tr-subtitle-overlay__';

function getOrCreateOverlay(): HTMLDivElement {
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = OVERLAY_ID;
    overlayEl.style.cssText = `
      all: initial;
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      max-width: 720px;
      padding: 8px 16px;
      background: rgba(0,0,0,0.82);
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.5;
      border-radius: 8px;
      text-align: center;
      pointer-events: none;
      display: none;
      backdrop-filter: blur(4px);
    `;
    document.body.appendChild(overlayEl);
  }
  return overlayEl;
}

function showOverlay(text: string): void {
  const el = getOrCreateOverlay();
  el.textContent = text;
  el.style.display = '';
}

function hideOverlay(): void {
  if (overlayEl) {
    overlayEl.style.display = 'none';
  }
}

// ============================================
// Text track monitoring
// ============================================

function getActiveCueText(track: TextTrack): string {
  if (!track.activeCues || track.activeCues.length === 0) return '';

  const texts: string[] = [];
  for (let i = 0; i < track.activeCues.length; i++) {
    const cue = track.activeCues[i];
    if (cue && 'text' in cue) {
      texts.push((cue as VTTCue).text);
    }
  }
  return texts.join(' ').trim();
}

// Shared handler: translate text and show overlay.
// Used by both TextTrack cuechange and DOM polling.
function onSubtitleText(text: string): void {
  if (!overlayEnabled) return;

  // Try to use cached translation if the same text
  if (lastTranslated && lastTranslated.source === text) {
    showOverlay(lastTranslated.result);
    return;
  }

  // Send to background for translation
  chrome.runtime
    .sendMessage({ type: 'TRANSLATE_SUBTITLE', text })
    .then((response: { translation?: string; error?: string }) => {
      if (response?.translation) {
        lastTranslated = { source: text, result: response.translation };
        showOverlay(response.translation);
      }
    })
    .catch(() => {
      // background not ready — ignore
    });
}

function onCueChange(this: TextTrack): void {
  const text = getActiveCueText(this);
  if (!text || text === currentSubtitleText) return;

  currentSubtitleText = text;
  onSubtitleText(text);
}

function monitorVideoTracks(video: HTMLVideoElement): void {
  // Listen for track additions
  for (let i = 0; i < video.textTracks.length; i++) {
    const track = video.textTracks[i];
    if (track) {
      track.addEventListener('cuechange', onCueChange as EventListener);
    }
  }

  // Watch for dynamically added tracks
  video.addEventListener('addtrack', ((e: TrackEvent) => {
    if (e.track && e.track.kind === 'subtitles') {
      e.track.addEventListener('cuechange', onCueChange as EventListener);
    }
  }) as EventListener);
}

// ============================================
// DOM-based caption polling (YouTube, etc.)
// ============================================

/**
 * Return true when the element is actually visible to the user.
 * Avoids expensive reflows by checking cheap signals first.
 */
function isElementVisible(el: HTMLElement): boolean {
  // 1. Fast path: not in layout tree → invisible
  if (el.offsetParent === null && getComputedStyle(el).display === 'none') return false;

  // 2. Explicitly hidden
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.opacity === '0') return false;

  // 3. Zero-size (both dimensions)
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  return true;
}

function getDOMCaptionText(): string {
  for (const source of CAPTION_SOURCES) {
    // Strategy A — scoped search inside the platform container (faster when it exists)
    const container = document.querySelector(source.containerSelector);
    if (container && isElementVisible(container as HTMLElement)) {
      const segments = container.querySelectorAll(source.textSelector);
      const texts: string[] = [];
      segments.forEach((seg) => {
        const el = seg as HTMLElement;
        if (!isElementVisible(el)) return;
        const t = el.textContent?.trim();
        if (t) texts.push(t);
      });
      if (texts.length > 0) return texts.join(' ');
      continue; // container found but no visible segments — don't fall through
    }

    // Strategy B — direct search for caption segments anywhere in the document
    // (handles platforms where the container is inside shadow DOM, renamed, etc.)
    const allSegments = document.querySelectorAll(source.textSelector);
    const texts: string[] = [];
    allSegments.forEach((seg) => {
      const el = seg as HTMLElement;
      if (!isElementVisible(el)) return;
      const t = el.textContent?.trim();
      if (t) texts.push(t);
    });
    if (texts.length > 0) return texts.join(' ');
  }
  return '';
}

function onDOMCaptionTick(): void {
  const text = getDOMCaptionText();

  // Reset tracking when captions disappear
  if (!text) {
    lastDOMCaptionText = '';
    return;
  }

  if (text === lastDOMCaptionText) return;
  lastDOMCaptionText = text;

  // Sync shared state and translate
  currentSubtitleText = text;
  onSubtitleText(text);
}

function startDOMPolling(): void {
  if (domPollTimer) return;
  domPollTimer = setInterval(onDOMCaptionTick, 400);
}

function stopDOMPolling(): void {
  if (domPollTimer) {
    clearInterval(domPollTimer);
    domPollTimer = null;
  }
  lastDOMCaptionText = '';
}

// ============================================
// Click-to-translate mode
// ============================================

function onSubtitleClick(e: MouseEvent): void {
  const target = e.target as HTMLElement;

  // Check if clicked on a WebVTT cue element (browser-specific)
  // Common selectors for subtitle display elements
  const cueSelectors = [
    '::cue', // pseudo-element, not directly targetable
    '.vjs-text-track-display', // Video.js
    '.ytp-caption-segment', // YouTube
    '[data-subtitle]',
    '.subtitle-text',
  ];

  // Try to get subtitle text from the target or its parent
  let subtitleText = '';
  for (const sel of cueSelectors) {
    try {
      const el = target.closest(sel);
      if (el) {
        subtitleText = (el.textContent || '').trim();
        break;
      }
    } catch {
      // selector invalid
    }
  }

  if (subtitleText && subtitleText.length > 2) {
    e.preventDefault();
    e.stopPropagation();
    showTranslationPopup(subtitleText).catch(() => {});
  }
}

// ============================================
// Initialization
// ============================================

function init(): void {
  // Restore overlay state from storage (survives page reloads)
  chrome.storage.sync.get(['subtitleOverlay'], (result) => {
    if (result.subtitleOverlay === true) {
      overlayEnabled = true;
    }
  });

  // Listen for storage changes so popup toggles sync in real-time
  chrome.storage.onChanged.addListener((changes) => {
    if (changes['subtitleOverlay']) {
      overlayEnabled = changes['subtitleOverlay'].newValue === true;
      if (!overlayEnabled) hideOverlay();
    }
  });

  // Find existing video elements
  const videos = document.querySelectorAll('video');
  videos.forEach(monitorVideoTracks);

  // Watch for new video elements
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLVideoElement) {
          monitorVideoTracks(node);
        }
        if (node instanceof HTMLElement) {
          node.querySelectorAll('video').forEach(monitorVideoTracks);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Start DOM-based caption polling (YouTube, etc.)
  startDOMPolling();

  // Listen for subtitle click events (manual mode)
  document.addEventListener('click', onSubtitleClick, true);

  // Listen for keyboard toggle
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Alt+S — toggle subtitle overlay
    if (e.altKey && e.key === 's') {
      e.preventDefault();
      overlayEnabled = !overlayEnabled;
      if (!overlayEnabled) hideOverlay();
      // Persist the change so the popup checkbox stays in sync
      chrome.storage.sync.set({ subtitleOverlay: overlayEnabled }).catch(() => {});
    }

    if (e.key === 'Escape') {
      dismiss();
    }
  });
}

// ============================================
// Message from background/popup
// ============================================

chrome.runtime.onMessage.addListener(
  (message: { type: string; enabled?: boolean }, _sender, sendResponse) => {
    if (message.type === 'TOGGLE_SUBTITLE_OVERLAY') {
      overlayEnabled = message.enabled ?? !overlayEnabled;
      if (!overlayEnabled) hideOverlay();
      if (overlayEnabled) startDOMPolling();
      else stopDOMPolling();
      sendResponse({ enabled: overlayEnabled });
    }
    if (message.type === 'ENABLE_SUBTITLE_OVERLAY') {
      overlayEnabled = message.enabled ?? !overlayEnabled;
      if (!overlayEnabled) hideOverlay();
      if (overlayEnabled) startDOMPolling();
      else stopDOMPolling();
      sendResponse({ enabled: overlayEnabled });
    }
    return true;
  },
);

init();
