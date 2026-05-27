// Supported languages with their ISO codes and display names.
// The popup shows: 中文名 (原生名) — e.g., 日语 (日本語)

export interface Language {
  code: string;
  /** Display name in Chinese */
  zhName: string;
  /** Native script name */
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  // 亚洲 — 东亚
  { code: 'zh-CN', zhName: '简体中文', nativeName: '简体中文' },
  { code: 'zh-TW', zhName: '繁体中文', nativeName: '繁體中文' },
  { code: 'ja',    zhName: '日语',     nativeName: '日本語' },
  { code: 'ko',    zhName: '韩语',     nativeName: '한국어' },
  { code: 'mn',    zhName: '蒙古语',   nativeName: 'Монгол' },

  // 亚洲 — 东南亚
  { code: 'th',    zhName: '泰语',       nativeName: 'ไทย' },
  { code: 'vi',    zhName: '越南语',     nativeName: 'Tiếng Việt' },
  { code: 'id',    zhName: '印尼语',     nativeName: 'Bahasa Indonesia' },
  { code: 'ms',    zhName: '马来语',     nativeName: 'Bahasa Melayu' },
  { code: 'km',    zhName: '高棉语',     nativeName: 'ភាសាខ្មែរ' },
  { code: 'lo',    zhName: '老挝语',     nativeName: 'ລາວ' },
  { code: 'my',    zhName: '缅甸语',     nativeName: 'မြန်မာဘာသာ' },
  { code: 'tl',    zhName: '菲律宾语',   nativeName: 'Tagalog' },
  { code: 'jv',    zhName: '爪哇语',     nativeName: 'Basa Jawa' },
  { code: 'su',    zhName: '巽他语',     nativeName: 'Basa Sunda' },

  // 亚洲 — 南亚
  { code: 'hi',    zhName: '印地语',     nativeName: 'हिन्दी' },
  { code: 'bn',    zhName: '孟加拉语',   nativeName: 'বাংলা' },
  { code: 'ur',    zhName: '乌尔都语',   nativeName: 'اردو' },
  { code: 'ta',    zhName: '泰米尔语',   nativeName: 'தமிழ்' },
  { code: 'te',    zhName: '泰卢固语',   nativeName: 'తెలుగు' },
  { code: 'mr',    zhName: '马拉地语',   nativeName: 'मराठी' },
  { code: 'gu',    zhName: '古吉拉特语', nativeName: 'ગુજરાતી' },
  { code: 'kn',    zhName: '卡纳达语',   nativeName: 'ಕನ್ನಡ' },
  { code: 'ml',    zhName: '马拉雅拉姆语', nativeName: 'മലയാളം' },
  { code: 'pa',    zhName: '旁遮普语',   nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'si',    zhName: '僧伽罗语',   nativeName: 'සිංහල' },
  { code: 'ne',    zhName: '尼泊尔语',   nativeName: 'नेपाली' },

  // 亚洲 — 中亚/西亚
  { code: 'fa',    zhName: '波斯语',     nativeName: 'فارسی' },
  { code: 'ar',    zhName: '阿拉伯语',   nativeName: 'العربية' },
  { code: 'he',    zhName: '希伯来语',   nativeName: 'עברית' },
  { code: 'tr',    zhName: '土耳其语',   nativeName: 'Türkçe' },
  { code: 'kk',    zhName: '哈萨克语',   nativeName: 'Қазақша' },
  { code: 'uz',    zhName: '乌兹别克语', nativeName: 'Oʻzbekcha' },
  { code: 'az',    zhName: '阿塞拜疆语', nativeName: 'Azərbaycanca' },
  { code: 'ka',    zhName: '格鲁吉亚语', nativeName: 'ქართული' },
  { code: 'hy',    zhName: '亚美尼亚语', nativeName: 'Հայերեն' },

  // 欧洲 — 日耳曼语系
  { code: 'en',    zhName: '英语',       nativeName: 'English' },
  { code: 'de',    zhName: '德语',       nativeName: 'Deutsch' },
  { code: 'nl',    zhName: '荷兰语',     nativeName: 'Nederlands' },
  { code: 'sv',    zhName: '瑞典语',     nativeName: 'Svenska' },
  { code: 'da',    zhName: '丹麦语',     nativeName: 'Dansk' },
  { code: 'no',    zhName: '挪威语',     nativeName: 'Norsk' },
  { code: 'is',    zhName: '冰岛语',     nativeName: 'Íslenska' },
  { code: 'af',    zhName: '南非荷兰语', nativeName: 'Afrikaans' },

