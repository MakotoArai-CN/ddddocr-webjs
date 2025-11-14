export interface CachedModel {
  model: ArrayBuffer;
  charsets: string[];
  timestamp: number;
  version: string;
}

export interface OCRResult {
  text: string;
  confidence?: number;
}

/**
 * 事件类型定义
 */
export interface OCREvents {
  'init:start': void;
  'init:complete': void;
  'init:error': Error;
  'detect:found': { element: Element; type: string };
  'recognize:start': { element: Element };
  'recognize:complete': { element: Element; result: OCRResult };
  'recognize:error': { element: Element; error: Error };
}

/**
 * 事件发射器
 */
export class EventEmitter<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<(data: any) => void>>();

  on<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off<K extends keyof T>(event: K, callback: (data: T[K]) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`事件处理错误 [${String(event)}]:`, error);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}