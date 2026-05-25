// Content script: video subtitle/caption translation.
//
// Monitors <video> elements for WebVTT/VTT text tracks.
// When subtitles are active, this script captures the displayed text
// and can translate it on demand.
//
// Two modes:
//   A. Auto-capture — shows a floating translated-subtitle overlay
//   B. Manual — user clicks on a subtitle line to translate it

import { showTranslationPopup, dismiss } from '../lib/ui';

// ============================================
// Subtitle overlay (auto-translated captions)
// ============================================

let overlayEl: HTMLDivElement | null = null;
let overlayEnabled = false;
let currentSubtitleText = '';
let lastTranslated: { source: string; result: string } | null = null;

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

function onCueChange(this: TextTrack): void {
  const text = getActiveCueText(this);
  if (!text || text === currentSubtitleText) return;

  currentSubtitleText = text;

  if (overlayEnabled) {
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

  // Listen for subtitle click events (manual mode)
  document.addEventListener('click', onSubtitleClick, true);

  // Listen for keyboard toggle
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Alt+S — toggle subtitle overlay
    if (e.altKey && e.key === 's') {
      e.preventDefault();
      overlayEnabled = !overlayEnabled;
      if (!overlayEnabled) hideOverlay();
      console.log(`字幕翻译覆盖层: ${overlayEnabled ? '开启' : '关闭'}`);
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
      sendResponse({ enabled: overlayEnabled });
    }
    if (message.type === 'ENABLE_SUBTITLE_OVERLAY') {
      overlayEnabled = message.enabled ?? !overlayEnabled;
      if (!overlayEnabled) hideOverlay();
      sendResponse({ enabled: overlayEnabled });
    }
    return true;
  },
);

init();
