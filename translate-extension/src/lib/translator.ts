// Translator — sends text to the configured LLM API and returns translated text.
//
// Uses an OpenAI-compatible chat completions endpoint.
// API config is read from chrome.storage.sync (set by the popup or default env).

import { DEFAULT_TARGET_LANG } from './languages';

interface TranslateConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  targetLang: string;
}

const DEFAULT_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Resolve translation config from storage or environment defaults.
 */
async function getConfig(): Promise<TranslateConfig> {
  const stored = await chrome.storage.sync.get([
    'apiUrl',
    'apiKey',
    'model',
    'targetLang',
  ]);

  return {
    apiUrl: (stored['apiUrl'] as string) || DEFAULT_API_URL,
    apiKey: (stored['apiKey'] as string) || '',
    model: (stored['model'] as string) || DEFAULT_MODEL,
    targetLang: (stored['targetLang'] as string) || DEFAULT_TARGET_LANG,
  };
}

/**
 * Translate text to the configured target language.
 * Returns the translated text or throws on error.
 */
export async function translate(text: string): Promise<string> {
  const config = await getConfig();

  if (!config.apiKey) {
    throw new Error('请先在扩展设置中配置 API Key');
  }

  if (!text || text.trim().length === 0) {
    return '';
  }

  const systemPrompt = `你是一个专业的翻译助手。将用户提供的文字翻译成目标语言。
规则：
1. 只输出翻译结果，不要添加任何解释、注释或元信息
2. 保持原文的语气和风格
3. 保留原文中的技术术语和专有名词的格式
4. 如果是代码片段、数字、URL等，保持原样`;

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `将以下文字翻译成目标语言，只输出翻译结果：\n\n${text}` },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`翻译请求失败 (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const translated = data.choices?.[0]?.message?.content?.trim();
  if (!translated) {
    throw new Error('翻译API返回了空内容');
  }

  return translated;
}

/**
 * Batch translate multiple text segments.
 */
export async function translateBatch(texts: string[]): Promise<string[]> {
  return Promise.all(texts.map((t) => translate(t)));
}
