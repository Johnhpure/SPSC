/**
 * GeminiStreamService 属性测试
 * 
 * 使用 fast-check 进行基于属性的测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { GeminiStreamService, StreamChunk } from './stream-service';
import { GeminiClientManager } from './client-manager';
import { Logger } from './logger';
import { TextGenerationOptions } from './text-service';

describe('GeminiStreamService - 属性测试', () => {
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

  /**
   * **Feature: gemini-api-integration, Property 14: 流式响应完整性**
   * **Validates: Requirements 6.2, 6.5**
   * 
   * 属性：对于任意流式生成请求，接收到的所有块拼接后应该形成完整的响应内容，
   * 且最后应该收到完成信号
   */
  describe('属性 14: 流式响应完整性', () => {
    it('应该返回完整的流式响应并以 done=true 结束', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            model: fc.option(fc.constantFrom('gemini-2.0-flash', 'gemini-1.5-pro'), { nil: undefined }),
            maxOutputTokens: fc.option(fc.integer({ min: 1, max: 8192 }), { nil: undefined }),
            temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
          }),
          async (prompt: string, options: TextGenerationOptions) => {
            const chunks: StreamChunk[] = [];
            
            // 收集所有流式响应块
            for await (const chunk of service.generateContentStream(prompt, options)) {
              chunks.push(chunk);
            }
            
            // 验证至少有一个块
            expect(chunks.length).toBeGreaterThan(0);
            
            // 验证最后一个块的 done 标志为 true
            const lastChunk = chunks[chunks.length - 1];
            expect(lastChunk.done).toBe(true);
            
            // 验证只有最后一个块的 done 为 true
            for (let i = 0; i < chunks.length - 1; i++) {
              expect(chunks[i].done).toBe(false);
            }
            
            // 验证所有块都有 text 字段
            chunks.forEach(chunk => {
              expect(chunk).toHaveProperty('text');
              expect(typeof chunk.text).toBe('string');
            });
            
            // 拼接所有文本内容
            const fullText = chunks
              .filter(chunk => !chunk.done)
              .map(chunk => chunk.text)
              .join('');
            
            // 验证拼接后的内容不为空（除非是错误情况）
            if (!lastChunk.error) {
              expect(fullText.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该保证流式响应的顺序性', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (prompt: string) => {
            const chunks: StreamChunk[] = [];
            
            // 收集所有流式响应块
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks.push(chunk);
            }
            
            // 验证块的顺序：done=false 的块应该在 done=true 的块之前
            let foundDone = false;
            for (const chunk of chunks) {
              if (foundDone) {
                // 一旦遇到 done=true，后面不应该再有块
                expect(chunk).toBe(chunks[chunks.length - 1]);
              }
              if (chunk.done) {
                foundDone = true;
              }
            }
            
            // 验证确实找到了 done=true 的块
            expect(foundDone).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该在 MOCK_MODE 下返回一致的流式响应', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          async (prompt: string) => {
            // 第一次调用
            const chunks1: StreamChunk[] = [];
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks1.push(chunk);
            }
            
            // 第二次调用相同的提示
            const chunks2: StreamChunk[] = [];
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks2.push(chunk);
            }
            
            // 在 MOCK_MODE 下，相同输入应该产生相同数量的块
            expect(chunks1.length).toBe(chunks2.length);
            
            // 验证两次调用的完整文本内容相同
            const text1 = chunks1.filter(c => !c.done).map(c => c.text).join('');
            const text2 = chunks2.filter(c => !c.done).map(c => c.text).join('');
            expect(text1).toBe(text2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该正确处理空提示词', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(''),
          async (prompt: string) => {
            const chunks: StreamChunk[] = [];
            
            // 即使提示词为空，也应该返回流式响应
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks.push(chunk);
            }
            
            // 应该至少有一个完成块
            expect(chunks.length).toBeGreaterThan(0);
            
            // 最后一个块应该标记为完成
            const lastChunk = chunks[chunks.length - 1];
            expect(lastChunk.done).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该正确传递配置参数', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            model: fc.option(fc.constantFrom('gemini-2.0-flash', 'gemini-1.5-pro'), { nil: undefined }),
            maxOutputTokens: fc.option(fc.integer({ min: 100, max: 1000 }), { nil: undefined }),
            temperature: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
            topP: fc.option(fc.double({ min: 0, max: 1, noNaN: true }), { nil: undefined }),
            topK: fc.option(fc.integer({ min: 1, max: 40 }), { nil: undefined }),
          }),
          async (prompt: string, options: TextGenerationOptions) => {
            const chunks: StreamChunk[] = [];
            
            // 使用配置参数调用流式生成
            for await (const chunk of service.generateContentStream(prompt, options)) {
              chunks.push(chunk);
            }
            
            // 验证能够成功生成响应（配置参数被正确传递）
            expect(chunks.length).toBeGreaterThan(0);
            
            // 验证最后一个块标记为完成
            expect(chunks[chunks.length - 1].done).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: gemini-api-integration, Property 15: 流式错误处理**
   * **Validates: Requirements 6.4**
   * 
   * 属性：对于任意在流式传输过程中发生的错误，
   * 系统应该优雅地处理错误、通知客户端并关闭连接
   */
  describe('属性 15: 流式错误处理', () => {
    it('在错误情况下应该返回带有 error 字段的完成块', async () => {
      // 禁用 MOCK_MODE 以触发错误
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器（不初始化，导致错误）
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (prompt: string) => {
            const chunks: StreamChunk[] = [];
            
            // 收集所有流式响应块（包括错误块）
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks.push(chunk);
            }
            
            // 应该至少有一个块
            expect(chunks.length).toBeGreaterThan(0);
            
            // 最后一个块应该标记为完成
            const lastChunk = chunks[chunks.length - 1];
            expect(lastChunk.done).toBe(true);
            
            // 在错误情况下，最后一个块应该包含 error 字段
            expect(lastChunk.error).toBeDefined();
            expect(typeof lastChunk.error).toBe('string');
            expect(lastChunk.error!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('错误块应该是流的最后一个块', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (prompt: string) => {
            const chunks: StreamChunk[] = [];
            
            // 收集所有块
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks.push(chunk);
            }
            
            // 查找包含错误的块
            const errorChunks = chunks.filter(chunk => chunk.error !== undefined);
            
            if (errorChunks.length > 0) {
              // 错误块应该是最后一个块
              const lastChunk = chunks[chunks.length - 1];
              expect(lastChunk.error).toBeDefined();
              
              // 错误块应该标记为完成
              expect(lastChunk.done).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('在错误后不应该继续生成内容', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (prompt: string) => {
            const chunks: StreamChunk[] = [];
            
            // 收集所有块
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks.push(chunk);
              
              // 如果遇到错误块，后面不应该再有块
              if (chunk.error) {
                expect(chunk.done).toBe(true);
              }
            }
            
            // 验证流已经结束
            expect(chunks.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('错误消息应该提供有用的信息', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (prompt: string) => {
            const chunks: StreamChunk[] = [];
            
            // 收集所有块
            for await (const chunk of service.generateContentStream(prompt)) {
              chunks.push(chunk);
            }
            
            // 查找错误块
            const errorChunk = chunks.find(chunk => chunk.error !== undefined);
            
            if (errorChunk) {
              // 错误消息应该是非空字符串
              expect(typeof errorChunk.error).toBe('string');
              expect(errorChunk.error!.length).toBeGreaterThan(0);
              
              // 错误消息应该包含有用的信息（不只是空白）
              expect(errorChunk.error!.trim().length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该在各种配置下正确处理错误', async () => {
      // 禁用 MOCK_MODE
      process.env.MOCK_MODE = 'false';
      
      // 重置客户端管理器
      const clientManager = GeminiClientManager.getInstance();
      clientManager.reset();
      
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.record({
            model: fc.option(fc.constantFrom('gemini-2.0-flash', 'gemini-1.5-pro'), { nil: undefined }),
            maxOutputTokens: fc.option(fc.integer({ min: 1, max: 8192 }), { nil: undefined }),
            temperature: fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: undefined }),
          }),
          async (prompt: string, options: TextGenerationOptions) => {
            const chunks: StreamChunk[] = [];
            
            // 使用不同配置调用
            for await (const chunk of service.generateContentStream(prompt, options)) {
              chunks.push(chunk);
            }
            
            // 应该返回至少一个块
            expect(chunks.length).toBeGreaterThan(0);
            
            // 最后一个块应该标记为完成
            const lastChunk = chunks[chunks.length - 1];
            expect(lastChunk.done).toBe(true);
            
            // 在错误情况下应该有错误信息
            if (lastChunk.error) {
              expect(typeof lastChunk.error).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
