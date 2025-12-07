import crypto from 'crypto';

/**
 * 缓存条目接口
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
}

/**
 * 缓存统计信息接口
 */
interface CacheStats {
  totalRequests: number;
  hits: number;
  misses: number;
  hitRate: number;
  currentSize: number;
  maxSize: number;
  evictions: number;
  expirations: number;
}

/**
 * LRU 缓存配置接口
 */
interface LRUCacheConfig {
  maxSize: number;
  ttl: number; // 毫秒
  cleanupInterval?: number; // 毫秒
}

/**
 * LRU 缓存实现
 * 使用 Map 保持插入顺序，实现 O(1) 的读写性能
 */
export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;
  private cleanupInterval: number;
  private cleanupTimer: NodeJS.Timeout | null = null;

  // 统计信息
  private stats = {
    totalRequests: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  constructor(config: LRUCacheConfig) {
    this.cache = new Map();
    this.maxSize = config.maxSize;
    this.ttl = config.ttl;
    this.cleanupInterval = config.cleanupInterval || 60000; // 默认 1 分钟

    // 启动定期清理
    this.startCleanup();
  }

  /**
   * 获取缓存值
   */
  get(key: string): T | undefined {
    this.stats.totalRequests++;

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.expirations++;
      return undefined;
    }

    // LRU: 将访问的项移到最后（最新）
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: T): void {
    const now = Date.now();

    // 如果键已存在，先删除（更新）
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // 如果缓存已满，移除最旧的项（LRU）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    // 添加新条目
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: now + this.ttl,
    };

    this.cache.set(key, entry);
  }

  /**
   * 删除缓存值
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.stats.evictions += this.cache.size;
  }

  /**
   * 检查键是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }

    return true;
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const hitRate =
      this.stats.totalRequests > 0
        ? this.stats.hits / this.stats.totalRequests
        : 0;

    return {
      totalRequests: this.stats.totalRequests,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 10000) / 100, // 百分比，保留两位小数
      currentSize: this.cache.size,
      maxSize: this.maxSize,
      evictions: this.stats.evictions,
      expirations: this.stats.expirations,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
    };
  }

  /**
   * 启动定期清理过期条目
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupInterval);

    // 确保进程退出时清理定时器
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * 清理所有过期条目
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    this.stats.expirations += expiredCount;
  }

  /**
   * 停止清理定时器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

/**
 * 生成缓存键的哈希值
 */
export function generateHash(data: string | Buffer | object): string {
  const hash = crypto.createHash('sha256');

  if (typeof data === 'string') {
    hash.update(data);
  } else if (Buffer.isBuffer(data)) {
    hash.update(data);
  } else {
    // 对象转为稳定的 JSON 字符串
    hash.update(JSON.stringify(data, Object.keys(data).sort()));
  }

  return hash.digest('hex');
}

/**
 * 为文本生成创建缓存键
 */
export function createTextCacheKey(
  prompt: string,
  options?: Record<string, any>
): string {
  const data = {
    prompt,
    options: options || {},
  };
  return `text:${generateHash(data)}`;
}

/**
 * 为图像分析创建缓存键
 */
export function createImageCacheKey(
  imageSource: string | Buffer,
  prompt: string,
  options?: Record<string, any>
): string {
  let imageHash: string;

  if (typeof imageSource === 'string') {
    // URL 直接使用
    imageHash = generateHash(imageSource);
  } else {
    // Buffer 计算哈希
    imageHash = generateHash(imageSource);
  }

  const data = {
    image: imageHash,
    prompt,
    options: options || {},
  };

  return `image:${generateHash(data)}`;
}

/**
 * 为文件 URI 创建缓存键
 */
export function createFileCacheKey(filePath: string): string {
  return `file:${generateHash(filePath)}`;
}

// ============================================================================
// 预配置的缓存实例
// ============================================================================

/**
 * 文本生成缓存
 * - 最大容量: 1000 条
 * - TTL: 1 小时
 */
export const textCache = new LRUCache<string>({
  maxSize: 1000,
  ttl: 60 * 60 * 1000, // 1 小时
  cleanupInterval: 5 * 60 * 1000, // 5 分钟清理一次
});

/**
 * 图像分析缓存
 * - 最大容量: 500 条
 * - TTL: 24 小时
 */
export const imageCache = new LRUCache<any>({
  maxSize: 500,
  ttl: 24 * 60 * 60 * 1000, // 24 小时
  cleanupInterval: 30 * 60 * 1000, // 30 分钟清理一次
});

/**
 * 文件 URI 缓存
 * - 最大容量: 200 条
 * - TTL: 7 天（文件通常长期有效）
 */
export const fileCache = new LRUCache<string>({
  maxSize: 200,
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 天
  cleanupInterval: 60 * 60 * 1000, // 1 小时清理一次
});

/**
 * 获取所有缓存的统计信息
 */
export function getAllCacheStats() {
  return {
    text: textCache.getStats(),
    image: imageCache.getStats(),
    file: fileCache.getStats(),
  };
}

/**
 * 清空所有缓存
 */
export function clearAllCaches(): void {
  textCache.clear();
  imageCache.clear();
  fileCache.clear();
}

/**
 * 销毁所有缓存（清理定时器）
 */
export function destroyAllCaches(): void {
  textCache.destroy();
  imageCache.destroy();
  fileCache.destroy();
}
