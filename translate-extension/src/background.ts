// Background Service Worker — handles translation requests and config management.

import { translate } from './lib/translator';

// ============================================
// Install / startup
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  // Set default config
  chrome.storage.sync.get(['targetLang', 'apiUrl', 'apiKey', 'model'], (items) => {
    const defaults: Record<string, string> = {};
    if (!items['targetLang']) defaults['targetLang'] = 'zh-CN';
    if (!items['apiUrl']) defaults['apiUrl'] = 'https://api.openai.com/v1/chat/completions';
    if (!items['model']) defaults['model'] = 'gpt-4o-mini';
    if (Object.keys(defaults).length > 0) {
      chrome.storage.sync.set(defaults);
    }
  });
});

// ============================================
// Message handler
// ============================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'TRANSLATE') {
    handleTranslate(message.text)
      .then((result) => sendResponse({ translation: result }))
      .catch((err) => sendResponse({ error: err instanceof Error ? err.message : '翻译失败' }));
    return true; // async response
  }

  if (message.type === 'TRANSLATE_SUBTITLE') {
    handleTranslate(message.text)
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

// ============================================
// Translation helper (runs in SW context)
// ============================================

async function handleTranslate(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return '';
  return translate(text);
}
