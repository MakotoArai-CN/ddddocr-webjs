import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { CONSTANTS } from './src/config';

const BUILD_DATE = new Date().toISOString();

const extractDomains = (urls: string[]): string[] => {
  return urls.map(url => {
    try {
      return new URL(url.replace('https://raw.githubusercontent.com', 'https://raw.githubusercontent.com')).hostname;
    } catch {
      return url;
    }
  });
};

const githubMirrorDomains = extractDomains(CONSTANTS.GITHUB_MIRRORS);
const cdnDomains = extractDomains(CONSTANTS.CDN_SOURCES);

export default defineConfig({
  build: {
    minify: 'terser',
    rollupOptions: {
      external: ['onnxruntime-web'],
    },
    terserOptions: {
      compress: {
        ecma: 2020,
        keep_infinity: true,
        drop_console: true,
        drop_debugger: true,
        passes: 3,
      },
      mangle: {
        toplevel: true,
        keep_classnames: true,
        keep_fnames: true,
      },
      format: {
        comments: false,
        quote_style: 3,
        beautify: false,
      },
    },
  },
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'DDDD OCR WEB - 验证码自动识别',
        namespace: 'https://github.com/MakotoArai-CN/ddddocr-webjs',
        version: `${CONSTANTS.MODEL_VERSION}-build${BUILD_DATE}`,
        description: '自动检测并识别页面验证码，自动填充到输入框。首次使用需设置白名单，下载约50MB模型文件以及20MB左右的ONNX推理运行时文件，如果弹出窗口提示授权请授权给脚本。',
        author: 'MakotoArai-CN',
        match: ['*://*/*'],
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">🔤</text></svg>',
        grant: [
          'GM_xmlhttpRequest',
          'GM_registerMenuCommand',
          'GM_notification',
          'GM_getValue',
          'GM_setValue',
        ],
        connect: [
          ...cdnDomains,
          ...githubMirrorDomains,
        ],
        require: [
          'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.17.0/ort.min.js',
        ],
      },
      build: {
        fileName: 'ddddocr-web.user.js',
        metaFileName: true,
      },
    }),
  ],
});