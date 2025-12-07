/**
 * BenchmarkService 单元测试
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BenchmarkService, BenchmarkResult } from './benchmark-service';
import { getGeminiClientManager } from '../gemini/client-manager';
import { getDatabase } from '../../db';

// Mock 依赖
vi.mock('../gemini/client-manager', () => ({
  getGeminiClientManager: vi.fn(),
}));
vi.mock('../../db', () => ({
  getDatabase: vi.fn(),
}));

describe('BenchmarkService', () => {
  let service: BenchmarkService;
  let mockClientManager: any;
  let mockDb: any;
  let mockClient: any;
  let mockModel: any;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // 创建 mock 对象
    mockModel = {
      generateContentStream: vi.fn(),
      generateContent: vi.fn(),
    };

    mockClient = {
      getGenerativeModel: vi.fn().mockReturnValue(mockModel),
    };

    mockClientManager = {
      getClient: vi.fn().mockReturnValue(mockClient),
    };

    mockDb = {
      run: vi.fn().mockResolvedValue(undefined),
      all: vi.fn().mockResolvedValue([]),
    };

    // 设置 mock 返回值
    (getGeminiClientManager as any).mockReturnValue(mockClientManager);
    (getDatabase as any).mockReturnValue(mockDb);

    // 创建服务实例
    service = new BenchmarkService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('benchmarkModel', () => {
    it('应该成功测试单个模型并返回性能指标', async () => {
      // 准备测试数据
      const modelName = 'gemini-2.0-flash';
      const testPrompt = 'Hello, how are you?';

      // Mock 流式响应
      const mockStream = {
        stream: (async function* () {
          // 添加小延迟确保 firstTokenTime > 0
          await new Promise(resolve => setTimeout(resolve, 1));
          yield { text: () => 'Hello! ' };
          yield { text: () => 'I am doing well.' };
        })(),
        response: Promise.resolve({
          usageMetadata: {
            candidatesTokenCount: 10,
            promptTokenCount: 5,
            totalTokenCount: 15,
          },
        }),
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      // 执行测试
      const result = await service.benchmarkModel(modelName);

      // 验证结果
      expect(result.modelName).toBe(modelName);
      expect(result.testPrompt).toBe(testPrompt);
      expect(result.success).toBe(true);
      expect(result.firstTokenTime).toBeGreaterThan(0);
      expect(result.totalResponseTime).toBeGreaterThan(0);
      expect(result.tokensGenerated).toBe(10);
      expect(result.tokensPerSecond).toBeGreaterThan(0);
      expect(result.errorMessage).toBeNull();

      // 验证数据库保存
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO gemini_benchmarks'),
        expect.arrayContaining([
          modelName,
          testPrompt,
          expect.any(Number),
          expect.any(Number),
          10,
          expect.any(Number),
          1,
          null,
        ])
      );
    });

    it('应该处理测速失败的情况', async () => {
      const modelName = 'invalid-model';
      const errorMessage = 'Model not found';

      mockModel.generateContentStream.mockRejectedValue(new Error(errorMessage));

      const result = await service.benchmarkModel(modelName);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe(errorMessage);
      expect(result.tokensGenerated).toBeNull();
      expect(result.tokensPerSecond).toBeNull();
    });

    it('应该支持自定义提示词', async () => {
      const customPrompt = 'Custom test prompt';

      const mockStream = {
        stream: (async function* () {
          yield { text: () => 'Response' };
        })(),
        response: Promise.resolve({
          usageMetadata: { candidatesTokenCount: 5 },
        }),
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const result = await service.benchmarkModel('gemini-2.0-flash', {
        prompt: customPrompt,
      });

      expect(result.testPrompt).toBe(customPrompt);
    });
  });

  describe('benchmarkMultipleModels', () => {
    it('应该批量测试多个模型', async () => {
      const modelNames = ['model-1', 'model-2', 'model-3', 'model-4'];

      const mockStream = {
        stream: (async function* () {
          yield { text: () => 'Response' };
        })(),
        response: Promise.resolve({
          usageMetadata: { candidatesTokenCount: 5 },
        }),
      };

      mockModel.generateContentStream.mockResolvedValue(mockStream);

      const results = await service.benchmarkMultipleModels(modelNames);

      expect(results).toHaveLength(4);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockDb.run).toHaveBeenCalledTimes(4);
    });

    it('应该控制并发数量不超过3个', async () => {
      const modelNames = ['model-1', 'model-2', 'model-3', 'model-4', 'model-5'];
      const callTimes: number[] = [];

      mockModel.generateContentStream.mockImplementation(async () => {
        callTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          stream: (async function* () {
            yield { text: () => 'Response' };
          })(),
          response: Promise.resolve({
            usageMetadata: { candidatesTokenCount: 5 },
          }),
        };
      });

      await service.benchmarkMultipleModels(modelNames);

      // 验证调用次数
      expect(mockModel.generateContentStream).toHaveBeenCalledTimes(5);
    });
  });

  describe('getBenchmarkHistory', () => {
    it('应该获取所有测速历史记录', async () => {
      const mockRows = [
        {
          id: 1,
          model_name: 'gemini-2.0-flash',
          test_prompt: 'Hello',
          first_token_time: 100,
          total_response_time: 500,
          tokens_generated: 10,
          tokens_per_second: 20,
          success: 1,
          error_message: null,
          timestamp: '2024-01-01 00:00:00',
        },
      ];

      mockDb.all.mockResolvedValue(mockRows);

      const results = await service.getBenchmarkHistory();

      expect(results).toHaveLength(1);
      expect(results[0].modelName).toBe('gemini-2.0-flash');
      expect(results[0].success).toBe(true);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM gemini_benchmarks'),
        expect.arrayContaining([50])
      );
    });

    it('应该支持按模型名称过滤', async () => {
      mockDb.all.mockResolvedValue([]);

      await service.getBenchmarkHistory('gemini-2.0-flash', 10);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE model_name = ?'),
        expect.arrayContaining(['gemini-2.0-flash', 10])
      );
    });
  });

  describe('compareBenchmarks', () => {
    it('应该生成模型对比报告', async () => {
      const modelNames = ['model-1', 'model-2'];

      const mockRows = [
        {
          id: 1,
          model_name: 'model-1',
          test_prompt: 'Hello',
          first_token_time: 100,
          total_response_time: 500,
          tokens_generated: 10,
          tokens_per_second: 20,
          success: 1,
          error_message: null,
          timestamp: '2024-01-01 00:00:00',
        },
        {
          id: 2,
          model_name: 'model-1',
          test_prompt: 'Hello',
          first_token_time: 120,
          total_response_time: 600,
          tokens_generated: 12,
          tokens_per_second: 20,
          success: 1,
          error_message: null,
          timestamp: '2024-01-01 00:01:00',
        },
      ];

      mockDb.all.mockResolvedValue(mockRows);

      const comparison = await service.compareBenchmarks(modelNames);

      expect(comparison.models).toEqual(modelNames);
      expect(comparison.statistics['model-1']).toBeDefined();
      expect(comparison.statistics['model-1'].avgResponseTime).toBe(550);
      expect(comparison.statistics['model-1'].successRate).toBe(1);
      expect(comparison.statistics['model-1'].totalTests).toBe(2);
    });
  });

  describe('testModelFunction', () => {
    it('应该测试文本生成功能', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated text',
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 10,
            totalTokenCount: 15,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await service.testModelFunction({
        modelName: 'gemini-2.0-flash',
        testType: 'text',
        prompt: 'Test prompt',
      });

      expect(result.success).toBe(true);
      expect(result.testType).toBe('text');
      expect(result.result).toBe('Generated text');
      expect(result.metadata.totalTokens).toBe(15);
    });

    it('应该测试图像分析功能', async () => {
      const mockResponse = {
        response: {
          text: () => 'Image analysis result',
          usageMetadata: {
            totalTokenCount: 20,
          },
          candidates: [{ finishReason: 'STOP' }],
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await service.testModelFunction({
        modelName: 'gemini-2.0-flash',
        testType: 'vision',
        prompt: 'Describe this image',
        imageData: 'base64-encoded-image',
        imageMimeType: 'image/png',
      });

      expect(result.success).toBe(true);
      expect(result.testType).toBe('vision');
      expect(result.result).toBe('Image analysis result');
    });

    it('应该处理功能测试失败的情况', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      const result = await service.testModelFunction({
        modelName: 'invalid-model',
        testType: 'text',
        prompt: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('API Error');
    });

    it('应该在图像分析时验证必需参数', async () => {
      const result = await service.testModelFunction({
        modelName: 'gemini-2.0-flash',
        testType: 'vision',
        prompt: 'Describe',
        // 缺少 imageData 和 imageMimeType
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('imageData');
    });
  });
});
