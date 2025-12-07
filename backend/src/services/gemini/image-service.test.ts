/**
 * GeminiImageService 单元测试
 * 
 * 测试图像服务的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GeminiImageService } from './image-service';
import { GeminiClientManager } from './client-manager';

describe('GeminiImageService 单元测试', () => {
  let service: GeminiImageService;
  let originalMockMode: string | undefined;

  beforeEach(() => {
    // 保存原始 MOCK_MODE
    originalMockMode = process.env.MOCK_MODE;
    // 启用 MOCK_MODE 以避免真实 API 调用
    process.env.MOCK_MODE = 'true';
    
    // 重置客户端管理器
    GeminiClientManager.getInstance().reset();
    GeminiClientManager.getInstance().initialize();
    
    service = new GeminiImageService();
  });

  afterEach(() => {
    // 恢复原始 MOCK_MODE
    if (originalMockMode !== undefined) {
      process.env.MOCK_MODE = originalMockMode;
    } else {
      delete process.env.MOCK_MODE;
    }
    
    // 重置客户端管理器
    GeminiClientManager.getInstance().reset();
  });

  /**
   * 测试图像分析（URL 输入）
   * _需求: 3.1_
   */
  describe('图像分析 - URL 输入', () => {
    it('应该能够分析图像 URL', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      const prompt = '分析这个产品图像';
      
      const result = await service.analyzeImage(imageUrl, prompt);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('objects');
      expect(result).toHaveProperty('colors');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('suggestions');
    });
  });

  /**
   * 测试图像分析（Buffer 输入）
   * _需求: 3.1_
   */
  describe('图像分析 - Buffer 输入', () => {
    it('应该能够分析图像 Buffer', async () => {
      const imageBuffer = Buffer.from('fake image data');
      const prompt = '分析这个产品图像';
      
      const result = await service.analyzeImage(imageBuffer, prompt);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('objects');
      expect(result).toHaveProperty('colors');
    });
  });

  /**
   * 测试图像生成
   * _需求: 4.2_
   */
  describe('图像生成', () => {
    it('应该能够生成图像', async () => {
      const prompt = '生成一个产品图像';
      
      const result = await service.generateImage(prompt, { numberOfImages: 1 });
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('imageBytes');
      expect(result[0]).toHaveProperty('finishReason');
    });

    it('应该能够生成多个图像', async () => {
      const prompt = '生成产品图像';
      const numberOfImages = 3;
      
      const result = await service.generateImage(prompt, { numberOfImages });
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * 测试图像保存
   * _需求: 4.5_
   */
  describe('图像保存', () => {
    it('应该能够保存图像到本地', async () => {
      const imageData = Buffer.from('test image data').toString('base64');
      const filename = 'test-image.png';
      
      const result = await service.saveImage(imageData, filename);
      
      expect(result).toHaveProperty('savedPath');
      expect(result).toHaveProperty('url');
      expect(result.savedPath).toContain(filename);
      expect(result.url).toContain(filename);
    });
  });

  /**
   * 测试产品图像优化
   */
  describe('产品图像优化', () => {
    it('应该能够优化产品图像', async () => {
      const imageUrl = 'https://example.com/product.jpg';
      const productInfo = {
        title: '测试产品',
        description: '这是一个测试产品',
        category: '电子产品',
      };
      
      const result = await service.optimizeProductImage(imageUrl, productInfo);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
