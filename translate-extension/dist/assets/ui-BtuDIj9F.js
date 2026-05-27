import{t as m}from"./translator-Bpc-3k6W.js";import{a as v}from"./languages-CXtdqP6-.js";let r=null,u=!1;const g="__translate-popup-style__";function b(){if(document.getElementById(g))return;const t=document.createElement("style");t.id=g,t.textContent=`
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
    .__tr-popup-result {
      color: #1a1a1a;
    }
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
    .__tr-popup-copy:hover {
      background: #e8f0fe;
    }
  `,document.head.appendChild(t)}function f(t,o){const e=t.offsetHeight||200,p=t.offsetWidth||300,i=window.innerWidth,c=window.innerHeight;let n=o.bottom+10,l=o.left+o.width/2-p/2;n+e>c-10&&(n=o.top-e-10),l<10&&(l=10),l+p>i-10&&(l=i-p-10),n<10&&(n=10),t.style.top=`${n}px`,t.style.left=`${l}px`}async function x(){return new Promise(t=>{chrome.storage.sync.get(["targetLang"],o=>{t(o.targetLang||"zh-CN")})})}function y(t,o){var p;const a=v(o),e=document.createElement("div");return e.className="__tr-popup",e.innerHTML=`
    <div class="__tr-popup-header">
      <div class="__tr-popup-header-left">
        <span>🌐 翻译为</span>
        <span class="__tr-popup-lang-tag">${a}</span>
      </div>
      <div>
        <button class="__tr-popup-copy" title="复制翻译结果" style="display:none">📋 复制</button>
        <button class="__tr-popup-close" title="关闭">×</button>
      </div>
    </div>
    <div class="__tr-popup-body">
      <div class="__tr-popup-source">${s(t.slice(0,300))}${t.length>300?"…":""}</div>
      <div class="__tr-popup-loading">
        <span class="__tr-popup-spinner"></span>
        <span>翻译中…</span>
      </div>
    </div>
  `,(p=e.querySelector(".__tr-popup-close"))==null||p.addEventListener("click",()=>d()),e}function s(t){const o=document.createElement("div");return o.textContent=t,o.innerHTML}async function k(t,o){d(),b();const a=await x(),e=y(t,a);document.body.appendChild(e),r=e,u=!0;const p=o||h();f(e,p),setTimeout(()=>{document.addEventListener("mousedown",_,{once:!0})},0);try{const i=await m(t);if(!r||r!==e)return;const c=e.querySelector(".__tr-popup-body");c&&(c.innerHTML=`<div class="__tr-popup-result">${s(i)}</div>`);const n=e.querySelector(".__tr-popup-copy");n&&(n.style.display="",n.addEventListener("click",()=>{navigator.clipboard.writeText(i).catch(()=>{}),n.textContent="✅ 已复制",setTimeout(()=>{n.textContent="📋 复制"},2e3)})),u=!1}catch(i){if(!r||r!==e)return;const c=i instanceof Error?i.message:"翻译失败",n=e.querySelector(".__tr-popup-body");n&&(n.innerHTML=`<div class="__tr-popup-error">❌ ${s(c)}</div>`),u=!1}}function _(t){if(!r)return;const o=t.target;r.contains(o)?document.addEventListener("mousedown",_,{once:!0}):d()}function h(){return new DOMRect(window.innerWidth/2-150,window.innerHeight/3,300,0)}function E(t,o,a){var i;d();const e=document.createElement("div");e.className="__tr-popup",e.innerHTML=`
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
      <div class="__tr-popup-source">${s(t.slice(0,300))}${t.length>300?"…":""}</div>
      <div class="__tr-popup-result">${s(o)}</div>
    </div>
  `,document.body.appendChild(e),r=e,f(e,a),(i=e.querySelector(".__tr-popup-close"))==null||i.addEventListener("click",()=>d());const p=e.querySelector(".__tr-popup-copy");p&&p.addEventListener("click",()=>{navigator.clipboard.writeText(o).catch(()=>{}),p.textContent="✅ 已复制",setTimeout(()=>{p.textContent="📋 复制"},2e3)}),setTimeout(()=>{document.addEventListener("mousedown",_,{once:!0})},0)}function C(t,o,a){var p;d();const e=document.createElement("div");e.className="__tr-popup",e.innerHTML=`
    <div class="__tr-popup-header">
      <div class="__tr-popup-header-left">
        <span>🌐 翻译</span>
      </div>
      <div>
        <button class="__tr-popup-close" title="关闭">×</button>
      </div>
    </div>
    <div class="__tr-popup-body">
      <div class="__tr-popup-source">${s(t.slice(0,200))}</div>
      <div class="__tr-popup-error">❌ ${s(o)}</div>
    </div>
  `,document.body.appendChild(e),r=e,f(e,a),(p=e.querySelector(".__tr-popup-close"))==null||p.addEventListener("click",()=>d()),setTimeout(()=>{document.addEventListener("mousedown",_,{once:!0})},0)}function d(){r&&(r.remove(),r=null),u=!1}export{C as createErrorPopup,E as createResultPopup,d as dismiss,b as injectStyles,k as showTranslationPopup};
