/**
 * ErrorHandler 属性测试
 * 使用 fast-check 进行基于属性的测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ErrorHandler, GeminiError, RetryOptions } from './error-handler';

describe('ErrorHandler 属性测试', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * **Feature: gemini-api-integration, Property 16: 限流重试策略**
   * **Validates: Requirements 7.1**
   * 
   * 属性：对于任意返回 429 错误的 API 调用，系统应该实施指数退避重试，且重试间隔应该递增
   */
  describe('属性 16: 限流重试策略', () => {
    it('应该对 429 错误实施指数退避重试，且延迟递增', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成重试配置参数
          fc.record({
            initialDelay: fc.integer({ min: 100, max: 1000 }),
            backoffMultiplier: fc.integer({ min: 2, max: 3 }),
            maxRetries: fc.integer({ min: 1, max: 3 }),
            maxDelay: fc.integer({ min: 10000, max: 32000 }),
          }),
          async (options) => {
            const delays: number[] = [];
            let attemptCount = 0;

            // 创建一个总是返回 429 错误的函数
            const failingFn = vi.fn(async () => {
              attemptCount++;
              const error: any = new Error('Rate limit exceeded');
              error.status = 429;
              throw error;
            });

            // 监听 setTimeout 调用以记录延迟时间并立即执行回调
            // 只记录重试延迟（排除超时定时器）
            vi.spyOn(global, 'setTimeout').mockImplementation(((callback: any, delay: number) => {
              // 超时定时器的延迟通常是30000ms，重试延迟通常小于这个值
              if (delay > 0 && delay < 30000) {
                delays.push(delay);
              }
              // 立即执行回调，避免真实等待
              if (typeof callback === 'function') {
                callback();
              }
              return 0 as any;
            }) as any);

            try {
              await ErrorHandler.withRetry(failingFn, options, {
                service: 'test',
                method: 'rateLimitTest',
              });
            } catch (error) {
              // 预期会失败
            }

            // 验证：应该尝试了 maxRetries + 1 次（初始尝试 + 重试次数）
            expect(attemptCount).toBe(options.maxRetries + 1);

            // 验证：延迟数组长度应该等于重试次数
            expect(delays.length).toBe(options.maxRetries);

            // 验证：延迟时间应该递增（指数退避）
            for (let i = 1; i < delays.length; i++) {
              expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
            }

            // 验证：第一次延迟应该等于 initialDelay
            if (delays.length > 0) {
              expect(delays[0]).toBe(options.initialDelay);
            }

            // 验证：每次延迟应该符合指数退避公式（考虑 maxDelay 限制）
            for (let i = 0; i < delays.length; i++) {
              const expectedDelay = Math.min(
                options.initialDelay * Math.pow(options.backoffMultiplier, i),
                options.maxDelay
              );
              expect(delays[i]).toBe(expectedDelay);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该识别 429 错误为可重试错误', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant({ status: 429 }),
            fc.constant({ statusCode: 429 }),
            fc.constant({ code: '429' })
          ),
          (error) => {
            const result = ErrorHandler.isRetryableError(error);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

  /**
   * **Feature: gemini-api-integration, Property 17: 重试次数限制**
   * **Validates: Requirements 7.2, 7.3**
   * 
   * 属性：对于任意返回 5xx 错误的 API 调用，系统应该最多重试 3 次，且在所有重试失败后返回降级响应
   */
  describe('属性 17: 重试次数限制', () => {
    it('应该对 5xx 错误最多重试指定次数', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            maxRetries: fc.integer({ min: 1, max: 5 }),
            statusCode: fc.integer({ min: 500, max: 599 }),
          }),
          async ({ maxRetries, statusCode }) => {
            let attemptCount = 0;

            const failingFn = vi.fn(async () => {
              attemptCount++;
              const error: any = new Error('Server error');
              error.status = statusCode;
              throw error;
            });

            // Mock setTimeout 立即执行
            vi.spyOn(global, 'setTimeout').mockImplementation(((callback: any) => {
              if (typeof callback === 'function') {
                callback();
              }
              return 0 as any;
            }) as any);

            try {
              await ErrorHandler.withRetry(
                failingFn,
                { maxRetries },
                { service: 'test', method: 'serverErrorTest' }
              );
            } catch (error) {
              // 预期会失败
            }

            // 验证：应该尝试了 maxRetries + 1 次
            expect(attemptCount).toBe(maxRetries + 1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应该识别 5xx 错误为可重试错误', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 500, max: 599 }),
          (statusCode) => {
            const error = { status: statusCode };
            const result = ErrorHandler.isRetryableError(error);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('所有重试失败后应该抛出错误', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (maxRetries) => {
            const failingFn = vi.fn(async () => {
              const error: any = new Error('Server error');
              error.status = 500;
              throw error;
            });

            vi.spyOn(global, 'setTimeout').mockImplementation(((callback: any) => {
              if (typeof callback === 'function') {
                callback();
              }
              return 0 as any;
            }) as any);

            let thrownError: any = null;
            try {
              await ErrorHandler.withRetry(
                failingFn,
                { maxRetries },
                { service: 'test', method: 'errorTest' }
              );
            } catch (error) {
              thrownError = error;
            }

            // 验证：应该抛出错误
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(GeminiError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: gemini-api-integration, Property 18: 超时处理**
   * **Validates: Requirements 7.4**
   * 
   * 属性：对于任意超过 30 秒未响应的 API 调用，系统应该取消请求并返回超时错误
   */
  describe('属性 18: 超时处理', () => {
    it('应该在超时后取消请求', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            timeout: fc.integer({ min: 100, max: 1000 }),
            delay: fc.integer({ min: 1100, max: 2000 }),
          }),
          async ({ timeout, delay }) => {
            const slowFn = vi.fn(async () => {
              // 模拟一个慢函数，延迟时间大于超时时间
              await new Promise(resolve => setTimeout(resolve, delay));
              return 'success';
            });

            let thrownError: any = null;
            try {
              await ErrorHandler.withRetry(
                slowFn,
                { timeout, maxRetries: 0 },
                { service: 'test', method: 'timeoutTest' }
              );
            } catch (error) {
              thrownError = error;
            }

            // 验证：应该抛出超时错误
            expect(thrownError).not.toBeNull();
            expect(thrownError).toBeInstanceOf(GeminiError);
            expect(thrownError.code).toBe('TIMEOUT');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('应该识别超时错误为可重试错误', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { code: 'ETIMEDOUT' },
            { code: 'ESOCKETTIMEDOUT' },
            { code: 'ECONNRESET' },
            { message: 'timeout occurred' },
            { message: 'TIMEOUT' }
          ),
          (error) => {
            const result = ErrorHandler.isRetryableError(error);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: gemini-api-integration, Property 19: 错误日志完整性**
   * **Validates: Requirements 7.5**
   * 
   * 属性：对于任意发生的错误，日志应该包含请求参数、错误类型、堆栈跟踪等完整的调试信息
   */
  describe('属性 19: 错误日志完整性', () => {
    it('错误日志应该包含所有必要信息', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            service: fc.string({ minLength: 1, maxLength: 20 }),
            method: fc.string({ minLength: 1, maxLength: 20 }),
            errorMessage: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async ({ service, method, errorMessage }) => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const failingFn = vi.fn(async () => {
              const error = new Error(errorMessage);
              throw error;
            });

            vi.spyOn(global, 'setTimeout').mockImplementation(((callback: any) => {
              if (typeof callback === 'function') {
                callback();
              }
              return 0 as any;
            }) as any);

            try {
              await ErrorHandler.withRetry(
                failingFn,
                { maxRetries: 0 },
                { service, method, params: { test: 'data' } }
              );
            } catch (error) {
              // 预期会失败
            }

            // 验证：console.error 应该被调用
            expect(consoleErrorSpy).toHaveBeenCalled();

            // 验证：日志应该包含必要信息
            const logCalls = consoleErrorSpy.mock.calls;
            expect(logCalls.length).toBeGreaterThan(0);

            // 找到包含JSON格式日志的调用（第一个参数是'[Gemini ErrorHandler]'且第二个参数是JSON字符串）
            const jsonLogCall = logCalls.find(call => 
              call[0] === '[Gemini ErrorHandler]' && 
              typeof call[1] === 'string' &&
              call[1].startsWith('{')
            );

            expect(jsonLogCall).toBeDefined();

            // 解析日志内容
            const logContent = JSON.parse(jsonLogCall![1]);

            // 验证：日志包含所有必要字段
            expect(logContent).toHaveProperty('timestamp');
            expect(logContent).toHaveProperty('service');
            expect(logContent).toHaveProperty('method');
            expect(logContent).toHaveProperty('requestParams');
            expect(logContent).toHaveProperty('errorType');
            expect(logContent).toHaveProperty('errorMessage');
            expect(logContent).toHaveProperty('retryCount');

            // 验证：字段值正确
            expect(logContent.service).toBe(service);
            expect(logContent.method).toBe(method);
            expect(logContent.errorMessage).toBe(errorMessage);

            consoleErrorSpy.mockRestore();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

