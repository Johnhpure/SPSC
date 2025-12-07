/**
 * Gemini API 错误处理和重试模块
 * 
 * 提供统一的错误处理、重试逻辑和降级策略
 */

/**
 * 重试配置选项
 */
export interface RetryOptions {
  /** 最大重试次数，默认3次 */
  maxRetries?: number;
  /** 初始延迟时间（毫秒），默认1000ms */
  initialDelay?: number;
  /** 最大延迟时间（毫秒），默认32000ms */
  maxDelay?: number;
  /** 退避倍数，默认2 */
  backoffMultiplier?: number;
  /** 请求超时时间（毫秒），默认30000ms */
  timeout?: number;
}

/**
 * 错误日志接口
 */
export interface ErrorLog {
  timestamp: string;
  service: string;
  method: string;
  requestParams: any;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  retryCount: number;
}

/**
 * 标准化错误类
 */
export class GeminiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public retryable: boolean = false,
    public originalError?: any
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private static readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 32000,
    backoffMultiplier: 2,
    timeout: 30000,
  };

  /**
   * 判断错误是否可重试
   */
  static isRetryableError(error: any): boolean {
    // 检查是否是 GeminiError 且标记为可重试
    if (error instanceof GeminiError) {
      return error.retryable;
    }

    // 检查 HTTP 状态码
    const status = error.status || error.statusCode || error.code;
    
    // 429 限流错误 - 可重试
    if (status === 429 || status === '429') {
      return true;
    }

    // 5xx 服务器错误 - 可重试
    if (typeof status === 'number' && status >= 500 && status < 600) {
      return true;
    }

    // 网络超时错误 - 可重试
    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ESOCKETTIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('timeout') ||
      error.message?.includes('TIMEOUT')
    ) {
      return true;
    }

    // 其他错误不可重试
    return false;
  }

  /**
   * 计算指数退避延迟时间
   */
  private static calculateDelay(
    retryCount: number,
    options: Required<RetryOptions>
  ): number {
    const delay = options.initialDelay * Math.pow(options.backoffMultiplier, retryCount);
    return Math.min(delay, options.maxDelay);
  }

  /**
   * 等待指定时间
   */
  private static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 记录错误日志
   */
  private static logError(
    service: string,
    method: string,
    error: any,
    requestParams: any,
    retryCount: number
  ): void {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      service,
      method,
      requestParams,
      errorType: error.name || 'UnknownError',
      errorMessage: error.message || String(error),
      stackTrace: error.stack,
      retryCount,
    };

    console.error('[Gemini ErrorHandler]', JSON.stringify(errorLog, null, 2));
  }

  /**
   * 使用超时包装函数
   */
  private static withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new GeminiError(
            `请求超时（${timeoutMs}ms）`,
            'TIMEOUT',
            undefined,
            true // 超时错误可重试
          ));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * 包装函数并添加重试逻辑
   * 
   * @param fn 要执行的异步函数
   * @param options 重试配置选项
   * @param context 上下文信息（用于日志）
   * @returns 函数执行结果
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {},
    context: { service: string; method: string; params?: any } = {
      service: 'unknown',
      method: 'unknown',
    }
  ): Promise<T> {
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: any;
    let retryCount = 0;

    while (retryCount <= mergedOptions.maxRetries) {
      try {
        // 使用超时包装
        const result = await this.withTimeout(fn(), mergedOptions.timeout);
        
        // 如果成功且之前有重试，记录恢复日志
        if (retryCount > 0) {
          console.log(
            `[Gemini ErrorHandler] ${context.service}.${context.method} 在第 ${retryCount} 次重试后成功`
          );
        }
        
        return result;
      } catch (error) {
        lastError = error;

        // 记录错误日志
        this.logError(
          context.service,
          context.method,
          error,
          context.params,
          retryCount
        );

        // 检查是否可重试
        if (!this.isRetryableError(error)) {
          console.error(
            `[Gemini ErrorHandler] ${context.service}.${context.method} 遇到不可重试错误，停止重试`
          );
          throw this.handleError(error);
        }

        // 检查是否还有重试次数
        if (retryCount >= mergedOptions.maxRetries) {
          console.error(
            `[Gemini ErrorHandler] ${context.service}.${context.method} 已达到最大重试次数 (${mergedOptions.maxRetries})，停止重试`
          );
          throw this.handleError(error);
        }

        // 计算延迟时间并等待
        const delay = this.calculateDelay(retryCount, mergedOptions);
        console.log(
          `[Gemini ErrorHandler] ${context.service}.${context.method} 将在 ${delay}ms 后进行第 ${retryCount + 1} 次重试`
        );
        await this.sleep(delay);

        retryCount++;
      }
    }

    // 理论上不会到达这里，但为了类型安全
    throw this.handleError(lastError);
  }

  /**
   * 统一错误处理
   * 将各种错误转换为标准化的 GeminiError
   */
  static handleError(error: any): GeminiError {
    // 如果已经是 GeminiError，直接返回
    if (error instanceof GeminiError) {
      return error;
    }

    // 提取错误信息
    const message = error.message || String(error);
    const status = error.status || error.statusCode;
    const code = error.code || 'UNKNOWN_ERROR';

    // 判断是否可重试
    const retryable = this.isRetryableError(error);

    // 创建标准化错误
    return new GeminiError(message, code, status, retryable, error);
  }
}
