import { randomUUID } from 'crypto';
import { getDb } from '../../db/index';
import { encryptionService } from './encryption';

/**
 * API 调用日志接口
 */
export interface CallLog {
  id?: number;
  requestId: string;
  timestamp: string;
  service: string; // 'text' | 'image' | 'file' | 'stream'
  method: string;
  modelName: string;
  apiKeyId?: number;
  requestParams: string; // JSON string
  responseStatus: 'success' | 'error';
  responseTime?: number; // ms
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  responseData?: string | null; // JSON string or text summary
  errorType?: string | null;
  errorMessage?: string | null;
  userId?: string | null;
}

/**
 * 日志记录拦截器
 * 负责拦截并记录所有 Gemini API 调用
 */
export class LoggingInterceptor {
  /**
   * 记录请求开始
   * @param requestData 请求数据
   * @returns requestId 唯一请求标识符
   */
  async logRequest(requestData: Partial<CallLog>): Promise<string> {
    const requestId = randomUUID();
    const timestamp = new Date().toISOString();

    // 脱敏请求参数中的敏感信息
    const sanitizedParams = this.sanitizeParams(requestData.requestParams || '{}');

    const db = await getDb();
    await db.run(
      `INSERT INTO gemini_call_logs (
        request_id, timestamp, service, method, model_name, api_key_id,
        request_params, response_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        timestamp,
        requestData.service || 'unknown',
        requestData.method || 'unknown',
        requestData.modelName || 'unknown',
        requestData.apiKeyId || null,
        sanitizedParams,
        'pending' // 初始状态为 pending
      ]
    );

    return requestId;
  }

  /**
   * 记录响应数据
   * @param requestId 请求标识符
   * @param responseData 响应数据
   */
  async logResponse(requestId: string, responseData: Partial<CallLog>): Promise<void> {
    const db = await getDb();

    // 脱敏响应数据中的敏感信息
    const sanitizedResponseData = responseData.responseData
      ? this.sanitizeParams(responseData.responseData)
      : null;

    await db.run(
      `UPDATE gemini_call_logs SET
        response_status = ?,
        response_time = ?,
        prompt_tokens = ?,
        completion_tokens = ?,
        total_tokens = ?,
        response_data = ?,
        error_type = ?,
        error_message = ?,
        user_id = ?
      WHERE request_id = ?`,
      [
        responseData.responseStatus || 'error',
        responseData.responseTime || null,
        responseData.tokenUsage?.promptTokens || null,
        responseData.tokenUsage?.completionTokens || null,
        responseData.tokenUsage?.totalTokens || null,
        sanitizedResponseData,
        responseData.errorType || null,
        responseData.errorMessage || null,
        responseData.userId || null,
        requestId
      ]
    );
  }

  /**
   * 脱敏敏感信息并生成摘要
   * @param data JSON 字符串或普通字符串
   * @returns 脱敏后的字符串
   */
  private sanitizeParams(data: string): string {
    try {
      const parsed = JSON.parse(data);
      const sanitized = this.sanitizeObject(parsed);
      
      // 检查是否需要生成摘要
      const sanitizedStr = JSON.stringify(sanitized);
      if (sanitizedStr.length > 1000) {
        const summary = {
          _summary: true,
          type: typeof sanitized,
          length: sanitizedStr.length,
          preview: sanitizedStr.substring(0, 200) + '...',
        };
        return JSON.stringify(summary);
      }
      
      return sanitizedStr;
    } catch {
      // 如果不是 JSON，直接返回（可能是纯文本）
      return data;
    }
  }

  /**
   * 递归脱敏对象中的敏感字段
   * @param obj 对象
   * @returns 脱敏后的对象
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // 脱敏 API Key 相关字段
        if (key.toLowerCase().includes('apikey') || key.toLowerCase().includes('api_key')) {
          sanitized[key] = typeof value === 'string' ? encryptionService.maskKey(value) : value;
        } else if (value !== null && typeof value === 'object') {
          // 递归处理嵌套对象和数组
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * 使用装饰器模式包装服务
   * @param service 原始服务对象
   * @param serviceName 服务名称（用于日志记录）
   * @returns 包装后的服务对象
   */
  wrapService<T extends object>(service: T, serviceName: string): T {
    const self = this;

    return new Proxy(service, {
      get(target: any, prop: string | symbol) {
        const originalMethod = target[prop];

        // 只包装函数方法
        if (typeof originalMethod !== 'function') {
          return originalMethod;
        }

        // 跳过构造函数和私有方法
        if (prop === 'constructor' || prop.toString().startsWith('_')) {
          return originalMethod;
        }

        // 返回包装后的方法
        return async function (this: any, ...args: any[]) {
          const startTime = Date.now();
          let requestId: string | null = null;

          try {
            // 提取模型名称（如果存在）
            const modelName = self.extractModelName(args);

            // 记录请求开始
            requestId = await self.logRequest({
              service: serviceName,
              method: prop.toString(),
              modelName: modelName || 'unknown',
              requestParams: JSON.stringify(args),
            });

            // 执行原始方法
            const result = await originalMethod.apply(this, args);
            const endTime = Date.now();

            // 记录成功响应
            if (requestId) {
              await self.logResponse(requestId, {
                responseStatus: 'success',
                responseTime: endTime - startTime,
                tokenUsage: self.extractTokenUsage(result) || null,
                responseData: JSON.stringify(self.summarizeResponse(result)),
              });
            }

            return result;
          } catch (error: any) {
            const endTime = Date.now();

            // 记录错误响应
            if (requestId) {
              await self.logResponse(requestId, {
                responseStatus: 'error',
                responseTime: endTime - startTime,
                errorType: error.constructor.name,
                errorMessage: error.message,
              });
            }

            // 重新抛出错误
            throw error;
          }
        };
      },
    });
  }

  /**
   * 从参数中提取模型名称
   * @param args 方法参数
   * @returns 模型名称或 null
   */
  private extractModelName(args: any[]): string | null {
    // 尝试从第一个参数中提取 model 字段
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      if ('model' in args[0]) {
        return args[0].model;
      }
      if ('modelName' in args[0]) {
        return args[0].modelName;
      }
    }
    return null;
  }

  /**
   * 从响应中提取 token 使用量
   * @param result 响应结果
   * @returns token 使用量或 null
   */
  private extractTokenUsage(result: any): CallLog['tokenUsage'] {
    if (!result || typeof result !== 'object') {
      return null;
    }

    // 尝试从不同的字段中提取 token 信息
    const usage = result.usageMetadata || result.usage || result.tokenUsage;
    if (usage) {
      return {
        promptTokens: usage.promptTokenCount || usage.promptTokens || 0,
        completionTokens: usage.candidatesTokenCount || usage.completionTokens || 0,
        totalTokens: usage.totalTokenCount || usage.totalTokens || 0,
      };
    }

    return null;
  }

  /**
   * 生成响应摘要（避免存储过大的响应数据）
   * @param result 响应结果
   * @returns 响应摘要
   */
  private summarizeResponse(result: any): any {
    if (!result) {
      return null;
    }

    // 如果响应很小，直接返回
    const resultStr = JSON.stringify(result);
    if (resultStr.length <= 1000) {
      return result;
    }

    // 生成摘要
    return {
      _summary: true,
      type: typeof result,
      length: resultStr.length,
      preview: resultStr.substring(0, 200) + '...',
    };
  }
}

/**
 * 获取日志拦截器单例
 */
let interceptorInstance: LoggingInterceptor | null = null;

export function getLoggingInterceptor(): LoggingInterceptor {
  if (!interceptorInstance) {
    interceptorInstance = new LoggingInterceptor();
  }
  return interceptorInstance;
}
