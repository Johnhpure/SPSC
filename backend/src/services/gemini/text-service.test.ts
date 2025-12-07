/**
 * GeminiTextService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeminiTextService } from './text-service';
import { GeminiClientManager } from './client-manager';
import { Logger } from './logger';

describe('GeminiTextService - 单元测试', () => {
  let service: GeminiTextService;
  let originalMockMode: string | undefined;

  beforeEach(() => {
    // 保存原始 MOCK_MODE
    originalMockMode = process.env.MOCK_MODE;
    
    // 启用 MOCK_MODE 以避免真实 API 调用
    process.env.MOCK_MODE = 'true';
    
    // 重置单例
    const clientManager = GeminiClientManager.getInstance();
    clientManager.reset();
    Logger.resetInstance();
    
    // 创建服务实例
    service = new GeminiTextService();
  });

  afterEach(() => {
    // 恢复原始 MOCK_MODE
    if (originalMockMode !== undefined) {
      process.env.MOCK_MODE = originalMockMode;
    } else {
      delete process.env.MOCK_MODE;
    }
    
    // 清理
    const clientManager = GeminiClientManager.getInstance();
    clientManager.reset();
    Logger.resetInstance();
  });

  describe('generateText', () => {
    it('应该在 MOCK_MODE 下返回模拟响应', async () => {
      // 确保 MOCK_MODE 已启用
      process.env.MOCK_MODE = 'true';
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      const prompt = '测试提示词';
      const result = await service.generateText(prompt);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('模拟响应');
    });

    it('应该接受配置选项', async () => {
      const prompt = '测试提示词';
      const options = {
        model: 'gemini-2.0-flash',
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
      };

      const result = await service.generateText(prompt, options);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('应该在错误时返回降级响应', async () => {
      // 禁用 MOCK_MODE 以触发错误
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器（不初始化）
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const result = await service.generateText('测试');

      expect(result).toBeDefined();
      expect(result).toContain('不可用');
    });
  });

  describe('recommendCategories', () => {
    it('应该在 MOCK_MODE 下返回模拟类目列表', async () => {
      // 确保 MOCK_MODE 已启用
      process.env.MOCK_MODE = 'true';
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      const title = '测试产品';
      const description = '这是一个测试产品描述';

      const result = await service.recommendCategories(title, description);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('电子产品');
    });

    it('应该接受配置选项', async () => {
      const title = '测试产品';
      const description = '这是一个测试产品描述';
      const options = {
        temperature: 0.3,
        maxOutputTokens: 500,
      };

      const result = await service.recommendCategories(title, description, options);

      expect(Array.isArray(result)).toBe(true);
    });

    it('应该在错误时返回空数组', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const result = await service.recommendCategories('测试', '描述');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('应该返回字符串数组', async () => {
      const result = await service.recommendCategories('产品', '描述');

      expect(Array.isArray(result)).toBe(true);
      result.forEach(category => {
        expect(typeof category).toBe('string');
      });
    });
  });

  describe('analyzeProduct', () => {
    it('应该在 MOCK_MODE 下返回模拟产品分析', async () => {
      // 确保 MOCK_MODE 已启用
      process.env.MOCK_MODE = 'true';
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      const title = '测试产品';
      const description = '这是一个测试产品描述';

      const result = await service.analyzeProduct(title, description);

      expect(result).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.categories.length).toBeGreaterThan(0);
      expect(Array.isArray(result.tags)).toBe(true);
      expect(typeof result.description).toBe('string');
      expect(Array.isArray(result.suggestedImprovements)).toBe(true);
      expect(typeof result.qualityScore).toBe('number');
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('应该支持可选的图片 URL', async () => {
      const title = '测试产品';
      const description = '这是一个测试产品描述';
      const imageUrl = 'https://example.com/image.jpg';

      const result = await service.analyzeProduct(title, description, imageUrl);

      expect(result).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it('应该接受配置选项', async () => {
      const title = '测试产品';
      const description = '这是一个测试产品描述';
      const options = {
        temperature: 0.3,
        maxOutputTokens: 1000,
      };

      const result = await service.analyzeProduct(title, description, undefined, options);

      expect(result).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
    });

    it('应该在错误时返回默认分析结果', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const result = await service.analyzeProduct('测试', '描述');

      expect(result).toBeDefined();
      expect(Array.isArray(result.categories)).toBe(true);
      expect(result.categories.length).toBe(0);
      expect(result.qualityScore).toBe(0);
      expect(result.description).toContain('不可用');
    });

    it('应该返回符合 ProductAnalysis 接口的对象', async () => {
      const result = await service.analyzeProduct('产品', '描述');

      // 验证所有必需字段
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('tags');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('suggestedImprovements');
      expect(result).toHaveProperty('qualityScore');

      // 验证字段类型
      expect(Array.isArray(result.categories)).toBe(true);
      expect(Array.isArray(result.tags)).toBe(true);
      expect(typeof result.description).toBe('string');
      expect(Array.isArray(result.suggestedImprovements)).toBe(true);
      expect(typeof result.qualityScore).toBe('number');
    });

    it('应该返回有效的质量评分 (0-100)', async () => {
      const result = await service.analyzeProduct('产品', '描述');

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('MOCK_MODE 行为', () => {
    it('应该在 MOCK_MODE 下跳过真实 API 调用', async () => {
      // 确保 MOCK_MODE 已启用
      expect(process.env.MOCK_MODE).toBe('true');

      // 所有方法都应该成功返回而不需要初始化客户端
      const textResult = await service.generateText('测试');
      expect(textResult).toBeDefined();

      const categoriesResult = await service.recommendCategories('产品', '描述');
      expect(categoriesResult).toBeDefined();

      const analysisResult = await service.analyzeProduct('产品', '描述');
      expect(analysisResult).toBeDefined();
    });

    it('应该在 MOCK_MODE 下返回确定性的结果', async () => {
      // 多次调用应该返回相同的模拟数据
      const result1 = await service.recommendCategories('产品', '描述');
      const result2 = await service.recommendCategories('产品', '描述');

      expect(result1).toEqual(result2);
    });
  });

  describe('日志记录', () => {
    it('应该记录 API 调用日志', async () => {
      const logger = Logger.getInstance();
      const initialStats = logger.getUsageStats();

      await service.generateText('测试');

      const finalStats = logger.getUsageStats();
      expect(finalStats.totalCalls).toBeGreaterThan(initialStats.totalCalls);
    });

    it('应该记录成功的调用', async () => {
      // 确保 MOCK_MODE 已启用以获得成功的调用
      process.env.MOCK_MODE = 'true';
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      const logger = Logger.getInstance();
      logger.clearMetrics();

      await service.generateText('测试');

      const stats = logger.getUsageStats();
      expect(stats.successfulCalls).toBeGreaterThan(0);
    });

    it('应该记录失败的调用', async () => {
      // 禁用 MOCK_MODE 以触发错误
      process.env.MOCK_MODE = 'false';
      
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const logger = Logger.getInstance();
      logger.clearMetrics();

      await service.generateText('测试');

      const stats = logger.getUsageStats();
      expect(stats.failedCalls).toBeGreaterThan(0);
    });
  });
});
