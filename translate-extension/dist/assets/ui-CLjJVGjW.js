import{t as _}from"./translator-Bpc-3k6W.js";import{a as m}from"./languages-CXtdqP6-.js";let r=null,l=!1;const f="__translate-popup-style__";function x(){if(document.getElementById(f))return;const e=document.createElement("style");e.id=f,e.textContent=`
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
  `,document.head.appendChild(e)}function b(e,o){const t=e.offsetHeight||200,p=e.offsetWidth||300,i=window.innerWidth,a=window.innerHeight;let n=o.bottom+10,s=o.left+o.width/2-p/2;n+t>a-10&&(n=o.top-t-10),s<10&&(s=10),s+p>i-10&&(s=i-p-10),n<10&&(n=10),e.style.top=`${n}px`,e.style.left=`${s}px`}async function y(){return new Promise(e=>{chrome.storage.sync.get(["targetLang"],o=>{e(o.targetLang||"zh-CN")})})}function h(e,o){var p;const d=m(o),t=document.createElement("div");return t.className="__tr-popup",t.innerHTML=`
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
      <div class="__tr-popup-source">${c(e.slice(0,300))}${e.length>300?"…":""}</div>
      <div class="__tr-popup-loading">
        <span class="__tr-popup-spinner"></span>
        <span>翻译中…</span>
      </div>
    </div>
  `,(p=t.querySelector(".__tr-popup-close"))==null||p.addEventListener("click",()=>u()),t}function c(e){const o=document.createElement("div");return o.textContent=e,o.innerHTML}async function L(e,o){u(),x();const d=await y(),t=h(e,d);document.body.appendChild(t),r=t,l=!0;const p=o||w();b(t,p),setTimeout(()=>{document.addEventListener("mousedown",g,{once:!0})},0);try{const i=await _(e);if(!r||r!==t)return;const a=t.querySelector(".__tr-popup-body");a&&(a.innerHTML=`<div class="__tr-popup-result">${c(i)}</div>`);const n=t.querySelector(".__tr-popup-copy");n&&(n.style.display="",n.addEventListener("click",()=>{navigator.clipboard.writeText(i).catch(()=>{}),n.textContent="✅ 已复制",setTimeout(()=>{n.textContent="📋 复制"},2e3)})),l=!1}catch(i){if(!r||r!==t)return;const a=i instanceof Error?i.message:"翻译失败",n=t.querySelector(".__tr-popup-body");n&&(n.innerHTML=`<div class="__tr-popup-error">❌ ${c(a)}</div>`),l=!1}}function g(e){if(!r)return;const o=e.target;r.contains(o)?document.addEventListener("mousedown",g,{once:!0}):u()}function w(){return new DOMRect(window.innerWidth/2-150,window.innerHeight/3,300,0)}function u(){r&&(r.remove(),r=null),l=!1}export{u as d,L as s};
