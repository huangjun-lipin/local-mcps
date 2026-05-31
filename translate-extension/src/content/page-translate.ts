// Content script: full-page translation engine.
// Injected into every page. Listens for START_PAGE_TRANSLATE / RESTORE_PAGE_TRANSLATE messages.
// Walks text nodes, batch-translates via background, replaces in-place.

// ============================================
// Types
// ============================================

interface TransNode {
  node: Text;
  original: string;
}

// ============================================
// State
// ============================================

let nodes: TransNode[] = [];
let toolbar: HTMLElement | null = null;
let isTranslating = false;

// ============================================
// Filters
// ============================================

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'VAR',
  'SAMP', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  'SVG', 'MATH', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED',
  'AUDIO', 'VIDEO', 'IMG',
]);

function shouldSkipText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 4 && !/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(t)) return true;
  if (/^[\d.,%$€£¥+\-×÷=<>()[\]{}]+$/.test(t)) return true;
  if (/^(https?:\/\/|ftp:\/\/|mailto:|\/\/|www\.)/i.test(t)) return true;
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(t)) return true;
  if (/^[a-zA-Z0-9_]{1,3}$/.test(t)) return true;
  if (/^[a-z]+([A-Z][a-z]*)+$/.test(t) && t.length < 20) return true;
  return false;
}

function isExcluded(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.getAttribute('translate') === 'no') return true;
  if (el.closest('[contenteditable="true"]')) return true;
  const cls = (typeof el.className === 'string') ? el.className : '';
  if (/\b(code|pre|hljs|prism|syntax|token|keyword)\b/i.test(cls)) return true;
  return false;
}

// ============================================
// DOM walking
// ============================================

function collectTextNodes(root: Element): Text[] {
  const result: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n: Text): number {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (isExcluded(p)) return NodeFilter.FILTER_REJECT;
      if (shouldSkipText(n.textContent || '')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) result.push(node);
  return result;
}

// ============================================
// Toolbar
// ============================================

function showToolbar(targetLang: string, total: number): void {
  removeToolbar();
  const bar = document.createElement('div');
  bar.id = '__tr-page-toolbar';
  bar.style.cssText =
    'position:fixed;top:0;left:0;right:0;z-index:2147483646;display:flex;align-items:center;' +
    'justify-content:center;gap:16px;padding:8px 16px;' +
    'background:linear-gradient(135deg,#1a73e8,#4285f4);color:#fff;font-size:13px;' +
    'font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,0.15);';
  bar.innerHTML =
    '<span>🌐 已翻译为 ' + esc(targetLang) + '</span>' +
    '<span id="__tr-pp">0 / ' + total + '</span>' +
    '<button id="__tr-pr" style="cursor:pointer;border:1px solid rgba(255,255,255,0.4);' +
    'background:rgba(255,255,255,0.15);color:#fff;padding:4px 14px;border-radius:4px;font-size:12px;">↩ 还原原文</button>' +
    '<button id="__tr-pc" style="cursor:pointer;border:none;background:none;color:rgba(255,255,255,0.7);' +
    'font-size:16px;padding:2px 6px;">×</button>';
  document.body.prepend(bar);
  toolbar = bar;

  document.getElementById('__tr-pr')?.addEventListener('click', restorePage);
  document.getElementById('__tr-pc')?.addEventListener('click', removeToolbar);
}

function updateProgress(done: number, total: number): void {
  const el = document.getElementById('__tr-pp');
  if (el) el.textContent = done + ' / ' + total;
}

function finishProgress(total: number): void {
  const el = document.getElementById('__tr-pp');
  if (el) el.textContent = '✅ 完成 ' + total + ' 段';
}

function removeToolbar(): void {
  if (toolbar) { toolbar.remove(); toolbar = null; }
}

// ============================================
// Translation
// ============================================

async function translateBatch(texts: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'TRANSLATE_BATCH', texts },
      (response: { translations?: string[]; error?: string }) => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (response?.error) { reject(new Error(response.error)); return; }
        resolve(response?.translations || texts.map(() => ''));
      },
    );
  });
}

async function startTranslation(targetLang: string): Promise<void> {
  if (isTranslating) return;
  if (nodes.length > 0) restorePage();

  await new Promise(r => setTimeout(r, 100));

  const allNodes = collectTextNodes(document.body);
  if (allNodes.length === 0) {
    alert('当前页面无可翻译的文字内容。');
    return;
  }

  // Sort visible first
  const vh = window.innerHeight;
  const ordered = allNodes.sort((a, b) => {
    const ra = (() => { const r = document.createRange(); r.selectNodeContents(a); return r.getBoundingClientRect(); })();
    const rb = (() => { const r = document.createRange(); r.selectNodeContents(b); return r.getBoundingClientRect(); })();
    const aVis = ra.top > -100 && ra.top < vh + 100 && ra.height > 0;
    const bVis = rb.top > -100 && rb.top < vh + 100 && rb.height > 0;
    return aVis === bVis ? 0 : aVis ? -1 : 1;
  });

  nodes = ordered.map(n => ({ node: n, original: n.textContent || '' }));
  isTranslating = true;
  showToolbar(targetLang, ordered.length);

  const BATCH = 8;
  let done = 0;

  for (let i = 0; i < ordered.length; i += BATCH) {
    const slice = ordered.slice(i, i + BATCH);
    const texts = slice.map(n => n.textContent || '');

    try {
      const translations = await translateBatch(texts);
      for (let j = 0; j < slice.length; j++) {
        const node = slice[j];
        const tr = translations[j];
        if (node && tr && tr.trim()) node.textContent = tr;
      }
    } catch (err) {
      console.error('[Page Translator] Batch error:', err);
    }

    done += slice.length;
    updateProgress(done, ordered.length);

    await new Promise(r => requestAnimationFrame(() => r(undefined)));
    if (i + BATCH < ordered.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  isTranslating = false;
  finishProgress(ordered.length);
}

// ============================================
// Restore
// ============================================

function restorePage(): void {
  for (const { node, original } of nodes) {
    node.textContent = original;
  }
  nodes = [];
  isTranslating = false;
  removeToolbar();
}

// ============================================
// Helpers
// ============================================

function esc(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ============================================
// Message listener
// ============================================

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_PAGE_TRANSLATE') {
    const targetLang = (msg as { targetLang: string }).targetLang || 'zh-CN';
    startTranslation(targetLang).catch(console.error);
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'RESTORE_PAGE_TRANSLATE') {
    restorePage();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'GET_PAGE_TRANSLATE_STATE') {
    sendResponse({ active: nodes.length > 0, count: nodes.length });
    return true;
  }
  return false;
});
