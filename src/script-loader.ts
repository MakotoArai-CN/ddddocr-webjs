/**
 * 清理可能干扰 UMD 模块加载的全局变量
 */
function cleanupGlobalEnvironment() {
  const backup: any = {};
  const keysToClean = ['module', 'exports', 'define', 'require'];
  
  keysToClean.forEach(key => {
    if ((window as any)[key] !== undefined) {
      backup[key] = (window as any)[key];
      delete (window as any)[key];
      console.log(`🧹 临时清理全局变量: ${key}`);
    }
  });
  
  // 返回恢复函数
  return () => {
    Object.keys(backup).forEach(key => {
      (window as any)[key] = backup[key];
      console.log(`🔄 恢复全局变量: ${key}`);
    });
  };
}

/**
 * 动态加载外部脚本
 */
export function loadScript(url: string, options?: { cleanEnv?: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      console.log(`✅ 脚本已存在: ${url}`);
      resolve();
      return;
    }

    console.log(`📥 加载脚本: ${url}`);

    // 清理环境（如果需要）
    const restore = options?.cleanEnv ? cleanupGlobalEnvironment() : null;

    const script = document.createElement('script');
    script.src = url;
    script.async = false; // ← 改为同步加载，确保立即执行
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      console.log(`✅ 脚本加载成功: ${url}`);
      
      // 延迟 200ms 让脚本完全初始化
      setTimeout(() => {
        if (restore) restore();
        resolve();
      }, 200);
    };

    script.onerror = (error) => {
      if (restore) restore();
      console.error(`❌ 脚本加载失败: ${url}`, error);
      reject(new Error(`Failed to load script: ${url}`));
    };

    (document.head || document.documentElement).appendChild(script);
  });
}

/**
 * 检测可能的全局变量名
 */
function detectOrtGlobal(): any {
  const possibleNames = ['ort', 'onnxruntime', 'onnx', 'ONNX'];
  
  for (const name of possibleNames) {
    const value = (window as any)[name];
    if (value !== undefined) {
      console.log(`✅ 检测到全局变量: ${name}`);
      return value;
    }
  }
  
  // 打印所有新增的全局变量（调试）
  console.log('🔍 当前全局变量（包含ort/onnx）:', 
    Object.keys(window).filter(k => 
      k.toLowerCase().includes('ort') || 
      k.toLowerCase().includes('onnx')
    )
  );
  
  return undefined;
}

/**
 * 加载 ONNX Runtime（带环境清理）
 */
export async function loadOnnxRuntime(): Promise<any> {
  // 先检查是否已加载
  const existing = detectOrtGlobal();
  if (existing) {
    console.log('✅ ONNX Runtime 已存在');
    return existing;
  }

  const cdnUrls = [
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js',
    'https://unpkg.com/onnxruntime-web@1.17.0/dist/ort.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.17.0/ort.min.js',
  ];

  for (let i = 0; i < cdnUrls.length; i++) {
    try {
      console.log(`🌐 尝试 CDN ${i + 1}/${cdnUrls.length}`);
      
      // ← 关键：清理环境变量
      await loadScript(cdnUrls[i], { cleanEnv: true });
      
      // 等待脚本完全初始化
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 检测全局变量
      const ortGlobal = detectOrtGlobal();
      
      if (ortGlobal) {
        console.log('✅ ONNX Runtime 已就绪');
        console.log('📦 版本信息:', ortGlobal.env?.versions || 'unknown');
        return ortGlobal;
      }
      
      console.warn(`⚠️ CDN ${i + 1}: 脚本已加载但未找到全局对象`);
      
    } catch (error) {
      console.warn(`❌ CDN ${i + 1}/${cdnUrls.length} 失败:`, error);
    }
    
    if (i < cdnUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // 最后尝试：直接从 window 中查找任何可能的 ONNX 对象
  console.log('🔍 最后尝试：扫描所有全局变量...');
  const allKeys = Object.keys(window);
  const onnxKeys = allKeys.filter(k => {
    const val = (window as any)[k];
    return val && typeof val === 'object' && (
      val.InferenceSession || 
      val.Tensor ||
      k.toLowerCase().includes('onnx')
    );
  });
  
  if (onnxKeys.length > 0) {
    console.log('🎯 找到可能的 ONNX 对象:', onnxKeys);
    return (window as any)[onnxKeys[0]];
  }
  
  throw new Error('所有 CDN 均加载失败，或未找到全局变量');
}

/**
 * 等待全局变量就绪
 */
export function waitForGlobal<T>(name: string, timeout = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const value = (window as any)[name];
      
      if (value !== undefined) {
        console.log(`✅ 全局变量已就绪: ${name}`);
        resolve(value);
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`Timeout waiting for global: ${name}`));
        return;
      }

      setTimeout(check, 100);
    };

    check();
  });
}