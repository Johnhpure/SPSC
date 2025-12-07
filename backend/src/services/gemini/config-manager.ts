/**
 * ConfigManager - Gemini API 配置管理模块
 * 
 * 职责：
 * - 读取 JSON 配置文件
 * - 支持环境变量覆盖
 * - 配置验证和默认值
 * - 配置热更新监听
 * 
 * 验证需求: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { CONFIG } from '../../config';

/**
 * Gemini 配置接口
 */
export interface GeminiConfig {
  // API 配置
  apiKey: string;
  defaultTextModel: string;
  defaultImageModel: string;
  defaultVisionModel: string;
  
  // 性能配置
  maxConcurrentRequests: number;
  requestTimeout: number;
  maxRetries: number;
  
  // 缓存配置
  cacheEnabled: boolean;
  cacheTTL: number;
  
  // 日志配置
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  
  // 模式配置
  mockMode: boolean;
}

/**
 * 配置验证错误
 */
export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * 配置变更回调函数类型
 */
export type ConfigChangeCallback = (newConfig: GeminiConfig) => void;

/**
 * 默认配置
 */
const DEFAULT_CONFIG: GeminiConfig = {
  apiKey: '',
  defaultTextModel: 'gemini-2.0-flash',
  defaultImageModel: 'imagen-3.0-generate-002',
  defaultVisionModel: 'gemini-2.0-flash',
  maxConcurrentRequests: 10,
  requestTimeout: 30000,
  maxRetries: 3,
  cacheEnabled: false,
  cacheTTL: 3600,
  logLevel: 'info',
  mockMode: false,
};

