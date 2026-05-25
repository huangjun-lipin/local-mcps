import{D as m}from"./languages-BF5jYfNl.js";const p="https://api.openai.com/v1/chat/completions",l="gpt-4o-mini";async function g(){const t=await chrome.storage.sync.get(["apiUrl","apiKey","model","targetLang"]);return{apiUrl:t.apiUrl||p,apiKey:t.apiKey||"",model:t.model||l,targetLang:t.targetLang||m}}async function f(t){var r,n,s,i;const e=await g();if(!e.apiKey)throw new Error("请先在扩展设置中配置 API Key");if(!t||t.trim().length===0)return"";const o=await fetch(e.apiUrl,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e.apiKey}`},body:JSON.stringify({model:e.model,messages:[{role:"system",content:`你是一个专业的翻译助手。将用户提供的文字翻译成目标语言。
规则：
1. 只输出翻译结果，不要添加任何解释、注释或元信息
2. 保持原文的语气和风格
3. 保留原文中的技术术语和专有名词的格式
4. 如果是代码片段、数字、URL等，保持原样`},{role:"user",content:`将以下文字翻译成目标语言，只输出翻译结果：

${t}`}],max_tokens:2e3,temperature:.1})});if(!o.ok){const c=await o.text().catch(()=>"");throw new Error(`翻译请求失败 (${o.status}): ${c.slice(0,200)}`)}const a=(i=(s=(n=(r=(await o.json()).choices)==null?void 0:r[0])==null?void 0:n.message)==null?void 0:s.content)==null?void 0:i.trim();if(!a)throw new Error("翻译API返回了空内容");return a}export{f as t};
