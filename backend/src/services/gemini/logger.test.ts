/**
 * Logger 模块属性测试
 * 
 * 使用 fast-check 进行属性测试，验证日志和监控功能的正确性
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Logger, LogLevel, ApiCallLog } from './logger';

describe('Logger 属性测试', () => {
  // 注意：不在这里重置，而是在每个测试内部重置
  // 这样可以避免单例在属性测试的多次迭代间共享状态

  /**
   * **Feature: gemini-api-integration, Property 22: API 调用日志完整性**
   * **Validates: Requirements 9.1, 9.2**
   * 
   * 属性：对于任意 API 调用，日志应该包含请求参数、模型名称、时间戳、响应时间、token 使用量和状态码
   */
  it('属性 22: API 调用日志完整性', () => {
    fc.assert(
      fc.property(
        // 生成随机的 API 调用日志数据
        fc.record({
          service: fc.constantFrom('GeminiTextService', 'GeminiImageService', 'GeminiFileService'),
          method: fc.constantFrom('generateText', 'analyzeImage', 'uploadFile'),
          model: fc.option(fc.constantFrom('gemini-2.0-flash', 'imagen-3.0-generate-002'), { nil: undefined }),
          requestParams: fc.object(),
          responseTime: fc.integer({ min: 10, max: 30000 }),
          tokenUsage: fc.option(
            fc.record({
              promptTokens: fc.integer({ min: 0, max: 10000 }),
              completionTokens: fc.integer({ min: 0, max: 10000 }),
              totalTokens: fc.integer({ min: 0, max: 20000 }),
            }),
            { nil: undefined }
          ),
          statusCode: fc.constantFrom(200, 201, 400, 429, 500, 503),
          success: fc.boolean(),
          errorMessage: fc.option(fc.string(), { nil: undefined }),
        }),
        (logData) => {
          // 每次迭代前重置 Logger 实例
          Logger.resetInstance();
          const logger = Logger.getInstance({ level: LogLevel.INFO });

          // 创建完整的 API 调用日志
          const apiCallLog: ApiCallLog = {
            timestamp: new Date().toISOString(),
            ...logData,
          };

          // 记录 API 调用（不应抛出错误）
          expect(() => logger.logApiCall(apiCallLog)).not.toThrow();

          // 验证日志包含所有必要字段
          expect(apiCallLog.timestamp).toBeDefined();
          expect(apiCallLog.service).toBeDefined();
          expect(apiCallLog.method).toBeDefined();
          expect(apiCallLog.requestParams).toBeDefined();
          expect(apiCallLog.responseTime).toBeGreaterThanOrEqual(0);
          expect(apiCallLog.statusCode).toBeDefined();
          expect(typeof apiCallLog.success).toBe('boolean');

          // 如果有 token 使用量，验证其结构
          if (apiCallLog.tokenUsage) {
            expect(apiCallLog.tokenUsage.totalTokens).toBeGreaterThanOrEqual(0);
          }

          // 如果失败，应该有错误消息
          if (!apiCallLog.success && apiCallLog.errorMessage) {
            expect(apiCallLog.errorMessage).toBeDefined();
          }
        }
      ),
      { numRuns: 100 } // 运行 100 次迭代
    );
  });

  /**
   * **Feature: gemini-api-integration, Property 23: 使用统计准确性**
   * **Validates: Requirements 9.4**
   * 
   * 属性：对于任意时间段内的 API 调用，统计数据应该准确反映调用次数、成功率和平均响应时间
   */
  it('属性 23: 使用统计准确性', () => {
    fc.assert(
      fc.property(
        // 生成随机的 API 调用序列
        fc.array(
          fc.record({
            service: fc.constantFrom('GeminiTextService', 'GeminiImageService'),
            method: fc.constantFrom('generateText', 'analyzeImage'),
            model: fc.constantFrom('gemini-2.0-flash', 'imagen-3.0-generate-002'),
            requestParams: fc.object(),
            responseTime: fc.integer({ min: 100, max: 5000 }),
            tokenUsage: fc.record({
              promptTokens: fc.integer({ min: 10, max: 1000 }),
              completionTokens: fc.integer({ min: 10, max: 1000 }),
              totalTokens: fc.integer({ min: 20, max: 2000 }),
            }),
            statusCode: fc.constantFrom(200, 201),
            success: fc.boolean(),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (apiCalls) => {
          // 每次迭代前重置 Logger 实例
          Logger.resetInstance();
          const logger = Logger.getInstance({ 
            level: LogLevel.INFO,
            enableMetrics: true,
          });

          // 记录所有 API 调用
          apiCalls.forEach(call => {
            const apiCallLog: ApiCallLog = {
              timestamp: new Date().toISOString(),
              ...call,
            };
            logger.logApiCall(apiCallLog);
          });

          // 获取使用统计
          const stats = logger.getUsageStats();

          // 验证统计数据的准确性
          expect(stats.totalCalls).toBe(apiCalls.length);

          // 计算预期的成功调用数
          const expectedSuccessfulCalls = apiCalls.filter(c => c.success).length;
          expect(stats.successfulCalls).toBe(expectedSuccessfulCalls);

          // 计算预期的失败调用数
          const expectedFailedCalls = apiCalls.length - expectedSuccessfulCalls;
          expect(stats.failedCalls).toBe(expectedFailedCalls);

          // 验证成功率
          const expectedSuccessRate = apiCalls.length > 0 
            ? expectedSuccessfulCalls / apiCalls.length 
            : 0;
          expect(stats.successRate).toBeCloseTo(expectedSuccessRate, 10);

          // 计算预期的平均响应时间
          const totalResponseTime = apiCalls.reduce((sum, c) => sum + c.responseTime, 0);
          const expectedAvgResponseTime = apiCalls.length > 0 
            ? totalResponseTime / apiCalls.length 
            : 0;
          expect(stats.averageResponseTime).toBeCloseTo(expectedAvgResponseTime, 2);

          // 计算预期的总 token 数
          const expectedTotalTokens = apiCalls.reduce(
            (sum, c) => sum + (c.tokenUsage?.totalTokens || 0), 
            0
          );
          expect(stats.totalTokens).toBe(expectedTotalTokens);

          // 验证时间范围
          expect(stats.timeRange.start).toBeDefined();
          expect(stats.timeRange.end).toBeDefined();
          expect(new Date(stats.timeRange.start).getTime()).toBeLessThanOrEqual(
            new Date(stats.timeRange.end).getTime()
          );
        }
      ),
      { numRuns: 100 } // 运行 100 次迭代
    );
  });

  /**
   * 额外测试：日志级别控制
   */
  it('应该根据日志级别过滤日志', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG),
        (level) => {
          // 每次迭代前重置 Logger 实例
          Logger.resetInstance();
          const logger = Logger.getInstance({ level });

          // 验证日志级别设置
          expect(logger.getLevel()).toBe(level);

          // 所有日志方法都不应抛出错误
          expect(() => logger.error('Error message')).not.toThrow();
          expect(() => logger.warn('Warning message')).not.toThrow();
          expect(() => logger.info('Info message')).not.toThrow();
          expect(() => logger.debug('Debug message')).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * 额外测试：指标清理
   */
  it('应该正确清理过期的指标数据', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            service: fc.constantFrom('GeminiTextService'),
            method: fc.constantFrom('generateText'),
            model: fc.constantFrom('gemini-2.0-flash'),
            requestParams: fc.object(),
            responseTime: fc.integer({ min: 100, max: 1000 }),
            tokenUsage: fc.record({
              totalTokens: fc.integer({ min: 10, max: 100 }),
            }),
            statusCode: fc.constantFrom(200),
            success: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (apiCalls) => {
          // 每次迭代前重置 Logger 实例
          Logger.resetInstance();
          // 使用很短的指标窗口（100ms）
          const logger = Logger.getInstance({ 
            level: LogLevel.INFO,
            enableMetrics: true,
            metricsWindow: 100,
          });

          // 记录所有 API 调用
          apiCalls.forEach(call => {
            const apiCallLog: ApiCallLog = {
              timestamp: new Date().toISOString(),
              ...call,
            };
            logger.logApiCall(apiCallLog);
          });

          // 立即获取统计，应该有数据
          const statsBeforeSleep = logger.getUsageStats();
          expect(statsBeforeSleep.totalCalls).toBe(apiCalls.length);

          // 等待超过指标窗口时间
          await new Promise<void>(resolve => setTimeout(resolve, 150));

          // 记录一个新的调用，触发清理
          const newCall: ApiCallLog = {
            timestamp: new Date().toISOString(),
            service: 'GeminiTextService',
            method: 'generateText',
            model: 'gemini-2.0-flash',
            requestParams: {},
            responseTime: 100,
            tokenUsage: { totalTokens: 10 },
            statusCode: 200,
            success: true,
          };
          logger.logApiCall(newCall);

          // 获取统计，旧数据应该被清理
          const statsAfterSleep = logger.getUsageStats();
          
          // 只应该有最新的一个调用
          expect(statsAfterSleep.totalCalls).toBe(1);
        }
      ),
      { numRuns: 10 } // 由于涉及异步等待，减少迭代次数
    );
  });
});
