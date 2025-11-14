import type { DdddOCR } from './ocr';
import { getConfig, CONSTANTS } from './config';
import type { EventEmitter, OCREvents } from './types';

export class AutoDetector {
  private ocr: DdddOCR;
  private observer: MutationObserver | null = null;
  private processedElements = new WeakMap<Element, string>();
  private enabled = false;
  private checkInterval: number | null = null;
  private eventEmitter: EventEmitter<OCREvents> | null = null;

  constructor(ocr: DdddOCR, eventEmitter?: EventEmitter<OCREvents>) {
    this.ocr = ocr;
    this.eventEmitter = eventEmitter || null;
  }

  start(): void {
    if (this.enabled) return;
    this.enabled = true;
    console.log('🤖 启动验证码自动检测');

    this.detectExistingCaptchas();

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            this.checkElement(node);
          }
        });

        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target instanceof HTMLElement) {
            if (target instanceof HTMLImageElement && mutation.attributeName === 'src') {
              this.recheckImage(target);
            }
            else if (target instanceof HTMLCanvasElement) {
              this.recheckCanvas(target);
            }
            else if (mutation.attributeName === 'style' && target.style.backgroundImage) {
              this.recheckDiv(target);
            }
          }
        }

        if (mutation.type === 'childList' && mutation.target instanceof SVGElement) {
          this.recheckSVG(mutation.target as SVGElement);
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'data-src', 'href'],
      characterData: true,
    });

    this.startIntervalCheck();
  }

  stop(): void {
    if (!this.enabled) return;
    this.enabled = false;
    console.log('🛑 停止验证码自动检测');

    this.observer?.disconnect();
    this.observer = null;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private startIntervalCheck(): void {
    this.checkInterval = window.setInterval(() => {
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach((canvas) => {
        if (this.isCaptchaCanvas(canvas as HTMLCanvasElement)) {
          this.recheckCanvas(canvas as HTMLCanvasElement);
        }
      });
    }, CONSTANTS.AUTO_DETECT_INTERVAL);
  }

  private getElementHash(element: Element): string {
    if (element instanceof HTMLImageElement) {
      return element.src + '_' + element.naturalWidth + '_' + element.naturalHeight;
    } else if (element instanceof HTMLCanvasElement) {
      try {
        return element.toDataURL();
      } catch (e) {
        return 'canvas_' + Date.now();
      }
    } else if (element instanceof SVGElement) {
      return element.outerHTML;
    } else if (element instanceof HTMLElement && element.style.backgroundImage) {
      return element.style.backgroundImage;
    }
    return '';
  }

  private hasElementChanged(element: Element): boolean {
    const currentHash = this.getElementHash(element);
    const previousHash = this.processedElements.get(element);

    if (!previousHash) {
      return true;
    }

    return currentHash !== previousHash;
  }

  private markElementProcessed(element: Element): void {
    const hash = this.getElementHash(element);
    this.processedElements.set(element, hash);
  }

  private detectExistingCaptchas(): void {
    console.log('🔍 检测页面已存在的验证码');

    const images = document.querySelectorAll('img');
    images.forEach((img) => this.checkImage(img as HTMLImageElement));

    const canvases = document.querySelectorAll('canvas');
    canvases.forEach((canvas) => this.checkCanvas(canvas as HTMLCanvasElement));

    const svgs = document.querySelectorAll('svg');
    svgs.forEach((svg) => this.checkSVG(svg as SVGElement));

    const divs = document.querySelectorAll('div[style*="background"]');
    divs.forEach((div) => this.checkDiv(div as HTMLDivElement));
  }

  private checkElement(element: HTMLElement): void {
    if (element instanceof HTMLImageElement) {
      this.checkImage(element);
    }

    if (element instanceof HTMLCanvasElement) {
      this.checkCanvas(element);
    }

    if (element instanceof SVGElement) {
      this.checkSVG(element);
    }

    if (element.style.backgroundImage) {
      this.checkDiv(element);
    }

    element.querySelectorAll('img').forEach((img) => this.checkImage(img));
    element.querySelectorAll('canvas').forEach((canvas) => this.checkCanvas(canvas));
    element.querySelectorAll('svg').forEach((svg) => this.checkSVG(svg));
    element.querySelectorAll('div[style*="background"]').forEach((div) => this.checkDiv(div as HTMLDivElement));
  }

  /**
   * 等待图片完全加载
   */
  private async waitForImageLoad(img: HTMLImageElement, timeout = 5000): Promise<boolean> {
    // 如果图片已加载，直接返回
    if (img.complete && img.naturalWidth > 0) {
      return true;
    }

    console.log('⏳ 等待图片加载完成...', img.src);

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        console.warn('⚠️ 图片加载超时');
        resolve(false);
      }, timeout);

      const onLoad = () => {
        cleanup();
        console.log('✅ 图片加载完成');
        resolve(true);
      };

      const onError = () => {
        cleanup();
        console.warn('⚠️ 图片加载失败');
        resolve(false);
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };

      img.addEventListener('load', onLoad);
      img.addEventListener('error', onError);

      // 双重检查：可能在添加监听器前已经加载完成
      if (img.complete && img.naturalWidth > 0) {
        cleanup();
        resolve(true);
      }
    });
  }

  private async recheckImage(img: HTMLImageElement): Promise<void> {
    console.log('🔄 检测到图片刷新:', img);

    // 等待图片完全加载
    const loaded = await this.waitForImageLoad(img);
    if (!loaded) {
      console.warn('⚠️ 图片未能成功加载，跳过识别');
      return;
    }

    // 再次确认图片已加载且有尺寸
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
      console.warn('⚠️ 图片加载后尺寸异常，跳过识别', {
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      return;
    }

    await this.checkImage(img);
  }

  private async recheckCanvas(canvas: HTMLCanvasElement): Promise<void> {
    console.log('🔄 检测到Canvas刷新:', canvas);

    // Canvas 需要等待一帧以确保绘制完成
    await new Promise(resolve => requestAnimationFrame(resolve));
    await this.checkCanvas(canvas);
  }

  private async recheckSVG(svg: SVGElement): Promise<void> {
    console.log('🔄 检测到SVG刷新:', svg);

    // SVG 也需要等待渲染完成
    await new Promise(resolve => requestAnimationFrame(resolve));
    await this.checkSVG(svg);
  }

  private async recheckDiv(div: HTMLElement): Promise<void> {
    console.log('🔄 检测到背景图刷新:', div);

    // 等待一帧以确保背景图已设置
    await new Promise(resolve => requestAnimationFrame(resolve));
    await this.checkDiv(div);
  }

  private async checkImage(img: HTMLImageElement): Promise<void> {
    const config = getConfig();

    if (config.captchaSelector) {
      if (!img.matches(config.captchaSelector)) return;
    } else {
      if (!this.isCaptchaImage(img)) return;
    }

    if (!this.hasElementChanged(img)) {
      return;
    }

    console.log('🎯 验证码(img):', img);
    this.eventEmitter?.emit('detect:found', { element: img, type: 'img' });

    // 清空关联的输入框
    const input = this.findNearbyInput(img);
    if (input && input.value.trim()) {
      console.log('🧹 清空旧的验证码输入');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 确保图片已加载
    const loaded = await this.waitForImageLoad(img);
    if (!loaded) {
      console.warn('⚠️ 图片加载失败，跳过识别');
      return;
    }

    // 验证图片尺寸
    if (!img.naturalWidth || !img.naturalHeight) {
      console.warn('⚠️ 图片尺寸异常，跳过识别', {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
      return;
    }

    console.log(`📐 尺寸: ${img.naturalWidth}x${img.naturalHeight}`);

    try {
      console.log('🔍 识别中');
      this.eventEmitter?.emit('recognize:start', { element: img });
      const result = await this.ocr.recognize(img);
      console.log('✅ 结果:', result.text);
      this.markElementProcessed(img);
      this.eventEmitter?.emit('recognize:complete', { element: img, result });
      this.fillCaptcha(img, result.text);
    } catch (error) {
      console.error('❌ 识别失败:', error);
      this.eventEmitter?.emit('recognize:error', { element: img, error: error as Error });
    }
  }

  private async checkCanvas(canvas: HTMLCanvasElement): Promise<void> {
    const config = getConfig();

    if (config.captchaSelector) {
      if (!canvas.matches(config.captchaSelector)) return;
    } else {
      if (!this.isCaptchaCanvas(canvas)) return;
    }

    if (!this.hasElementChanged(canvas)) {
      return;
    }

    console.log('🎯 验证码(canvas):', canvas);
    this.eventEmitter?.emit('detect:found', { element: canvas, type: 'canvas' });

    // 清空关联的输入框
    const input = this.findNearbyInput(canvas);
    if (input && input.value.trim()) {
      console.log('🧹 清空旧的验证码输入');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 等待 Canvas 绘制完成
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
      console.log('🔍 识别Canvas');
      this.eventEmitter?.emit('recognize:start', { element: canvas });
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas转换失败'));
          }
        }, 'image/png');
      });

      const result = await this.ocr.recognize(blob);
      console.log('✅ 结果:', result.text);
      this.markElementProcessed(canvas);
      this.eventEmitter?.emit('recognize:complete', { element: canvas, result });
      this.fillCaptcha(canvas, result.text);
    } catch (error) {
      console.error('❌ Canvas识别失败:', error);
      this.eventEmitter?.emit('recognize:error', { element: canvas, error: error as Error });
    }
  }

  private async checkSVG(svg: SVGElement): Promise<void> {
    const config = getConfig();

    if (config.captchaSelector) {
      if (!svg.matches(config.captchaSelector)) return;
    } else {
      if (!this.isCaptchaSVG(svg)) return;
    }

    if (!this.hasElementChanged(svg)) {
      return;
    }

    console.log('🎯 验证码(SVG):', svg);
    this.eventEmitter?.emit('detect:found', { element: svg, type: 'svg' });

    // 清空关联的输入框
    const input = this.findNearbyInput(svg);
    if (input && input.value.trim()) {
      console.log('🧹 清空旧的验证码输入');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    try {
      console.log('🔍 识别SVG');
      this.eventEmitter?.emit('recognize:start', { element: svg });
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        setTimeout(reject, 5000);
      });

      const canvas = document.createElement('canvas');
      canvas.width = svg.clientWidth || 150;
      canvas.height = svg.clientHeight || 50;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      URL.revokeObjectURL(url);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('SVG转换失败'));
          }
        }, 'image/png');
      });

      const result = await this.ocr.recognize(blob);
      console.log('✅ 结果:', result.text);
      this.markElementProcessed(svg);
      this.eventEmitter?.emit('recognize:complete', { element: svg, result });
      this.fillCaptcha(svg, result.text);
    } catch (error) {
      console.error('❌ SVG识别失败:', error);
      this.eventEmitter?.emit('recognize:error', { element: svg, error: error as Error });
    }
  }

  private async checkDiv(div: HTMLElement): Promise<void> {
    const config = getConfig();

    if (config.captchaSelector) {
      if (!div.matches(config.captchaSelector)) return;
    } else {
      if (!this.isCaptchaDiv(div)) return;
    }

    const bgImage = div.style.backgroundImage;
    if (!bgImage) return;

    if (!this.hasElementChanged(div)) {
      return;
    }

    console.log('🎯 验证码(背景图):', div);
    this.eventEmitter?.emit('detect:found', { element: div, type: 'div' });

    // 清空关联的输入框
    const input = this.findNearbyInput(div);
    if (input && input.value.trim()) {
      console.log('🧹 清空旧的验证码输入');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    try {
      console.log('🔍 识别背景图');
      this.eventEmitter?.emit('recognize:start', { element: div });
      const urlMatch = bgImage.match(/url\(['"]?(.+?)['"]?\)/);
      if (!urlMatch) return;

      const imageUrl = urlMatch[1];

      if (imageUrl.startsWith('data:')) {
        const base64Data = imageUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });
        const result = await this.ocr.recognize(blob);
        console.log('✅ 结果:', result.text);
        this.markElementProcessed(div);
        this.eventEmitter?.emit('recognize:complete', { element: div, result });
        this.fillCaptcha(div, result.text);
      } else {
        const result = await this.ocr.recognize(imageUrl);
        console.log('✅ 结果:', result.text);
        this.markElementProcessed(div);
        this.eventEmitter?.emit('recognize:complete', { element: div, result });
        this.fillCaptcha(div, result.text);
      }
    } catch (error) {
      console.error('❌ 背景图识别失败:', error);
      this.eventEmitter?.emit('recognize:error', { element: div, error: error as Error });
    }
  }

  private isCaptchaImage(img: HTMLImageElement): boolean {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (width < CONSTANTS.MIN_CAPTCHA_WIDTH || height < CONSTANTS.MIN_CAPTCHA_HEIGHT) return false;
    if (width > CONSTANTS.MAX_CAPTCHA_WIDTH || height > CONSTANTS.MAX_CAPTCHA_HEIGHT) return false;

    const text = (img.src + img.className + img.id + img.alt + (img.getAttribute('data-src') || '')).toLowerCase();
    return CONSTANTS.CAPTCHA_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  private isCaptchaCanvas(canvas: HTMLCanvasElement): boolean {
    const width = canvas.width;
    const height = canvas.height;

    if (width < CONSTANTS.MIN_CAPTCHA_WIDTH || height < CONSTANTS.MIN_CAPTCHA_HEIGHT) return false;
    if (width > CONSTANTS.MAX_CAPTCHA_WIDTH || height > CONSTANTS.MAX_CAPTCHA_HEIGHT) return false;

    const text = (canvas.className + canvas.id + (canvas.getAttribute('data-type') || '')).toLowerCase();
    return CONSTANTS.CAPTCHA_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  private isCaptchaSVG(svg: SVGElement): boolean {
    const width = svg.clientWidth || parseInt(svg.getAttribute('width') || '0');
    const height = svg.clientHeight || parseInt(svg.getAttribute('height') || '0');

    if (width < CONSTANTS.MIN_CAPTCHA_WIDTH || height < CONSTANTS.MIN_CAPTCHA_HEIGHT) return false;
    if (width > CONSTANTS.MAX_CAPTCHA_WIDTH || height > CONSTANTS.MAX_CAPTCHA_HEIGHT) return false;

    const text = (svg.className.baseVal + svg.id).toLowerCase();
    return CONSTANTS.CAPTCHA_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  private isCaptchaDiv(div: HTMLElement): boolean {
    const width = div.clientWidth;
    const height = div.clientHeight;

    if (width < CONSTANTS.MIN_CAPTCHA_WIDTH || height < CONSTANTS.MIN_CAPTCHA_HEIGHT) return false;
    if (width > CONSTANTS.MAX_CAPTCHA_WIDTH || height > CONSTANTS.MAX_CAPTCHA_HEIGHT) return false;

    const text = (div.className + div.id).toLowerCase();
    return CONSTANTS.CAPTCHA_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  private fillCaptcha(element: Element, text: string): void {
    const config = getConfig();

    let input: HTMLInputElement | null = null;

    if (config.inputSelector) {
      input = document.querySelector(config.inputSelector);
    }

    if (!input) {
      input = this.findNearbyInput(element);
    }

    if (!input) {
      console.warn('⚠️ 未找到验证码输入框');
      return;
    }

    console.log('📝 填充验证码:', input, text);

    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    this.highlightInput(input);

    if (typeof GM_notification !== 'undefined') {
      GM_notification({
        title: '验证码已自动填充',
        text: `识别结果: ${text}`,
        timeout: 3000,
      });
    }
  }

  private findNearbyInput(element: Element): HTMLInputElement | null {
    const form = element.closest('form');
    if (form) {
      const inputs = form.querySelectorAll('input[type="text"], input[type="password"], input:not([type])');
      for (const input of inputs) {
        if (this.isLikelyCaptchaInput(input as HTMLInputElement)) {
          return input as HTMLInputElement;
        }
      }
    }

    let parent = element.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const inputs = parent.querySelectorAll('input[type="text"], input[type="password"], input:not([type])');
      for (const input of inputs) {
        if (this.isLikelyCaptchaInput(input as HTMLInputElement)) {
          return input as HTMLInputElement;
        }
      }
      parent = parent.parentElement;
    }

    const allInputs = document.querySelectorAll('input[type="text"], input[type="password"], input:not([type])');
    let closest: HTMLInputElement | null = null;
    let minDistance = Infinity;
    const elemRect = element.getBoundingClientRect();

    for (const input of allInputs) {
      if (!this.isLikelyCaptchaInput(input as HTMLInputElement)) continue;

      const inputRect = input.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(inputRect.left - elemRect.left, 2) +
        Math.pow(inputRect.top - elemRect.top, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closest = input as HTMLInputElement;
      }
    }

    return closest;
  }

  private isLikelyCaptchaInput(input: HTMLInputElement): boolean {
    const text = (input.name + input.id + input.className + input.placeholder).toLowerCase();
    return CONSTANTS.CAPTCHA_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  private highlightInput(input: HTMLInputElement): void {
    const originalStyle = input.style.cssText;
    input.style.cssText += `
      transition: all 0.3s ease;
      box-shadow: 0 0 10px rgba(255, 105, 180, 0.8);
      border-color: #FF69B4 !important;
    `;

    setTimeout(() => {
      input.style.cssText = originalStyle;
    }, 2000);
  }
}