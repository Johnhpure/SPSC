/**
 * Gemini 管理后台服务模块导出
 */

// 配置管理
export { AdminConfigService, getAdminConfigService, ConfigServiceError } from './config-service';
export type { GeminiConfig, ModelInfo } from './config-service';

// 密钥管理
export { AdminKeyService, getAdminKeyService } from './key-service';
export type { ApiKey, KeyRotationStrategy } from './key-service';

// 加密服务
export { EncryptionService, getEncryptionService } from './encryption';

// 日志拦截器
export { LoggingInterceptor, getLoggingInterceptor } from './logging-interceptor';
export type { CallLog } from './logging-interceptor';

// 日志查询服务
export { LogQueryService, getLogQueryService } from './log-query-service';
export type { LogQuery, LogQueryResult } from './log-query-service';

// 测速服务
export { BenchmarkService, getBenchmarkService } from './benchmark-service';
export type {
  BenchmarkResult,
  BenchmarkOptions,
  BenchmarkComparison,
  FunctionTestOptions,
  FunctionTestResult,
} from './benchmark-service';

// 统计服务
export { StatisticsService, getStatisticsService } from './statistics-service';
export type { Statistics, StatisticsQuery, TimeSeriesData, TimeSeriesDataPoint } from './statistics-service';

// 服务工厂
export {
  GeminiServiceFactory,
  getTextService,
  getImageService,
  getFileService,
  getStreamService,
} from './service-factory';
