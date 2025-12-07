/**
 * Gemini API 日志和监控模块
 * 
 * 提供结构化日志记录和指标收集功能
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

/**
 * API 调用日志接口
 */
export interface ApiCallLog {
  timestamp: string;
  service: string;
  method: string;
  model?: string;
  requestParams: any;
  responseTime: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  statusCode: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * 使用统计接口
 */
export interface UsageStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  averageResponseTime: number;
  totalTokens: number;
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * 扩展的使用统计接口（包含百分位数和分类统计）
 */
export interface ExtendedUsageStats extends UsageStats {
  /** 响应时间百分位数 */
  responseTimePercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
  /** 按服务分类的调用统计 */
  callsByService: Record<string, ServiceStats>;
  /** 按方法分类的调用统计 */
  callsByMethod: Record<string, MethodStats>;
  /** 错误统计 */
  errorStats: {
    totalErrors: number;
    errorRate: number;
    errorsByType: Record<string, number>;
  };
}

/**
 * 服务级别统计
 */
export interface ServiceStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
}

/**
 * 方法级别统计
 */
export interface MethodStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageResponseTime: number;
}

/**
 * 告警配置
 */
export interface AlertConfig {
  /** 错误率阈值（0-1），默认 0.05 (5%) */
  errorRateThreshold?: number;
  /** 平均响应时间阈值（毫秒），默认 10000 (10秒) */
  avgResponseTimeThreshold?: number;
  /** Token使用量阈值（占配额百分比），默认 0.8 (80%) */
  tokenUsageThreshold?: number;
  /** Token配额限制 */
  tokenQuota?: number;
  /** 告警回调函数 */
  onAlert?: (alert: Alert) => void;
}

/**
 * 告警类型
 */
export enum AlertType {
  HIGH_ERROR_RATE = 'HIGH_ERROR_RATE',
  HIGH_RESPONSE_TIME = 'HIGH_RESPONSE_TIME',
  HIGH_TOKEN_USAGE = 'HIGH_TOKEN_USAGE',
}

/**
 * 告警信息
 */
export interface Alert {
  type: AlertType;
  message: string;
  timestamp: string;
  currentValue: number;
  threshold: number;
  details?: any;
}

/**
 * 日志配置选项
 */
export interface LoggerOptions {
  /** 日志级别，默认 INFO */
  level?: LogLevel;
  /** 是否启用指标收集，默认 true */
  enableMetrics?: boolean;
  /** 指标统计时间窗口（毫秒），默认 3600000 (1小时) */
  metricsWindow?: number;
  /** 是否启用扩展指标（百分位数、分类统计等），默认 false */
  enableExtendedMetrics?: boolean;
  /** 告警配置 */
  alertConfig?: AlertConfig;
}

/**
 * 指标数据点
 */
interface MetricDataPoint {
  timestamp: number;
  service: string;
  method: string;
  responseTime: number;
  success: boolean;
  tokens: number;
  errorType?: string;
}

/**
 * Logger 类
 */
export class Logger {
  private static instance: Logger;
  private level: LogLevel;
  private enableMetrics: boolean;
  private enableExtendedMetrics: boolean;
  private metricsWindow: number;
  private metrics: MetricDataPoint[] = [];
  private alertConfig: AlertConfig;
  private lastAlertCheck: number = 0;
  private alertCheckInterval: number = 60000; // 1分钟检查一次

  private constructor(options: LoggerOptions = {}) {
    this.level = options.level || LogLevel.INFO;
    this.enableMetrics = options.enableMetrics !== false;
    this.enableExtendedMetrics = options.enableExtendedMetrics || false;
    this.metricsWindow = options.metricsWindow || 3600000; // 1小时
    this.alertConfig = {
      errorRateThreshold: 0.05,
      avgResponseTimeThreshold: 10000,
      tokenUsageThreshold: 0.8,
      ...options.alertConfig,
    };
  }

