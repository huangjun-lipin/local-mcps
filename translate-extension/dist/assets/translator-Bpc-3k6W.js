import{g as l,D as y}from"./languages-CXtdqP6-.js";const L="https://api.openai.com/v1/chat/completions",h="gpt-4o-mini";async function d(){const t=await chrome.storage.sync.get(["apiUrl","apiKey","model","targetLang"]);return{apiUrl:t.apiUrl||L,apiKey:t.apiKey||"",model:t.model||h,targetLang:t.targetLang||y}}async function u(t){var s,i,c,g;const e=await d();if(!e.apiKey)throw new Error("请先在扩展设置中配置 API Key");if(!t||t.trim().length===0)return"";const n=l(e.targetLang),o=n?`${n.nativeName} (${n.name})`:e.targetLang,m=`你是一个专业的翻译助手。你的任务是将用户提供的任何文字翻译成${o}。
重要规则：
1. 无论原文是什么语言，都必须翻译成${o}
2. 只输出翻译结果，不要添加任何解释、注释或元信息
3. 保持原文的语气和风格
4. 保留原文中的技术术语和专有名词的格式
5. 如果是代码片段、数字、URL等，保持原文不翻译`,a=await fetch(e.apiUrl,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${e.apiKey}`},body:JSON.stringify({model:e.model,messages:[{role:"system",content:m},{role:"user",content:`请将以下文字翻译成${o}，只输出翻译结果：

${t}`}],max_tokens:2e3,temperature:.1})});if(!a.ok){const p=await a.text().catch(()=>"");throw new Error(`翻译请求失败 (${a.status}): ${p.slice(0,200)}`)}const r=(g=(c=(i=(s=(await a.json()).choices)==null?void 0:s[0])==null?void 0:i.message)==null?void 0:c.content)==null?void 0:g.trim();if(!r)throw new Error("翻译API返回了空内容");return r}export{u as t};