  // 欧洲 — 拉丁语系
  { code: 'fr',    zhName: '法语',       nativeName: 'Français' },
  { code: 'es',    zhName: '西班牙语',   nativeName: 'Español' },
  { code: 'pt',    zhName: '葡萄牙语',   nativeName: 'Português' },
  { code: 'it',    zhName: '意大利语',   nativeName: 'Italiano' },
  { code: 'ro',    zhName: '罗马尼亚语', nativeName: 'Română' },
  { code: 'ca',    zhName: '加泰罗尼亚语', nativeName: 'Català' },
  { code: 'gl',    zhName: '加利西亚语', nativeName: 'Galego' },

  // 欧洲 — 斯拉夫语系
  { code: 'ru',    zhName: '俄语',       nativeName: 'Русский' },
  { code: 'pl',    zhName: '波兰语',     nativeName: 'Polski' },
  { code: 'uk',    zhName: '乌克兰语',   nativeName: 'Українська' },
  { code: 'cs',    zhName: '捷克语',     nativeName: 'Čeština' },
  { code: 'sk',    zhName: '斯洛伐克语', nativeName: 'Slovenčina' },
  { code: 'bg',    zhName: '保加利亚语', nativeName: 'Български' },
  { code: 'sr',    zhName: '塞尔维亚语', nativeName: 'Српски' },
  { code: 'hr',    zhName: '克罗地亚语', nativeName: 'Hrvatski' },
  { code: 'sl',    zhName: '斯洛文尼亚语', nativeName: 'Slovenščina' },
  { code: 'mk',    zhName: '马其顿语',   nativeName: 'Македонски' },
  { code: 'be',    zhName: '白俄罗斯语', nativeName: 'Беларуская' },

  // 欧洲 — 其他
  { code: 'el',    zhName: '希腊语',     nativeName: 'Ελληνικά' },
  { code: 'hu',    zhName: '匈牙利语',   nativeName: 'Magyar' },
  { code: 'fi',    zhName: '芬兰语',     nativeName: 'Suomi' },
  { code: 'lt',    zhName: '立陶宛语',   nativeName: 'Lietuvių' },
  { code: 'lv',    zhName: '拉脱维亚语', nativeName: 'Latviešu' },
  { code: 'et',    zhName: '爱沙尼亚语', nativeName: 'Eesti' },
  { code: 'sq',    zhName: '阿尔巴尼亚语', nativeName: 'Shqip' },
  { code: 'mt',    zhName: '马耳他语',   nativeName: 'Malti' },
  { code: 'ga',    zhName: '爱尔兰语',   nativeName: 'Gaeilge' },
  { code: 'cy',    zhName: '威尔士语',   nativeName: 'Cymraeg' },
  { code: 'eu',    zhName: '巴斯克语',   nativeName: 'Euskara' },

  // 非洲
  { code: 'sw',    zhName: '斯瓦希里语', nativeName: 'Kiswahili' },
  { code: 'am',    zhName: '阿姆哈拉语', nativeName: 'አማርኛ' },
  { code: 'ha',    zhName: '豪萨语',     nativeName: 'Hausa' },
  { code: 'yo',    zhName: '约鲁巴语',   nativeName: 'Yorùbá' },
  { code: 'zu',    zhName: '祖鲁语',     nativeName: 'isiZulu' },
  { code: 'so',    zhName: '索马里语',   nativeName: 'Soomaali' },
  { code: 'ig',    zhName: '伊博语',     nativeName: 'Igbo' },

  // 美洲 / 大洋洲
  { code: 'mi',    zhName: '毛利语',     nativeName: 'Te Reo Māori' },
  { code: 'qu',    zhName: '克丘亚语',   nativeName: 'Runasimi' },

  // 人工语言
  { code: 'eo',    zhName: '世界语',     nativeName: 'Esperanto' },
];

/** Default target language */
export const DEFAULT_TARGET_LANG = 'zh-CN';

/** Look up a language by code */
export function getLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

/** Get the display label for popup: 中文名 (原生名) */
export function getLanguageLabel(code: string): string {
  const lang = getLanguage(code);
  if (!lang) return code;
  return `${lang.zhName} (${lang.nativeName})`;
}