  /**
   * 获取 Logger 单例实例
   */
  static getInstance(options?: LoggerOptions): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(options);
    }
    return Logger.instance;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 检查是否应该记录指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.level);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex <= currentLevelIndex;
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data && { data }),
    };

    const logString = JSON.stringify(logEntry, null, 2);

    switch (level) {
      case LogLevel.ERROR:
        console.error(`[Gemini Logger] ${logString}`);
        break;
      case LogLevel.WARN:
        console.warn(`[Gemini Logger] ${logString}`);
        break;
      case LogLevel.INFO:
        console.info(`[Gemini Logger] ${logString}`);
        break;
      case LogLevel.DEBUG:
        console.debug(`[Gemini Logger] ${logString}`);
        break;
    }
  }

  /**
   * 记录 ERROR 级别日志
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * 记录 WARN 级别日志
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * 记录 INFO 级别日志
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * 记录 DEBUG 级别日志
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * 记录 API 调用日志
   */
  logApiCall(log: ApiCallLog): void {
    this.info('API 调用', log);

    // 收集指标
    if (this.enableMetrics) {
      this.collectMetric({
        timestamp: Date.now(),
        service: log.service,
        method: log.method,
        responseTime: log.responseTime,
        success: log.success,
        tokens: log.tokenUsage?.totalTokens || 0,
        errorType: log.errorMessage ? this.classifyError(log.errorMessage) : '',
      });

      // 检查告警
      this.checkAlerts();
    }
  }

  /**
   * 分类错误类型
   */
  private classifyError(errorMessage: string): string {
    const lowerMsg = errorMessage.toLowerCase();
    
    if (lowerMsg.includes('429') || lowerMsg.includes('rate limit')) {
      return 'RATE_LIMIT';
    }
    if (lowerMsg.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (lowerMsg.includes('401') || lowerMsg.includes('unauthorized')) {
      return 'AUTH_ERROR';
    }
    if (lowerMsg.includes('500') || lowerMsg.includes('502') || lowerMsg.includes('503') || 
        lowerMsg.includes('504') || lowerMsg.includes('server error')) {
      return 'SERVER_ERROR';
    }
    if (lowerMsg.includes('400') || lowerMsg.includes('404') || lowerMsg.includes('client error')) {
      return 'CLIENT_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * 收集指标数据点
   */
  private collectMetric(dataPoint: MetricDataPoint): void {
    this.metrics.push(dataPoint);

    // 清理过期的指标数据
    const cutoffTime = Date.now() - this.metricsWindow;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): UsageStats {
    if (this.metrics.length === 0) {
      return {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        successRate: 0,
        averageResponseTime: 0,
        totalTokens: 0,
        timeRange: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
      };
    }

    const totalCalls = this.metrics.length;
    const successfulCalls = this.metrics.filter(m => m.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;
    
    const totalResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0);
    const averageResponseTime = totalCalls > 0 ? totalResponseTime / totalCalls : 0;
    
    const totalTokens = this.metrics.reduce((sum, m) => sum + m.tokens, 0);

    const timestamps = this.metrics.map(m => m.timestamp);
    const start = new Date(Math.min(...timestamps)).toISOString();
    const end = new Date(Math.max(...timestamps)).toISOString();

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      successRate,
      averageResponseTime,
      totalTokens,
      timeRange: {
        start,
        end,
      },
    };
  }

  /**
   * 获取扩展的使用统计（包含百分位数和分类统计）
   */
  getExtendedUsageStats(): ExtendedUsageStats {
    const basicStats = this.getUsageStats();

    if (!this.enableExtendedMetrics || this.metrics.length === 0) {
      return {
        ...basicStats,
        responseTimePercentiles: { p50: 0, p95: 0, p99: 0 },
        callsByService: {},
        callsByMethod: {},
        errorStats: {
          totalErrors: basicStats.failedCalls,
          errorRate: 1 - basicStats.successRate,
          errorsByType: {},
        },
      };
    }

    // 计算响应时间百分位数
    const responseTimes = this.metrics.map(m => m.responseTime).sort((a, b) => a - b);
    const responseTimePercentiles = {
      p50: this.calculatePercentile(responseTimes, 50),
      p95: this.calculatePercentile(responseTimes, 95),
      p99: this.calculatePercentile(responseTimes, 99),
    };

    // 按服务分类统计
    const callsByService: Record<string, ServiceStats> = {};
    for (const metric of this.metrics) {
      if (!callsByService[metric.service]) {
        callsByService[metric.service] = {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          averageResponseTime: 0,
        };
      }
      const stats = callsByService[metric.service];
      stats!.totalCalls++;
      if (metric.success) {
        stats!.successfulCalls++;
      } else {
        stats!.failedCalls++;
      }
    }

    // 计算每个服务的平均响应时间
    for (const service in callsByService) {
      const serviceMetrics = this.metrics.filter(m => m.service === service);
      const totalResponseTime = serviceMetrics.reduce((sum, m) => sum + m.responseTime, 0);
      callsByService[service]!.averageResponseTime = totalResponseTime / serviceMetrics.length;
    }

    // 按方法分类统计
    const callsByMethod: Record<string, MethodStats> = {};
    for (const metric of this.metrics) {
      if (!callsByMethod[metric.method]) {
        callsByMethod[metric.method] = {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          averageResponseTime: 0,
        };
      }
      const stats = callsByMethod[metric.method];
      stats!.totalCalls++;
      if (metric.success) {
        stats!.successfulCalls++;
      } else {
        stats!.failedCalls++;
      }
    }

    // 计算每个方法的平均响应时间
    for (const method in callsByMethod) {
      const methodMetrics = this.metrics.filter(m => m.method === method);
      const totalResponseTime = methodMetrics.reduce((sum, m) => sum + m.responseTime, 0);
      callsByMethod[method]!.averageResponseTime = totalResponseTime / methodMetrics.length;
    }

    // 错误统计
    const errorsByType: Record<string, number> = {};
    for (const metric of this.metrics) {
      if (!metric.success && metric.errorType) {
        errorsByType[metric.errorType] = (errorsByType[metric.errorType] || 0) + 1;
      }
    }

    return {
      ...basicStats,
      responseTimePercentiles,
      callsByService,
      callsByMethod,
      errorStats: {
        totalErrors: basicStats.failedCalls,
        errorRate: 1 - basicStats.successRate,
        errorsByType,
      },
    };
  }

  /**
   * 计算百分位数
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) {
      return 0;
    }
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)] || 0;
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(force: boolean = false): void {
    const now = Date.now();
    // 限制告警检查频率（除非强制检查）
    if (!force && now - this.lastAlertCheck < this.alertCheckInterval) {
      return;
    }
    this.lastAlertCheck = now;

    const stats = this.getUsageStats();

    // 检查错误率
    if (
      this.alertConfig.errorRateThreshold !== undefined &&
      stats.totalCalls >= 10 && // 至少10次调用才检查
      1 - stats.successRate > this.alertConfig.errorRateThreshold
    ) {
      this.triggerAlert({
        type: AlertType.HIGH_ERROR_RATE,
        message: `错误率超过阈值: ${((1 - stats.successRate) * 100).toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        currentValue: 1 - stats.successRate,
        threshold: this.alertConfig.errorRateThreshold,
        details: {
          totalCalls: stats.totalCalls,
          failedCalls: stats.failedCalls,
        },
      });
    }

    // 检查平均响应时间
    if (
      this.alertConfig.avgResponseTimeThreshold !== undefined &&
      stats.averageResponseTime > this.alertConfig.avgResponseTimeThreshold
    ) {
      this.triggerAlert({
        type: AlertType.HIGH_RESPONSE_TIME,
        message: `平均响应时间超过阈值: ${stats.averageResponseTime.toFixed(2)}ms`,
        timestamp: new Date().toISOString(),
        currentValue: stats.averageResponseTime,
        threshold: this.alertConfig.avgResponseTimeThreshold,
        details: {
          totalCalls: stats.totalCalls,
        },
      });
    }

    // 检查Token使用量
    if (
      this.alertConfig.tokenUsageThreshold !== undefined &&
      this.alertConfig.tokenQuota !== undefined &&
      stats.totalTokens > this.alertConfig.tokenQuota * this.alertConfig.tokenUsageThreshold
    ) {
      this.triggerAlert({
        type: AlertType.HIGH_TOKEN_USAGE,
        message: `Token使用量超过配额的${(this.alertConfig.tokenUsageThreshold * 100).toFixed(0)}%`,
        timestamp: new Date().toISOString(),
        currentValue: stats.totalTokens,
        threshold: this.alertConfig.tokenQuota * this.alertConfig.tokenUsageThreshold,
        details: {
          totalTokens: stats.totalTokens,
          quota: this.alertConfig.tokenQuota,
          usagePercentage: (stats.totalTokens / this.alertConfig.tokenQuota) * 100,
        },
      });
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(alert: Alert): void {
    this.warn('告警触发', alert);
    if (this.alertConfig.onAlert) {
      this.alertConfig.onAlert(alert);
    }
  }

  /**
   * 导出Prometheus格式的指标
   */
  exportPrometheusMetrics(): string {
    const stats = this.enableExtendedMetrics 
      ? this.getExtendedUsageStats() 
      : this.getUsageStats();

    const lines: string[] = [];

    // API调用总数
    lines.push('# HELP gemini_api_calls_total Total number of API calls');
    lines.push('# TYPE gemini_api_calls_total counter');
    lines.push(`gemini_api_calls_total ${stats.totalCalls}`);
    lines.push('');

    // 成功调用数
    lines.push('# HELP gemini_api_calls_success_total Total number of successful API calls');
    lines.push('# TYPE gemini_api_calls_success_total counter');
    lines.push(`gemini_api_calls_success_total ${stats.successfulCalls}`);
    lines.push('');

    // 失败调用数
    lines.push('# HELP gemini_api_calls_failed_total Total number of failed API calls');
    lines.push('# TYPE gemini_api_calls_failed_total counter');
    lines.push(`gemini_api_calls_failed_total ${stats.failedCalls}`);
    lines.push('');

    // 成功率
    lines.push('# HELP gemini_api_success_rate Success rate of API calls');
    lines.push('# TYPE gemini_api_success_rate gauge');
    lines.push(`gemini_api_success_rate ${stats.successRate.toFixed(4)}`);
    lines.push('');

    // 平均响应时间
    lines.push('# HELP gemini_api_response_time_avg_ms Average response time in milliseconds');
    lines.push('# TYPE gemini_api_response_time_avg_ms gauge');
    lines.push(`gemini_api_response_time_avg_ms ${stats.averageResponseTime.toFixed(2)}`);
    lines.push('');

    // Token使用总量
    lines.push('# HELP gemini_api_tokens_total Total number of tokens used');
    lines.push('# TYPE gemini_api_tokens_total counter');
    lines.push(`gemini_api_tokens_total ${stats.totalTokens}`);
    lines.push('');

    // 扩展指标
    if (this.enableExtendedMetrics && 'responseTimePercentiles' in stats) {
      const extStats = stats as ExtendedUsageStats;

      // 响应时间百分位数
      lines.push('# HELP gemini_api_response_time_p50_ms 50th percentile response time in milliseconds');
      lines.push('# TYPE gemini_api_response_time_p50_ms gauge');
      lines.push(`gemini_api_response_time_p50_ms ${extStats.responseTimePercentiles.p50.toFixed(2)}`);
      lines.push('');

      lines.push('# HELP gemini_api_response_time_p95_ms 95th percentile response time in milliseconds');
      lines.push('# TYPE gemini_api_response_time_p95_ms gauge');
      lines.push(`gemini_api_response_time_p95_ms ${extStats.responseTimePercentiles.p95.toFixed(2)}`);
      lines.push('');

      lines.push('# HELP gemini_api_response_time_p99_ms 99th percentile response time in milliseconds');
      lines.push('# TYPE gemini_api_response_time_p99_ms gauge');
      lines.push(`gemini_api_response_time_p99_ms ${extStats.responseTimePercentiles.p99.toFixed(2)}`);
      lines.push('');

      // 错误率
      lines.push('# HELP gemini_api_error_rate Error rate of API calls');
      lines.push('# TYPE gemini_api_error_rate gauge');
      lines.push(`gemini_api_error_rate ${extStats.errorStats.errorRate.toFixed(4)}`);
      lines.push('');

      // 按服务分类的调用数
      lines.push('# HELP gemini_api_calls_by_service_total Total API calls by service');
      lines.push('# TYPE gemini_api_calls_by_service_total counter');
      for (const [service, serviceStats] of Object.entries(extStats.callsByService)) {
        lines.push(`gemini_api_calls_by_service_total{service="${service}"} ${serviceStats.totalCalls}`);
      }
      lines.push('');

      // 按方法分类的调用数
      lines.push('# HELP gemini_api_calls_by_method_total Total API calls by method');
      lines.push('# TYPE gemini_api_calls_by_method_total counter');
      for (const [method, methodStats] of Object.entries(extStats.callsByMethod)) {
        lines.push(`gemini_api_calls_by_method_total{method="${method}"} ${methodStats.totalCalls}`);
      }
      lines.push('');

      // 按错误类型分类的错误数
      lines.push('# HELP gemini_api_errors_by_type_total Total errors by type');
      lines.push('# TYPE gemini_api_errors_by_type_total counter');
      for (const [errorType, count] of Object.entries(extStats.errorStats.errorsByType)) {
        lines.push(`gemini_api_errors_by_type_total{error_type="${errorType}"} ${count}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 强制检查告警（用于测试）
   */
  forceCheckAlerts(): void {
    this.checkAlerts(true);
  }

  /**
   * 清除所有指标数据
   */
  clearMetrics(): void {
    this.metrics = [];
    this.lastAlertCheck = 0;
  }

  /**
   * 重置 Logger 实例（主要用于测试）
   */
  static resetInstance(): void {
    if (Logger.instance) {
      Logger.instance.clearMetrics();
    }
    Logger.instance = null as any;
  }
}
