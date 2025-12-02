import { loadModel } from './model-loader';
import { ImageProcessor } from './image-processor';
import { setupWASMCache } from './wasm-cache';
import type { OCRResult } from './types';

declare const ort: any;

async function waitForOrt(): Promise<any> {
  if (typeof ort !== 'undefined') {
    console.log('✅ ort 已存在');
    return ort;
  }

  console.log('⏳ 等待 ort 加载...');

  for (let i = 0; i < 100; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      if (typeof ort !== 'undefined') {
        console.log('✅ ort 已就绪');
        return ort;
      }
    } catch (e) {
      // ignore
    }
  }

  throw new Error('等待 ort 超时');
}

export class DdddOCR {
  private session: any = null;
  private charsets: string[] = [];
  private initialized = false;
  private ort: any = null;

  async init(): Promise<void> {
    if (this.initialized) {
      console.warn('⚠️ OCR 已初始化');
      return;
    }

    console.log('🔧 初始化 OCR...');

    try {
      // 1. 启用 WASM 缓存（预下载）
      console.log('💾 启用 WASM 缓存...');
      await setupWASMCache();
      
      // 2. 等待 ort
      console.log('⏳ 获取 ONNX Runtime...');
      this.ort = await waitForOrt();
      
      if (!this.ort) {
        throw new Error('ONNX Runtime 未找到');
      }

      console.log('✅ ONNX Runtime 已就绪');
      console.log('📦 版本:', this.ort.env?.versions);

      // 3. 配置 WASM
      this.ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';
      this.ort.env.wasm.numThreads = 1;
      this.ort.env.wasm.simd = true;
      this.ort.env.logLevel = 'warning';

      // 4. 加载模型
      console.log('📥 加载模型...');
      const { model, charsets } = await loadModel();
      this.charsets = charsets;

      console.log('🚀 创建推理会话...');

      // 5. 创建会话
      this.session = await this.ort.InferenceSession.create(model, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.initialized = true;
      console.log('✅ OCR 已就绪');

    } catch (error) {
      console.error('❌ OCR 初始化失败:', error);
      throw error;
    }
  }

  // 支持 HTMLImageElement
  async recognize(input: string | Blob | HTMLImageElement): Promise<OCRResult> {
    if (!this.initialized || !this.session) {
      await this.init();
    }

    try {
      const inputType = input instanceof HTMLImageElement ? 'HTMLImageElement' : 
                       typeof input === 'string' ? 'URL' : 'Blob';
      console.log('📸 加载图像...');
      console.log('   输入类型:', inputType);

      const startTime = Date.now();
      
      // 使用改进的 loadImage（支持 HTMLImageElement）
      const { data, width, height } = await ImageProcessor.loadImage(input);
      
      console.log(`   加载耗时: ${Date.now() - startTime}ms`);

      const targetHeight = 64;
      const targetWidth = Math.floor(width * (targetHeight / height));
      
      console.log(`🔄 调整尺寸: ${width}x${height} → ${targetWidth}x${targetHeight}`);
      const resized = ImageProcessor.resize(data, width, height, targetWidth, targetHeight);

      const normalized = ImageProcessor.normalize(resized);

      const tensor = new this.ort.Tensor('float32', normalized, [1, 1, targetHeight, targetWidth]);

      console.log(`🧮 推理中... (输入: 1x1x${targetHeight}x${targetWidth})`);

      const inferStart = Date.now();
      const feeds = { input1: tensor };
      const results = await this.session.run(feeds);
      console.log(`   推理耗时: ${Date.now() - inferStart}ms`);
      
      const output = results.output;

      const text = this.decodeOutput(output);

      console.log(`✅ 识别完成: ${text} (总耗时: ${Date.now() - startTime}ms)`);

      return { text };

    } catch (error) {
      console.error('❌ 识别失败:', error);
      throw error;
    }
  }

  private convertToNumberArray(data: any): number[] {
    if (!data || !data.length) {
      return [];
    }
    
    const result: number[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      
      if (typeof value === 'bigint') {
        result.push(Number(value));
      } else if (typeof value === 'number') {
        result.push(Math.round(value));
      } else {
        console.warn(`⚠️ 索引 ${i} 类型异常:`, typeof value);
        result.push(0);
      }
    }
    
    return result;
  }

  private decodeOutput(output: any): string {
    const indices = this.convertToNumberArray(output.data);
    
    console.log('🔍 解码:', {
      total: indices.length,
      valid: indices.filter(i => i > 0).length,
      sample: indices.slice(0, 20)
    });
    
    const result: string[] = [];
    let lastChar = '';

    for (const idx of indices) {
      if (idx <= 0 || idx >= this.charsets.length) {
        continue;
      }
      
      const char = this.charsets[idx];
      
      if (!char) {
        console.warn(`⚠️ 索引 ${idx} 无对应字符`);
        continue;
      }
      
      if (char === lastChar) {
        continue;
      }
      
      result.push(char);
      lastChar = char;
    }

    const text = result.join('');
    console.log('✅ 解码完成:', text, `(${result.length} 字符)`);
    
    return text;
  }

  async destroy(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
    this.initialized = false;
    console.log('🗑️ OCR 已销毁');
  }
}