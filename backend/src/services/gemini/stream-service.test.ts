/**
 * GeminiStreamService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GeminiStreamService, StreamChunk } from './stream-service';
import { GeminiClientManager } from './client-manager';
import { Logger } from './logger';
import { Response } from 'express';

describe('GeminiStreamService - 单元测试', () => {
  let service: GeminiStreamService;
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
    service = new GeminiStreamService();
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

  describe('generateContentStream', () => {
    it('应该在 MOCK_MODE 下返回流式响应', async () => {
      // 确保 MOCK_MODE 已启用
      process.env.MOCK_MODE = 'true';
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      const prompt = '测试提示词';
      const chunks: StreamChunk[] = [];

      // 收集所有流式响应块
      for await (const chunk of service.generateContentStream(prompt)) {
        chunks.push(chunk);
      }

      // 验证至少有一个块
      expect(chunks.length).toBeGreaterThan(0);
      
      // 验证最后一个块标记为完成
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.done).toBe(true);
      
      // 验证所有块都有 text 字段
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('text');
        expect(typeof chunk.text).toBe('string');
      });
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

      const chunks: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream(prompt, options)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('应该在错误时返回带有 error 字段的块', async () => {
      // 禁用 MOCK_MODE 以触发错误
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器（不初始化）
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const chunks: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream('测试')) {
        chunks.push(chunk);
      }

      // 应该至少有一个块
      expect(chunks.length).toBeGreaterThan(0);
      
      // 最后一个块应该包含错误信息
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.done).toBe(true);
      expect(lastChunk.error).toBeDefined();
      expect(typeof lastChunk.error).toBe('string');
    });

    it('应该返回完整的流式响应', async () => {
      const prompt = '测试提示词';
      const chunks: StreamChunk[] = [];

      for await (const chunk of service.generateContentStream(prompt)) {
        chunks.push(chunk);
      }

      // 拼接所有非完成块的文本
      const fullText = chunks
        .filter(chunk => !chunk.done)
        .map(chunk => chunk.text)
        .join('');

      // 在 MOCK_MODE 下应该有内容
      expect(fullText.length).toBeGreaterThan(0);
      expect(fullText).toContain('模拟流式响应');
    });

    it('应该保证流的顺序性', async () => {
      const chunks: StreamChunk[] = [];

      for await (const chunk of service.generateContentStream('测试')) {
        chunks.push(chunk);
      }

      // 验证只有最后一个块的 done 为 true
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i].done).toBe(false);
      }
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('应该处理空提示词', async () => {
      const chunks: StreamChunk[] = [];

      for await (const chunk of service.generateContentStream('')) {
        chunks.push(chunk);
      }

      // 即使提示词为空，也应该返回响应
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].done).toBe(true);
    });
  });

  describe('streamToSSE', () => {
    it('应该通过 SSE 发送流式响应', async () => {
      // 创建模拟的 Response 对象
      const writtenData: string[] = [];
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          writtenData.push(data);
          return true;
        }),
        end: vi.fn(),
        writableEnded: false,
      } as unknown as Response;

      const prompt = '测试提示词';

      // 调用 streamToSSE
      await service.streamToSSE(mockRes, prompt);

      // 验证设置了正确的响应头
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');

      // 验证写入了数据
      expect(mockRes.write).toHaveBeenCalled();
      expect(writtenData.length).toBeGreaterThan(0);

      // 验证发送了初始连接确认
      const firstData = writtenData[0];
      expect(firstData).toContain('connected');

      // 验证最后调用了 end
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('应该发送正确格式的 SSE 数据', async () => {
      const writtenData: string[] = [];
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          writtenData.push(data);
          return true;
        }),
        end: vi.fn(),
        writableEnded: false,
      } as unknown as Response;

      await service.streamToSSE(mockRes, '测试');

      // 验证所有写入的数据都是有效的 SSE 格式
      writtenData.forEach(data => {
        expect(data).toMatch(/^data: .+\n\n$/);
      });

      // 验证至少有一个 done 类型的消息
      const hasDoneMessage = writtenData.some(data => {
        try {
          const jsonMatch = data.match(/data: (.+)\n\n/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            return parsed.type === 'done';
          }
        } catch (e) {
          // 忽略解析错误
        }
        return false;
      });
      expect(hasDoneMessage).toBe(true);
    });

    it('应该在错误时发送错误消息', async () => {
      // 禁用 MOCK_MODE 以触发错误
      process.env.MOCK_MODE = 'false';
      
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const writtenData: string[] = [];
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn((data: string) => {
          writtenData.push(data);
          return true;
        }),
        end: vi.fn(),
        writableEnded: false,
      } as unknown as Response;

      await service.streamToSSE(mockRes, '测试');

      // 验证发送了错误消息
      const hasErrorMessage = writtenData.some(data => {
        try {
          const jsonMatch = data.match(/data: (.+)\n\n/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            return parsed.type === 'error' || (parsed.type === 'done' && parsed.error);
          }
        } catch (e) {
          // 忽略解析错误
        }
        return false;
      });
      expect(hasErrorMessage).toBe(true);
    });

    it('应该处理客户端断开连接', async () => {
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(() => true),
        end: vi.fn(),
        writableEnded: true, // 模拟客户端已断开
      } as unknown as Response;

      // 应该能够正常完成而不抛出错误
      await expect(service.streamToSSE(mockRes, '测试')).resolves.not.toThrow();
    });

    it('应该接受配置选项', async () => {
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(() => true),
        end: vi.fn(),
        writableEnded: false,
      } as unknown as Response;

      const options = {
        model: 'gemini-2.0-flash',
        temperature: 0.7,
      };

      await service.streamToSSE(mockRes, '测试', options);

      // 验证成功完成
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('MOCK_MODE 行为', () => {
    it('应该在 MOCK_MODE 下跳过真实 API 调用', async () => {
      // 确保 MOCK_MODE 已启用
      expect(process.env.MOCK_MODE).toBe('true');

      // 流式生成应该成功返回而不需要初始化客户端
      const chunks: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream('测试')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('应该在 MOCK_MODE 下返回确定性的结果', async () => {
      const prompt = '测试提示词';

      // 第一次调用
      const chunks1: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream(prompt)) {
        chunks1.push(chunk);
      }

      // 第二次调用
      const chunks2: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream(prompt)) {
        chunks2.push(chunk);
      }

      // 应该返回相同数量的块
      expect(chunks1.length).toBe(chunks2.length);

      // 应该返回相同的内容
      const text1 = chunks1.filter(c => !c.done).map(c => c.text).join('');
      const text2 = chunks2.filter(c => !c.done).map(c => c.text).join('');
      expect(text1).toBe(text2);
    });
  });

  describe('日志记录', () => {
    it('应该记录流式 API 调用日志', async () => {
      const logger = Logger.getInstance();
      const initialStats = logger.getUsageStats();

      const chunks: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream('测试')) {
        chunks.push(chunk);
      }

      const finalStats = logger.getUsageStats();
      expect(finalStats.totalCalls).toBeGreaterThan(initialStats.totalCalls);
    });

    it('应该记录成功的流式调用', async () => {
      // 确保 MOCK_MODE 已启用
      process.env.MOCK_MODE = 'true';
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      const logger = Logger.getInstance();
      logger.clearMetrics();

      const chunks: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream('测试')) {
        chunks.push(chunk);
      }

      const stats = logger.getUsageStats();
      expect(stats.successfulCalls).toBeGreaterThan(0);
    });

    it('应该记录失败的流式调用', async () => {
      // 禁用 MOCK_MODE 以触发错误
      process.env.MOCK_MODE = 'false';
      
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const logger = Logger.getInstance();
      logger.clearMetrics();

      const chunks: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream('测试')) {
        chunks.push(chunk);
      }

      const stats = logger.getUsageStats();
      expect(stats.failedCalls).toBeGreaterThan(0);
    });

    it('应该记录 SSE 调用日志', async () => {
      const logger = Logger.getInstance();
      logger.clearMetrics();

      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(() => true),
        end: vi.fn(),
        writableEnded: false,
      } as unknown as Response;

      await service.streamToSSE(mockRes, '测试');

      const stats = logger.getUsageStats();
      expect(stats.totalCalls).toBeGreaterThan(0);
    });
  });

  describe('错误处理', () => {
    it('应该优雅地处理流式生成错误', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      // 应该不抛出异常
      const chunks: StreamChunk[] = [];
      for await (const chunk of service.generateContentStream('测试')) {
        chunks.push(chunk);
      }
      
      // 验证收到了错误块
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].error).toBeDefined();
    });

    it('应该优雅地处理 SSE 错误', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();

      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(() => true),
        end: vi.fn(),
        writableEnded: false,
      } as unknown as Response;

      // 应该不抛出异常
      await expect(service.streamToSSE(mockRes, '测试')).resolves.not.toThrow();
    });

    it('应该在响应已结束时不写入数据', async () => {
      const mockRes = {
        setHeader: vi.fn(),
        write: vi.fn(() => true),
        end: vi.fn(),
        writableEnded: true, // 响应已结束
      } as unknown as Response;

      await service.streamToSSE(mockRes, '测试');

      // write 应该被调用很少次数或不被调用（只有初始连接确认）
      expect(mockRes.write).toHaveBeenCalledTimes(1); // 只有初始连接确认
    });
  });
});
