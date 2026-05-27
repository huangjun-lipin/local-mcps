import{t as b}from"./translator-f8nY_rcK.js";import{a as v}from"./languages-s6Qk9-53.js";let s=null,u=!1;const m="__translate-popup-style__";function y(){if(document.getElementById(m))return;const t=document.createElement("style");t.id=m,t.textContent=`
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
  `,document.head.appendChild(t)}function g(t,o){const e=t.offsetHeight||200,p=t.offsetWidth||300,i=window.innerWidth,a=window.innerHeight;let n=o.bottom+10,r=o.left+o.width/2-p/2;n+e>a-10&&(n=o.top-e-10),r<10&&(r=10),r+p>i-10&&(r=i-p-10),n<10&&(n=10),t.style.top=`${n}px`,t.style.left=`${r}px`}function _(t,o){let d=0,e=0,p=0,i=0,a=!1;o.addEventListener("pointerdown",n=>{const r=n.target;r&&(r.classList.contains("__tr-popup-close")||r.classList.contains("__tr-popup-copy"))||(a=!0,d=n.clientX,e=n.clientY,p=t.offsetLeft,i=t.offsetTop,o.setPointerCapture(n.pointerId),n.preventDefault())}),o.addEventListener("pointermove",n=>{if(!a)return;const r=n.clientX-d,h=n.clientY-e;t.style.left=Math.max(0,Math.min(window.innerWidth-t.offsetWidth,p+r))+"px",t.style.top=Math.max(0,Math.min(window.innerHeight-t.offsetHeight,i+h))+"px"}),o.addEventListener("pointerup",()=>{a=!1}),o.addEventListener("pointercancel",()=>{a=!1})}async function x(){return new Promise(t=>{chrome.storage.sync.get(["targetLang"],o=>{t(o.targetLang||"zh-CN")})})}function w(t,o){var i;const d=v(o),e=document.createElement("div");e.className="__tr-popup",e.innerHTML=`
    <div class="__tr-popup-header">
      <div class="__tr-popup-header-left">
        <span>🌐 翻译为</span>
        <span class="__tr-popup-lang-tag">${d}</span>
      </div>
      <div>
        <button class="__tr-popup-copy" title="复制翻译结果" style="display:none">📋 复制</button>
        <button class="__tr-popup-close" title="关闭">×</button>
      </div>
    </div>
    <div class="__tr-popup-body">
      <div class="__tr-popup-source">${c(t.slice(0,300))}${t.length>300?"…":""}</div>
      <div class="__tr-popup-loading">
        <span class="__tr-popup-spinner"></span>
        <span>翻译中…</span>
      </div>
    </div>
  `,(i=e.querySelector(".__tr-popup-close"))==null||i.addEventListener("click",()=>l());const p=e.querySelector(".__tr-popup-header");return p&&_(e,p),e}function c(t){const o=document.createElement("div");return o.textContent=t,o.innerHTML}async function C(t,o){l(),y();const d=await x(),e=w(t,d);document.body.appendChild(e),s=e,u=!0;const p=e.querySelector(".__tr-popup-header");p&&_(e,p);const i=o||L();g(e,i),setTimeout(()=>{document.addEventListener("mousedown",f,{once:!0})},0);try{const a=await b(t);if(!s||s!==e)return;const n=e.querySelector(".__tr-popup-body");n&&(n.innerHTML=`<div class="__tr-popup-result">${c(a)}</div>`);const r=e.querySelector(".__tr-popup-copy");r&&(r.style.display="",r.addEventListener("click",()=>{navigator.clipboard.writeText(a).catch(()=>{}),r.textContent="✅ 已复制",setTimeout(()=>{r.textContent="📋 复制"},2e3)})),u=!1}catch(a){if(!s||s!==e)return;const n=a instanceof Error?a.message:"翻译失败",r=e.querySelector(".__tr-popup-body");r&&(r.innerHTML=`<div class="__tr-popup-error">❌ ${c(n)}</div>`),u=!1}}function f(t){if(!s)return;const o=t.target;s.contains(o)?document.addEventListener("mousedown",f,{once:!0}):l()}function L(){return new DOMRect(window.innerWidth/2-150,window.innerHeight/3,300,0)}function S(t,o,d){var a;l();const e=document.createElement("div");e.className="__tr-popup",e.innerHTML=`
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
      <div class="__tr-popup-source">${c(t.slice(0,300))}${t.length>300?"…":""}</div>
      <div class="__tr-popup-result">${c(o)}</div>
    </div>
  `,document.body.appendChild(e),s=e,g(e,d),(a=e.querySelector(".__tr-popup-close"))==null||a.addEventListener("click",()=>l());const p=e.querySelector(".__tr-popup-header");p&&_(e,p);const i=e.querySelector(".__tr-popup-copy");i&&i.addEventListener("click",()=>{navigator.clipboard.writeText(o).catch(()=>{}),i.textContent="✅ 已复制",setTimeout(()=>{i.textContent="📋 复制"},2e3)}),setTimeout(()=>{document.addEventListener("mousedown",f,{once:!0})},0)}function H(t,o,d){var i;l();const e=document.createElement("div");e.className="__tr-popup",e.innerHTML=`
    <div class="__tr-popup-header">
      <div class="__tr-popup-header-left">
        <span>🌐 翻译</span>
      </div>
      <div>
        <button class="__tr-popup-close" title="关闭">×</button>
      </div>
    </div>
    <div class="__tr-popup-body">
      <div class="__tr-popup-source">${c(t.slice(0,200))}</div>
      <div class="__tr-popup-error">❌ ${c(o)}</div>
    </div>
  `,document.body.appendChild(e),s=e,g(e,d),(i=e.querySelector(".__tr-popup-close"))==null||i.addEventListener("click",()=>l());const p=e.querySelector(".__tr-popup-header");p&&_(e,p),setTimeout(()=>{document.addEventListener("mousedown",f,{once:!0})},0)}function l(){s&&(s.remove(),s=null),u=!1}export{H as createErrorPopup,S as createResultPopup,l as dismiss,y as injectStyles,C as showTranslationPopup};
