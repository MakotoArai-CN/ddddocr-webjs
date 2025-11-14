import { CONSTANTS } from './config';

const WASM_CDN_SOURCES = CONSTANTS.CDN_SOURCES.map(cdn => {
  if (cdn.includes('jsdelivr')) {
    return `${cdn}/npm/onnxruntime-web@${CONSTANTS.WASM_VERSION}/dist/`;
  }
  if (cdn.includes('unpkg')) {
    return `${cdn}/onnxruntime-web@${CONSTANTS.WASM_VERSION}/dist/`;
  }
  if (cdn.includes('cdnjs')) {
    return `${cdn}/ajax/libs/onnxruntime-web/${CONSTANTS.WASM_VERSION}/`;
  }
  if (cdn.includes('npmmirror')) {
    return `${cdn}/onnxruntime-web/${CONSTANTS.WASM_VERSION}/files/dist/`;
  }
  return `${cdn}/onnxruntime-web@${CONSTANTS.WASM_VERSION}/dist/`;
});

const WASM_FILES = [
  'ort-wasm.wasm',
  'ort-wasm-simd.wasm',
  'ort-wasm-threaded.wasm',
  'ort-wasm-simd-threaded.wasm',
];

interface WASMCacheItem {
  data: ArrayBuffer;
  timestamp: number;
  version: string;
}

class WASMCacheManager {
  private dbName = 'WASMCacheDB';
  private storeName = 'wasmStore';
  private db: IDBDatabase | null = null;
  private memoryCache = new Map<string, ArrayBuffer>();

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  async get(filename: string): Promise<ArrayBuffer | null> {
    if (this.memoryCache.has(filename)) {
      console.log(`✅ 使用内存缓存的 WASM: ${filename}`);
      return this.memoryCache.get(filename)!;
    }
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(filename);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cached = request.result as WASMCacheItem | undefined;
        if (!cached) {
          resolve(null);
          return;
        }
        if (Date.now() - cached.timestamp > CONSTANTS.CACHE_DURATION || cached.version !== CONSTANTS.WASM_VERSION) {
          console.log(`🗑️ WASM 缓存已过期: ${filename}`);
          this.delete(filename);
          resolve(null);
          return;
        }
        console.log(`✅ 使用 IndexedDB 缓存的 WASM: ${filename} (${(cached.data.byteLength / 1024).toFixed(2)} KB)`);
        this.memoryCache.set(filename, cached.data);
        resolve(cached.data);
      };
    });
  }

  async set(filename: string, data: ArrayBuffer): Promise<void> {
    if (!this.db) await this.init();
    this.memoryCache.set(filename, data);
    const cached: WASMCacheItem = {
      data,
      timestamp: Date.now(),
      version: CONSTANTS.WASM_VERSION,
    };
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(cached, filename);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log(`💾 WASM 已缓存: ${filename} (${(data.byteLength / 1024).toFixed(2)} KB)`);
        resolve();
      };
    });
  }

  async delete(filename: string): Promise<void> {
    this.memoryCache.delete(filename);
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(filename);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('🗑️ 所有 WASM 缓存已清除');
        resolve();
      };
    });
  }
}

const wasmCache = new WASMCacheManager();

async function downloadWASM(filename: string): Promise<ArrayBuffer> {
  for (let i = 0; i < WASM_CDN_SOURCES.length; i++) {
    const url = WASM_CDN_SOURCES[i] + filename;
    try {
      console.log(`🌐 尝试下载 WASM [${i + 1}/${WASM_CDN_SOURCES.length}]: ${new URL(url).hostname}`);
      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url,
          responseType: 'arraybuffer',
          timeout: 30000,
          headers: {
            'Accept': 'application/wasm',
            'Cache-Control': 'max-age=2592000',
          },
          onload: (response) => {
            if (response.status === 200) {
              resolve(response.response as ArrayBuffer);
            } else {
              reject(new Error(`HTTP ${response.status}`));
            }
          },
          onerror: reject,
          ontimeout: () => reject(new Error('下载超时')),
        });
      });
      console.log(`✅ WASM 下载成功: ${filename} (${(data.byteLength / 1024).toFixed(2)} KB)`);
      return data;
    } catch (error) {
      console.warn(`❌ WASM CDN ${i + 1} 失败:`, error);
      if (i === WASM_CDN_SOURCES.length - 1) {
        throw new Error(`所有 WASM CDN 均下载失败: ${filename}`);
      }
    }
  }
  throw new Error(`下载 WASM 失败: ${filename}`);
}

async function preloadAllWASM(): Promise<void> {
  console.log('📦 开始预下载 WASM 文件');
  const results = await Promise.allSettled(
    WASM_FILES.map(async (filename) => {
      const cached = await wasmCache.get(filename);
      if (cached) {
        return { filename, cached: true };
      }
      try {
        const data = await downloadWASM(filename);
        await wasmCache.set(filename, data);
        return { filename, cached: false };
      } catch (error) {
        console.warn(`⚠️ ${filename} 下载失败，将在运行时重试:`, error);
        return { filename, error };
      }
    })
  );
  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`✅ WASM 预加载完成: ${successful}/${WASM_FILES.length} 个文件`);
}

export async function setupWASMCache(): Promise<void> {
  await wasmCache.init();
  preloadAllWASM().catch(err => {
    console.warn('⚠️ WASM 预加载失败，将使用运行时下载:', err);
  });
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const filename = WASM_FILES.find(file => url.includes(file));
    if (!filename) {
      return originalFetch.call(this, input, init);
    }
    console.log(`🔍 拦截 WASM 请求: ${filename}`);
    try {
      let data = await wasmCache.get(filename);
      if (!data) {
        console.log(`📥 缓存未命中，下载 WASM: ${filename}`);
        data = await downloadWASM(filename);
        wasmCache.set(filename, data).catch(err => {
          console.warn(`⚠️ 缓存 WASM 失败: ${filename}`, err);
        });
      }
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': 'application/wasm',
          'Content-Length': String(data.byteLength),
        },
      });
    } catch (error) {
      console.error(`❌ WASM 加载失败: ${filename}`, error);
      return originalFetch.call(this, input, init);
    }
  };
  console.log('✅ WASM 缓存已启用');
}

export async function clearWASMCache(): Promise<void> {
  await wasmCache.clear();
}