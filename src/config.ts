export interface OCRConfig {
  autoDetect: boolean;
  captchaSelector: string;
  inputSelector: string;
  useLocalModel: boolean;
  localModelPath: string;
  localCharsetsPath: string;
  autoDownload: boolean;
  enableWhitelist: boolean;
  whitelist: string[];
  useUploadedModel: boolean;
  enableSlideCaptcha: boolean;     // 启用滑动验证码
  enableRotateCaptcha: boolean;    // 启用旋转验证码
  enableClickCaptcha: boolean;     // 启用点选验证码
  slideDebugMode: boolean;         // 调试模式，显示滑动轨迹
}

export const CONSTANTS = {
  MODEL_VERSION: '1.0.2',
  MODEL_REPO: 'MakotoArai-CN/ddddocr-webjs',
  MODEL_BRANCH: 'main',
  MODEL_PATH: 'public/common.onnx',
  CHARSETS_PATH: 'public/charsets.json',
  WASM_VERSION: '1.17.0',
  CACHE_DURATION: 30 * 24 * 60 * 60 * 1000,
  CAPTCHA_KEYWORDS: [
    'captcha', 
    'verify', 
    'code', 
    'vcode', 
    'authcode', 
    '验证码', 
    'checkcode', 
    'yzm',
    'capimg',
    'signCaptcha',
  ],
  MIN_CAPTCHA_WIDTH: 40,
  MIN_CAPTCHA_HEIGHT: 20,
  MAX_CAPTCHA_WIDTH: 500,
  MAX_CAPTCHA_HEIGHT: 200,
  AUTO_DETECT_INTERVAL: 2000,
  
  GITHUB_MIRRORS: [
    'https://raw.githubusercontent.com',
    'https://ghproxy.com/https://raw.githubusercontent.com',
    'https://ghfast.top/https://raw.githubusercontent.com',
    'https://mirror.ghproxy.com/https://raw.githubusercontent.com',
    'https://raw.kkgithub.com',
    'https://github.moeyy.xyz/https://raw.githubusercontent.com',
    'https://ghps.cc/https://raw.githubusercontent.com',
    'https://cors.isteed.cc/github.com/J3n5en/ddddocr-js/raw/main',
    'https://raw.githubusercontents.com',
  ],
  
  CDN_SOURCES: [
    'https://cdn.jsdelivr.net',
    'https://unpkg.com',
    'https://cdnjs.cloudflare.com',
    'https://fastly.jsdelivr.net',
    'https://registry.npmmirror.com',
  ],
};

const DEFAULT_CONFIG: OCRConfig = {
  autoDetect: false,
  captchaSelector: '',
  inputSelector: '',
  useLocalModel: false,
  localModelPath: '',
  localCharsetsPath: '',
  autoDownload: true,
  enableWhitelist: true,
  whitelist: [],
  useUploadedModel: false,
  // 默认关闭高级验证码
  enableSlideCaptcha: false,
  enableRotateCaptcha: false,
  enableClickCaptcha: false,
  slideDebugMode: false,
};

const CONFIG_KEY = 'ddddocr_config';

export function getConfig(): OCRConfig {
  const stored = GM_getValue(CONFIG_KEY);
  return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<OCRConfig>): void {
  const current = getConfig();
  GM_setValue(CONFIG_KEY, { ...current, ...config });
}

export function resetConfig(): void {
  GM_setValue(CONFIG_KEY, DEFAULT_CONFIG);
}

export function isWhitelisted(): boolean {
  const config = getConfig();
  if (!config.enableWhitelist) {
    return true;
  }
  if (!config.whitelist || config.whitelist.length === 0) {
    return false;
  }
  const currentHost = window.location.hostname;
  return config.whitelist.some(pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
    return regex.test(currentHost);
  });
}

export function shouldExecuteScript(): boolean {
  const config = getConfig();
  
  // 如果启用了白名单
  if (config.enableWhitelist) {
    // 白名单为空，不执行（即使设置了上传模型）
    if (!config.whitelist || config.whitelist.length === 0) {
      console.log('🚫 白名单为空，脚本不会执行');
      return false;
    }
    // 不在白名单中，不执行
    if (!isWhitelisted()) {
      console.log(`🚫 当前站点 ${window.location.hostname} 不在白名单中`);
      return false;
    }
  }
  
  // 通过白名单检查或未启用白名单
  return true;
}