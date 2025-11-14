import { DdddOCR } from './ocr';
import { clearModelCache } from './model-loader';
import { clearWASMCache } from './wasm-cache';
import { AutoDetector } from './auto-detector';
import { getConfig, saveConfig, shouldExecuteScript, isWhitelisted } from './config';
import { SettingsUI } from './settings-ui';
import { LoadingIndicator } from './loading-indicator';
import { Dialog } from './dialog';
import { EventEmitter, OCREvents } from './types';

class OCRApp {
  private ocr: DdddOCR;
  private detector: AutoDetector;
  private settingsUI: SettingsUI;
  private loadingIndicator: LoadingIndicator | null = null;
  private initialized = false;
  private eventEmitter: EventEmitter<OCREvents>;

  constructor() {
    this.eventEmitter = new EventEmitter<OCREvents>();
    this.ocr = new DdddOCR();
    this.detector = new AutoDetector(this.ocr, this.eventEmitter);
    this.settingsUI = new SettingsUI();

    this.registerMenuCommands();

    this.settingsUI.setOnConfigChange((config) => {
      this.handleConfigChange(config);
    });
  }

  async init(): Promise<void> {
    if (!shouldExecuteScript()) {
      console.log('🚫 当前站点不满足执行条件');
      console.log(`📍 当前站点: ${window.location.hostname}`);
      return;
    }

    if (this.initialized) return;

    const config = getConfig();
    this.initialized = true;
    this.loadingIndicator = new LoadingIndicator();

    console.log('🔤 DDDD OCR 启动');
    console.log(`📍 当前站点: ${window.location.hostname}`);

    try {
      this.loadingIndicator.show('正在初始化 DDDD OCR');
      console.log('⏳ 正在加载模型');
      this.loadingIndicator.updateText('正在加载模型文件');
      await this.ocr.init();
      console.log('✅ OCR 已就绪');
      this.loadingIndicator.updateText('DDDD OCR 已就绪');

      if (config.autoDetect) {
        this.detector.start();
        console.log('🤖 自动检测已启动');
      }

      setTimeout(() => {
        this.loadingIndicator?.hide();
      }, 2000);

      this.showNotification('DDDD OCR 已就绪', config.autoDetect ? '自动检测已启用' : '点击菜单启用自动检测');
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      if (this.loadingIndicator) {
        this.loadingIndicator.updateText('初始化失败: ' + String(error));
        setTimeout(() => {
          this.loadingIndicator?.hide();
        }, 3000);
      }
      this.showNotification('初始化失败', String(error), true);
    }
  }

  private registerMenuCommands(): void {
    GM_registerMenuCommand('⚙️ 打开设置', () => this.settingsUI.show(), 's');
    GM_registerMenuCommand('🤖 切换自动检测', () => this.toggleAutoDetect(), 'a');
    GM_registerMenuCommand('🗑️ 清除所有缓存', async () => {
      Dialog.confirm({
        title: '清除缓存',
        content: '确定要清除所有缓存吗（包括模型和 WASM）？下次启动将重新下载。',
        icon: '🗑️',
        confirmText: '确定清除',
        cancelText: '取消',
        onConfirm: async () => {
          await clearModelCache();
          await clearWASMCache();
          this.showNotification('缓存已清除', '请刷新页面');
        },
      });
    }, 'd');
    GM_registerMenuCommand('ℹ️ 查看状态', () => this.showStatus(), 'i');
  }

  private showStatus(): void {
    const config = getConfig();
    const whitelisted = isWhitelisted();
    let content = `
<b>脚本状态:</b> ${this.initialized ? '✅ 已初始化' : '❌ 未初始化'}
<b>当前站点:</b> ${window.location.hostname}
<b>白名单状态:</b> ${config.enableWhitelist ? '✅ 已启用' : '❌ 已禁用'}
<b>白名单数量:</b> ${config.whitelist?.length || 0} 个站点
<b>当前站点匹配:</b> ${whitelisted ? '✅ 在白名单中' : '❌ 不在白名单中'}
<b>自动检测:</b> ${config.autoDetect ? '✅ 已启用' : '❌ 已禁用'}
<b>上传模型:</b> ${config.useUploadedModel ? '✅ 已启用' : '❌ 未启用'}
<b>自动下载:</b> ${config.autoDownload ? '✅ 已启用' : '❌ 已禁用'}`;

    if (!this.initialized) {
      content += '\n\n<b style="color: #FF6B6B;">⚠️ 脚本未初始化原因：</b>\n' + this.getInitFailureReason();
    }

    Dialog.show({
      title: '当前状态',
      content: content,
      icon: 'ℹ️',
    });
  }

  private getInitFailureReason(): string {
    const config = getConfig();
    
    if (config.enableWhitelist) {
      if (!config.whitelist || config.whitelist.length === 0) {
        return '• 白名单为空\n• 请在设置中添加站点到白名单';
      }
      if (!isWhitelisted()) {
        return `• 当前站点 ${window.location.hostname} 不在白名单中\n• 请将当前站点添加到白名单`;
      }
    }
    
    return '• 未知原因，请查看控制台日志';
  }

  private toggleAutoDetect(): void {
    const config = getConfig();
    const newState = !config.autoDetect;
    if (newState) {
      if (!this.initialized) {
        Dialog.show({
          title: '需要初始化',
          content: '启用自动检测需要先初始化 OCR 引擎，请稍候',
          icon: '⏳',
        });
        this.init().then(() => {
          this.detector.start();
          this.showNotification('自动检测已启用', '将自动识别并填充验证码');
        }).catch(error => {
          this.showNotification('启用失败', String(error), true);
        });
      } else {
        this.detector.start();
        this.showNotification('自动检测已启用', '将自动识别并填充验证码');
      }
    } else {
      this.detector.stop();
      this.showNotification('自动检测已关闭', '不再自动处理验证码');
    }
    saveConfig({ autoDetect: newState });
    console.log(`${newState ? '✅' : '⏸️'} 自动检测已${newState ? '启用' : '禁用'}`);
  }

  private handleConfigChange(config: import('./config').OCRConfig): void {
    if (config.autoDetect && !this.detector['enabled']) {
      if (!this.initialized) {
        this.init();
      }
      this.detector.start();
    } else if (!config.autoDetect && this.detector['enabled']) {
      this.detector.stop();
    }

    const needsRefresh = this.checkNeedsRefresh(config);
    if (needsRefresh) {
      Dialog.show({
        title: '配置已更改',
        content: '部分配置需要刷新页面才能生效，是否现在刷新？',
        icon: '🔄',
        confirmText: '刷新页面',
        onConfirm: () => {
          window.location.reload();
        },
      });
    }
  }

  private checkNeedsRefresh(config: import('./config').OCRConfig): boolean {
    const oldConfig = getConfig();
    if (config.useUploadedModel !== oldConfig.useUploadedModel) {
      return true;
    }
    if (config.enableWhitelist !== oldConfig.enableWhitelist) {
      return true;
    }
    return false;
  }

  private showNotification(title: string, text: string, isError = false): void {
    if (typeof GM_notification !== 'undefined') {
      GM_notification({
        title,
        text,
        timeout: isError ? 5000 : 3000,
      });
    }
  }
}

function bootstrap(): void {
  const app = new OCRApp();

  if (!shouldExecuteScript()) {
    console.log('🚫 DDDD OCR 不满足执行条件，仅注册菜单命令');
    return;
  }

  setTimeout(() => {
    app.init();
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}