/**
 * LoggingInterceptor 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LoggingInterceptor } from './logging-interceptor';
import { getDb } from '../../db/index';

describe('LoggingInterceptor 单元测试', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    interceptor = new LoggingInterceptor();
    
    // 清理测试数据
    const db = await getDb();
    await db.run('DELETE FROM gemini_call_logs');
  });

  afterEach(async () => {
    // 清理测试数据
    const db = await getDb();
    await db.run('DELETE FROM gemini_call_logs');
  });

  describe('logRequest', () => {
    it('应该成功记录请求并返回 requestId', async () => {
      const requestData = {
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: JSON.stringify({ prompt: 'test prompt' }),
      };

      const requestId = await interceptor.logRequest(requestData);

      expect(requestId).toBeDefined();
      expect(typeof requestId).toBe('string');
      expect(requestId.length).toBeGreaterThan(0);

      // 验证数据库中的记录
      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      expect(log).toBeDefined();
      expect(log.service).toBe('text');
      expect(log.method).toBe('generateText');
      expect(log.model_name).toBe('gemini-2.0-flash');
      expect(log.response_status).toBe('pending');
    });

    it('应该脱敏请求参数中的 API Key', async () => {
      const requestData = {
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: JSON.stringify({ 
          prompt: 'test', 
          apiKey: 'AIzaSyDemoKey1234567890' 
        }),
      };

      const requestId = await interceptor.logRequest(requestData);

      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      const params = JSON.parse(log.request_params);
      expect(params.apiKey).not.toBe('AIzaSyDemoKey1234567890');
      expect(params.apiKey).toContain('AIza');
      expect(params.apiKey).toContain('...');
    });
  });

  describe('logResponse', () => {
    it('应该成功更新响应数据', async () => {
      // 先创建一个请求日志
      const requestId = await interceptor.logRequest({
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: '{}',
      });

      // 更新响应数据
      await interceptor.logResponse(requestId, {
        responseStatus: 'success',
        responseTime: 1500,
        tokenUsage: {
          promptTokens: 10,
          completionTokens: 50,
          totalTokens: 60,
        },
        responseData: JSON.stringify({ text: 'Generated text' }),
      });

      // 验证更新
      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      expect(log.response_status).toBe('success');
      expect(log.response_time).toBe(1500);
      expect(log.prompt_tokens).toBe(10);
      expect(log.completion_tokens).toBe(50);
      expect(log.total_tokens).toBe(60);
    });

    it('应该记录错误信息', async () => {
      const requestId = await interceptor.logRequest({
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: '{}',
      });

      await interceptor.logResponse(requestId, {
        responseStatus: 'error',
        responseTime: 500,
        errorType: 'ApiError',
        errorMessage: 'API rate limit exceeded',
      });

      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      expect(log.response_status).toBe('error');
      expect(log.error_type).toBe('ApiError');
      expect(log.error_message).toBe('API rate limit exceeded');
    });
  });

  describe('wrapService', () => {
    it('应该包装服务方法并记录日志', async () => {
      // 创建一个模拟服务
      const mockService = {
        async testMethod(param: string) {
          return { result: `processed ${param}` };
        },
      };

      const wrappedService = interceptor.wrapService(mockService, 'test');

      // 调用包装后的方法
      const result = await wrappedService.testMethod('input');

      expect(result).toEqual({ result: 'processed input' });

      // 验证日志记录
      const db = await getDb();
      const logs = await db.all('SELECT * FROM gemini_call_logs');
      expect(logs.length).toBe(1);
      expect(logs[0].service).toBe('test');
      expect(logs[0].method).toBe('testMethod');
      expect(logs[0].response_status).toBe('success');
    });

    it('应该捕获并记录方法执行错误', async () => {
      const mockService = {
        async failingMethod() {
          throw new Error('Method failed');
        },
      };

      const wrappedService = interceptor.wrapService(mockService, 'test');

      // 调用应该抛出错误
      await expect(wrappedService.failingMethod()).rejects.toThrow('Method failed');

      // 验证错误日志
      const db = await getDb();
      const logs = await db.all('SELECT * FROM gemini_call_logs');
      expect(logs.length).toBe(1);
      expect(logs[0].response_status).toBe('error');
      expect(logs[0].error_type).toBe('Error');
      expect(logs[0].error_message).toBe('Method failed');
    });

    it('应该不包装非函数属性', async () => {
      const mockService = {
        property: 'value',
        async method() {
          return 'result';
        },
      };

      const wrappedService = interceptor.wrapService(mockService, 'test');

      expect(wrappedService.property).toBe('value');
      expect(typeof wrappedService.method).toBe('function');
    });

    it('应该记录响应时间', async () => {
      const mockService = {
        async slowMethod() {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'done';
        },
      };

      const wrappedService = interceptor.wrapService(mockService, 'test');
      await wrappedService.slowMethod();

      const db = await getDb();
      const logs = await db.all('SELECT * FROM gemini_call_logs');
      expect(logs[0].response_time).toBeGreaterThanOrEqual(100);
    });
  });

  describe('敏感信息脱敏', () => {
    it('应该脱敏嵌套对象中的 API Key', async () => {
      const requestData = {
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: JSON.stringify({
          config: {
            apiKey: 'AIzaSyDemoKey1234567890',
            api_key: 'AIzaSyAnotherKey0987654321',
          },
        }),
      };

      const requestId = await interceptor.logRequest(requestData);

      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      const params = JSON.parse(log.request_params);
      expect(params.config.apiKey).not.toBe('AIzaSyDemoKey1234567890');
      expect(params.config.api_key).not.toBe('AIzaSyAnotherKey0987654321');
    });

    it('应该处理数组中的敏感信息', async () => {
      const requestData = {
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: JSON.stringify({
          keys: [
            { apiKey: 'AIzaSyKey1' },
            { apiKey: 'AIzaSyKey2' },
          ],
        }),
      };

      const requestId = await interceptor.logRequest(requestData);

      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      const params = JSON.parse(log.request_params);
      expect(params.keys[0].apiKey).not.toBe('AIzaSyKey1');
      expect(params.keys[1].apiKey).not.toBe('AIzaSyKey2');
    });
  });

  describe('响应摘要', () => {
    it('应该为小响应保留完整数据', async () => {
      const requestId = await interceptor.logRequest({
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: '{}',
      });

      const smallResponse = { text: 'Short response' };
      await interceptor.logResponse(requestId, {
        responseStatus: 'success',
        responseTime: 100,
        responseData: JSON.stringify(smallResponse),
      });

      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      const responseData = JSON.parse(log.response_data);
      expect(responseData).toEqual(smallResponse);
    });

    it('应该为大响应生成摘要', async () => {
      const requestId = await interceptor.logRequest({
        service: 'text',
        method: 'generateText',
        modelName: 'gemini-2.0-flash',
        requestParams: '{}',
      });

      const largeResponse = { text: 'x'.repeat(2000) };
      await interceptor.logResponse(requestId, {
        responseStatus: 'success',
        responseTime: 100,
        responseData: JSON.stringify(largeResponse),
      });

      const db = await getDb();
      const log = await db.get(
        'SELECT * FROM gemini_call_logs WHERE request_id = ?',
        [requestId]
      );

      const responseData = JSON.parse(log.response_data);
      expect(responseData._summary).toBe(true);
      expect(responseData.length).toBeGreaterThan(1000);
      expect(responseData.preview).toBeDefined();
    });
  });
});
