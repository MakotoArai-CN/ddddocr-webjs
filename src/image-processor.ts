/**
 * 图像预处理（改进版）
 */
export class ImageProcessor {
  /**
   * 从 HTMLImageElement 直接提取图像数据（避免重新加载）
   */
  static extractImageFromElement(img: HTMLImageElement): { data: Uint8ClampedArray; width: number; height: number } {
    console.log('🖼️ 直接从 DOM 元素提取图像数据');
    
    // 创建 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    
    const ctx = canvas.getContext('2d')!;
    
    // 先填充白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制图片（不会触发重新加载）
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 转换为灰度
    const grayData = this.toGrayscale(imageData.data);
    
    console.log(`📐 提取的图像尺寸: ${canvas.width}x${canvas.height}`);
    
    return {
      data: grayData,
      width: canvas.width,
      height: canvas.height
    };
  }
  
  /**
   * 加载图像并转换为灰度
   */
  static async loadImage(input: string | Blob | HTMLImageElement): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
    // 如果是 HTMLImageElement，直接提取
    if (input instanceof HTMLImageElement) {
      return this.extractImageFromElement(input);
    }
    
    const img = new Image();
    
    // 设置跨域属性
    img.crossOrigin = 'anonymous';
    
    // 处理输入
    if (typeof input === 'string') {
      try {
        const blob = await this.fetchImageAsBlob(input);
        img.src = URL.createObjectURL(blob);
      } catch (error) {
        console.warn('⚠️ 通过代理获取失败，使用直接 URL:', error);
        img.src = input;
      }
    } else {
      img.src = URL.createObjectURL(input);
    }
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('图片加载失败'));
      
      // 超时保护
      setTimeout(() => reject(new Error('图片加载超时')), 10000);
    });
    
    console.log(`📐 图片尺寸: ${img.width}x${img.height}`);
    
    // 创建 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d')!;
    
    // 先填充白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, img.width, img.height);
    
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    
    // 转换为灰度
    const grayData = this.toGrayscale(imageData.data);
    
    // 清理
    if (typeof input !== 'string') {
      URL.revokeObjectURL(img.src);
    }
    
    return {
      data: grayData,
      width: img.width,
      height: img.height
    };
  }
  
  /**
   * 通过 GM_xmlhttpRequest 获取图片（绕过跨域）
   */
  private static fetchImageAsBlob(url: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'blob',
        headers: {
          'Referer': window.location.href,
        },
        timeout: 10000,
        onload: (response) => {
          if (response.status === 200) {
            resolve(response.response as Blob);
          } else {
            reject(new Error(`HTTP ${response.status}`));
          }
        },
        onerror: reject,
        ontimeout: () => reject(new Error('获取图片超时')),
      });
    });
  }
  
  /**
   * 转换为灰度图
   */
  private static toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(data.length / 4);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // 处理透明度
      const alpha = a / 255;
      const rr = r * alpha + 255 * (1 - alpha);
      const gg = g * alpha + 255 * (1 - alpha);
      const bb = b * alpha + 255 * (1 - alpha);
      
      // ITU-R BT.709
      gray[i / 4] = Math.round(0.2126 * rr + 0.7152 * gg + 0.0722 * bb);
    }
    
    return gray;
  }
  
  /**
   * 调整图像大小（双线性插值）
   */
  static resize(data: Uint8ClampedArray, width: number, height: number, newWidth: number, newHeight: number): Uint8ClampedArray {
    const result = new Uint8ClampedArray(newWidth * newHeight);
    const xRatio = width / newWidth;
    const yRatio = height / newHeight;
    
    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const px = x * xRatio;
        const py = y * yRatio;
        
        const x1 = Math.floor(px);
        const x2 = Math.min(x1 + 1, width - 1);
        const y1 = Math.floor(py);
        const y2 = Math.min(y1 + 1, height - 1);
        
        const fx = px - x1;
        const fy = py - y1;
        
        const v1 = data[y1 * width + x1];
        const v2 = data[y1 * width + x2];
        const v3 = data[y2 * width + x1];
        const v4 = data[y2 * width + x2];
        
        const val = v1 * (1 - fx) * (1 - fy) +
                   v2 * fx * (1 - fy) +
                   v3 * (1 - fx) * fy +
                   v4 * fx * fy;
        
        result[y * newWidth + x] = Math.round(val);
      }
    }
    
    return result;
  }
  
  /**
   * 归一化到 [0, 1]
   */
  static normalize(data: Uint8ClampedArray): Float32Array {
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      normalized[i] = data[i] / 255.0;
    }
    return normalized;
  }
}