/**
 * ConfigManager 单例类
 * 
 * 管理 Gemini API 的配置，支持文件读取、环境变量覆盖和热更新
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: GeminiConfig;
  private configFilePath: string;
  private watcher: fs.FSWatcher | null = null;
  private changeCallbacks: ConfigChangeCallback[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 1000; // 1秒防抖

  /**
   * 私有构造函数
   */
  private constructor() {
    // 默认配置文件路径
    this.configFilePath = path.join(process.cwd(), 'gemini-config.json');
    
    // 初始化配置
    this.config = this.loadConfig();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 加载配置
   * 优先级：环境变量 > JSON 配置文件 > 默认值
   */
  private loadConfig(): GeminiConfig {
    // 从默认配置开始
    let config: GeminiConfig = { ...DEFAULT_CONFIG };

    // 尝试读取 JSON 配置文件
    if (fs.existsSync(this.configFilePath)) {
      try {
        const fileContent = fs.readFileSync(this.configFilePath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        config = { ...config, ...fileConfig };
        console.log(`[ConfigManager] 已加载配置文件: ${this.configFilePath}`);
      } catch (error) {
        console.warn(`[ConfigManager] 配置文件读取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 环境变量覆盖
    config = this.applyEnvironmentOverrides(config);

    // 验证配置
    this.validateConfig(config);

    return config;
  }

  /**
   * 应用环境变量覆盖
   */
  private applyEnvironmentOverrides(config: GeminiConfig): GeminiConfig {
    const overridden = { ...config };

    // API 配置 - 只使用环境变量，不使用 CONFIG 对象
    if (process.env.GEMINI_API_KEY) {
      overridden.apiKey = process.env.GEMINI_API_KEY;
    }

    if (process.env.GEMINI_DEFAULT_TEXT_MODEL) {
      overridden.defaultTextModel = process.env.GEMINI_DEFAULT_TEXT_MODEL;
    }

    if (process.env.GEMINI_DEFAULT_IMAGE_MODEL) {
      overridden.defaultImageModel = process.env.GEMINI_DEFAULT_IMAGE_MODEL;
    }

    if (process.env.GEMINI_DEFAULT_VISION_MODEL) {
      overridden.defaultVisionModel = process.env.GEMINI_DEFAULT_VISION_MODEL;
    }

    // 性能配置
    if (process.env.GEMINI_MAX_CONCURRENT_REQUESTS) {
      overridden.maxConcurrentRequests = parseInt(process.env.GEMINI_MAX_CONCURRENT_REQUESTS, 10);
    }

    if (process.env.GEMINI_REQUEST_TIMEOUT) {
      overridden.requestTimeout = parseInt(process.env.GEMINI_REQUEST_TIMEOUT, 10);
    }

    if (process.env.GEMINI_MAX_RETRIES) {
      overridden.maxRetries = parseInt(process.env.GEMINI_MAX_RETRIES, 10);
    }

    // 缓存配置
    if (process.env.GEMINI_CACHE_ENABLED !== undefined) {
      overridden.cacheEnabled = process.env.GEMINI_CACHE_ENABLED === 'true';
    }

    if (process.env.GEMINI_CACHE_TTL) {
      overridden.cacheTTL = parseInt(process.env.GEMINI_CACHE_TTL, 10);
    }

    // 日志配置
    if (process.env.LOG_LEVEL) {
      overridden.logLevel = process.env.LOG_LEVEL as GeminiConfig['logLevel'];
    }

    // 模式配置
    if (process.env.MOCK_MODE !== undefined) {
      overridden.mockMode = process.env.MOCK_MODE === 'true';
    }

    return overridden;
  }

  /**
   * 验证配置
   */
  private validateConfig(config: GeminiConfig): void {
    const errors: string[] = [];

    // 验证 API 密钥（非 MOCK_MODE 时必需）
    if (!config.mockMode && (!config.apiKey || config.apiKey.trim() === '')) {
      errors.push('API 密钥不能为空（除非启用 MOCK_MODE）');
    }

    // 验证模型名称
    if (!config.defaultTextModel || config.defaultTextModel.trim() === '') {
      errors.push('默认文本模型名称不能为空');
    }

    if (!config.defaultImageModel || config.defaultImageModel.trim() === '') {
      errors.push('默认图像模型名称不能为空');
    }

    if (!config.defaultVisionModel || config.defaultVisionModel.trim() === '') {
      errors.push('默认视觉模型名称不能为空');
    }

    // 验证数值范围
    if (config.maxConcurrentRequests < 1 || config.maxConcurrentRequests > 100) {
      errors.push('最大并发请求数必须在 1-100 之间');
    }

    if (config.requestTimeout < 1000 || config.requestTimeout > 300000) {
      errors.push('请求超时时间必须在 1000-300000 毫秒之间');
    }

    if (config.maxRetries < 0 || config.maxRetries > 10) {
      errors.push('最大重试次数必须在 0-10 之间');
    }

    if (config.cacheTTL < 0) {
      errors.push('缓存 TTL 不能为负数');
    }

    // 验证日志级别
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(config.logLevel)) {
      errors.push(`日志级别必须是以下之一: ${validLogLevels.join(', ')}`);
    }

    // 如果有错误，抛出异常
    if (errors.length > 0) {
      throw new ConfigValidationError(
        `配置验证失败:\n${errors.map(e => `  - ${e}`).join('\n')}`
      );
    }
  }

  /**
   * 获取当前配置
   */
  public getConfig(): Readonly<GeminiConfig> {
    return { ...this.config };
  }

  /**
   * 获取特定配置项
   */
  public get<K extends keyof GeminiConfig>(key: K): GeminiConfig[K] {
    return this.config[key];
  }

  /**
   * 设置配置文件路径
   */
  public setConfigFilePath(filePath: string): void {
    this.configFilePath = filePath;
  }

  /**
   * 重新加载配置
   */
  public reload(): void {
    try {
      const newConfig = this.loadConfig();
      const oldConfig = this.config;
      this.config = newConfig;
      
      console.log('[ConfigManager] 配置已重新加载');
      
      // 通知所有监听器
      this.notifyConfigChange(newConfig);
    } catch (error) {
      console.error('[ConfigManager] 配置重新加载失败:', error);
      throw error;
    }
  }

  /**
   * 启动配置文件监听（热更新）
   */
  public startWatching(): void {
    if (this.watcher) {
      console.log('[ConfigManager] 配置文件监听已启动，跳过重复启动');
      return;
    }

    if (!fs.existsSync(this.configFilePath)) {
      console.log(`[ConfigManager] 配置文件不存在，跳过监听: ${this.configFilePath}`);
      return;
    }

    try {
      this.watcher = fs.watch(this.configFilePath, (eventType, filename) => {
        if (eventType === 'change') {
          console.log(`[ConfigManager] 检测到配置文件变化: ${filename}`);
          
          // 防抖处理
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }

          this.debounceTimer = setTimeout(() => {
            try {
              this.reload();
            } catch (error) {
              console.error('[ConfigManager] 配置热更新失败:', error);
            }
          }, this.DEBOUNCE_DELAY);
        }
      });

      console.log(`[ConfigManager] 已启动配置文件监听: ${this.configFilePath}`);
    } catch (error) {
      console.error('[ConfigManager] 启动配置文件监听失败:', error);
    }
  }

  /**
   * 停止配置文件监听
   */
  public stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      console.log('[ConfigManager] 已停止配置文件监听');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * 注册配置变更回调
   */
  public onConfigChange(callback: ConfigChangeCallback): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * 移除配置变更回调
   */
  public offConfigChange(callback: ConfigChangeCallback): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  /**
   * 通知配置变更
   */
  private notifyConfigChange(newConfig: GeminiConfig): void {
    this.changeCallbacks.forEach(callback => {
      try {
        callback(newConfig);
      } catch (error) {
        console.error('[ConfigManager] 配置变更回调执行失败:', error);
      }
    });
  }

  /**
   * 重置配置管理器（主要用于测试）
   */
  public reset(): void {
    this.stopWatching();
    this.changeCallbacks = [];
    this.config = this.loadConfig();
    console.log('[ConfigManager] 配置管理器已重置');
  }
}

/**
 * 导出单例实例的便捷访问方法
 */
export const getConfigManager = () => ConfigManager.getInstance();

/**
 * 导出便捷的配置访问方法
 */
export const getConfig = () => getConfigManager().getConfig();
