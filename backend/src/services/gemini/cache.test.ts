import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LRUCache,
  generateHash,
  createTextCacheKey,
  createImageCacheKey,
  createFileCacheKey,
  textCache,
  imageCache,
  fileCache,
  getAllCacheStats,
  clearAllCaches,
} from './cache';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>({
      maxSize: 3,
      ttl: 1000, // 1 秒
      cleanupInterval: 500,
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('基本操作', () => {
    it('应该能够设置和获取值', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('应该在键不存在时返回 undefined', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('应该能够删除值', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该能够检查键是否存在', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('应该能够清空缓存', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('LRU 策略', () => {
    it('应该在缓存满时移除最久未使用的项', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // 缓存已满（maxSize=3），添加第 4 个项应该移除 key1
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('应该在访问时更新项的位置', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // 访问 key1，使其成为最新使用的
      cache.get('key1');

      // 添加 key4，应该移除 key2（最久未使用）
      cache.set('key4', 'value4');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('过期处理', () => {
    it('应该在 TTL 过期后返回 undefined', async () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // 等待超过 TTL
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该在检查时移除过期的项', async () => {
      cache.set('key1', 'value1');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.has('key1')).toBe(false);
    });

    it('应该定期清理过期项', async () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // 等待过期和清理
      await new Promise((resolve) => setTimeout(resolve, 1600));

      const stats = cache.getStats();
      expect(stats.expirations).toBeGreaterThan(0);
    });
  });

  describe('统计信息', () => {
    it('应该正确跟踪命中和未命中', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // 命中
      cache.get('key2'); // 未命中
      cache.get('key1'); // 命中

      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('应该跟踪当前大小', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.currentSize).toBe(2);
      expect(stats.maxSize).toBe(3);
    });

    it('应该跟踪驱逐次数', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // 触发驱逐

      const stats = cache.getStats();
      expect(stats.evictions).toBe(1);
    });

    it('应该能够重置统计信息', () => {
      cache.set('key1', 'value1');
      cache.get('key1');

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});

describe('哈希工具函数', () => {
  it('应该为相同的字符串生成相同的哈希', () => {
    const hash1 = generateHash('test');
    const hash2 = generateHash('test');
    expect(hash1).toBe(hash2);
  });

  it('应该为不同的字符串生成不同的哈希', () => {
    const hash1 = generateHash('test1');
    const hash2 = generateHash('test2');
    expect(hash1).not.toBe(hash2);
  });

  it('应该为相同的对象生成相同的哈希', () => {
    const obj = { a: 1, b: 2 };
    const hash1 = generateHash(obj);
    const hash2 = generateHash(obj);
    expect(hash1).toBe(hash2);
  });

  it('应该为键顺序不同但内容相同的对象生成相同的哈希', () => {
    const obj1 = { a: 1, b: 2 };
    const obj2 = { b: 2, a: 1 };
    const hash1 = generateHash(obj1);
    const hash2 = generateHash(obj2);
    expect(hash1).toBe(hash2);
  });

  it('应该为 Buffer 生成哈希', () => {
    const buffer = Buffer.from('test');
    const hash = generateHash(buffer);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
  });
});

describe('缓存键生成函数', () => {
  it('应该为文本生成创建唯一的缓存键', () => {
    const key1 = createTextCacheKey('prompt1', { temp: 0.7 });
    const key2 = createTextCacheKey('prompt1', { temp: 0.7 });
    const key3 = createTextCacheKey('prompt2', { temp: 0.7 });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^text:/);
  });

  it('应该为图像分析创建唯一的缓存键（URL）', () => {
    const key1 = createImageCacheKey('http://example.com/image.jpg', 'analyze');
    const key2 = createImageCacheKey('http://example.com/image.jpg', 'analyze');
    const key3 = createImageCacheKey('http://example.com/other.jpg', 'analyze');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^image:/);
  });

  it('应该为图像分析创建唯一的缓存键（Buffer）', () => {
    const buffer1 = Buffer.from('image data');
    const buffer2 = Buffer.from('image data');
    const buffer3 = Buffer.from('other data');

    const key1 = createImageCacheKey(buffer1, 'analyze');
    const key2 = createImageCacheKey(buffer2, 'analyze');
    const key3 = createImageCacheKey(buffer3, 'analyze');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('应该为文件 URI 创建唯一的缓存键', () => {
    const key1 = createFileCacheKey('/path/to/file.txt');
    const key2 = createFileCacheKey('/path/to/file.txt');
    const key3 = createFileCacheKey('/path/to/other.txt');

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key1).toMatch(/^file:/);
  });
});

describe('预配置的缓存实例', () => {
  beforeEach(() => {
    clearAllCaches();
  });

  it('应该提供文本缓存实例', () => {
    expect(textCache).toBeDefined();
    textCache.set('test', 'value');
    expect(textCache.get('test')).toBe('value');
  });

  it('应该提供图像缓存实例', () => {
    expect(imageCache).toBeDefined();
    imageCache.set('test', { result: 'data' });
    expect(imageCache.get('test')).toEqual({ result: 'data' });
  });

  it('应该提供文件缓存实例', () => {
    expect(fileCache).toBeDefined();
    fileCache.set('test', 'file://uri');
    expect(fileCache.get('test')).toBe('file://uri');
  });

  it('应该能够获取所有缓存的统计信息', () => {
    textCache.set('key1', 'value1');
    imageCache.set('key2', { data: 'value2' });
    fileCache.set('key3', 'value3');

    const stats = getAllCacheStats();

    expect(stats.text).toBeDefined();
    expect(stats.image).toBeDefined();
    expect(stats.file).toBeDefined();
    expect(stats.text.currentSize).toBe(1);
    expect(stats.image.currentSize).toBe(1);
    expect(stats.file.currentSize).toBe(1);
  });

  it('应该能够清空所有缓存', () => {
    textCache.set('key1', 'value1');
    imageCache.set('key2', { data: 'value2' });
    fileCache.set('key3', 'value3');

    clearAllCaches();

    expect(textCache.get('key1')).toBeUndefined();
    expect(imageCache.get('key2')).toBeUndefined();
    expect(fileCache.get('key3')).toBeUndefined();
  });
});
