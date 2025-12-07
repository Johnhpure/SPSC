/**
 * Gemini API 管理后台 - 配置管理服务
 * 
 * 负责管理 Gemini API 的配置信息，包括：
 * - Base URL 配置
 * - 默认模型选择
 * - 超时和重试设置
 * - 配置验证
 * - 配置热更新
 */

import { Database } from 'sqlite';
import { getDb } from '../../db';
import { GeminiClientManager } from '../gemini/client-manager';
import { GoogleGenAI } from '@google/genai';

/**
 * Gemini 配置接口
 */
export interface GeminiConfig {
  id: number;
  baseUrl: string;
  defaultTextModel: string;
  defaultVisionModel: string;
  defaultImageGenModel: string;
  timeout: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 模型信息接口
 */
export interface ModelInfo {
  name: string;
  version?: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
}

/**
 * 配置备份接口
 */
export interface ConfigBackup {
  version: string;
  exportedAt: string;
  config: GeminiConfig;
  apiKeys?: Array<{
    name: string;
    keyValue: string;
    priority: number;
    isActive: boolean;
  }>;
}

/**
 * 配置管理服务错误类
 */
export class ConfigServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigServiceError';
  }
}

/**
 * 配置管理服务
 */
export class AdminConfigService {
  private db: any = null;
  private modelListCache: { data: ModelInfo[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

  /**
   * 初始化数据库连接
   */
  private async getDatabase(): Promise<Database> {
    if (!this.db) {
      this.db = await getDb();
    }
    return this.db;
  }

  /**
   * 获取当前配置
   * @returns 当前的 Gemini 配置
   */
  async getConfig(): Promise<GeminiConfig> {
    const db = await this.getDatabase();
    const row = await db.get<any>(
      'SELECT * FROM gemini_configs WHERE id = 1'
    );

    if (!row) {
      throw new ConfigServiceError('配置不存在，请先初始化数据库');
    }

    // 将数据库字段名（snake_case）转换为 camelCase
    return {
      id: row.id,
      baseUrl: row.base_url,
      defaultTextModel: row.default_text_model,
      defaultVisionModel: row.default_vision_model,
      defaultImageGenModel: row.default_image_gen_model,
      timeout: row.timeout,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 更新配置
   * @param updates - 要更新的配置项
   * @returns 更新后的配置
   */
  async updateConfig(updates: Partial<Omit<GeminiConfig, 'id' | 'createdAt' | 'updatedAt'>>): Promise<GeminiConfig> {
    const db = await this.getDatabase();

    // 验证 Base URL（如果提供）
    if (updates.baseUrl !== undefined) {
      this.validateBaseUrl(updates.baseUrl);
    }

    // 构建更新语句
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.baseUrl !== undefined) {
      fields.push('base_url = ?');
      values.push(updates.baseUrl);
    }
    if (updates.defaultTextModel !== undefined) {
      fields.push('default_text_model = ?');
      values.push(updates.defaultTextModel);
    }
    if (updates.defaultVisionModel !== undefined) {
      fields.push('default_vision_model = ?');
      values.push(updates.defaultVisionModel);
    }
    if (updates.defaultImageGenModel !== undefined) {
      fields.push('default_image_gen_model = ?');
      values.push(updates.defaultImageGenModel);
    }
    if (updates.timeout !== undefined) {
      fields.push('timeout = ?');
      values.push(updates.timeout);
    }
    if (updates.maxRetries !== undefined) {
      fields.push('max_retries = ?');
      values.push(updates.maxRetries);
    }

    // 添加更新时间
    fields.push('updated_at = CURRENT_TIMESTAMP');

    if (fields.length === 1) {
      // 只有 updated_at，没有实际更新
      return this.getConfig();
    }

    // 执行更新
    values.push(1); // WHERE id = 1
    await db.run(
      `UPDATE gemini_configs SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    // 触发客户端重新初始化
    await this.reinitializeClient();

    // 返回更新后的配置
    return this.getConfig();
  }

  /**
   * 验证 Base URL 格式
   * @param url - 要验证的 URL
   * @throws {ConfigServiceError} 当 URL 格式无效时
   */
  validateBaseUrl(url: string): void {
    if (!url || url.trim() === '') {
      throw new ConfigServiceError('Base URL 不能为空');
    }

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new ConfigServiceError('Base URL 必须使用 HTTP 或 HTTPS 协议');
      }
    } catch (error) {
      if (error instanceof ConfigServiceError) {
        throw error;
      }
      throw new ConfigServiceError('Base URL 格式无效');
    }
  }

  /**
   * 重新初始化 Gemini 客户端
   * 在配置更新后调用，确保使用新配置
   */
  private async reinitializeClient(): Promise<void> {
    try {
      const clientManager = GeminiClientManager.getInstance();
      
      // 重置客户端
      clientManager.reset();
      
      // 重新初始化（使用环境变量中的 API Key）
      clientManager.initialize();
      
      console.log('[AdminConfigService] Gemini 客户端已重新初始化');
    } catch (error) {
      console.error('[AdminConfigService] 客户端重新初始化失败:', error);
      // 不抛出错误，因为配置已经保存成功
    }
  }

  /**
   * 从 API 获取模型列表
   * @param apiKey - API 密钥（可选，默认使用环境变量）
   * @returns 可用模型列表
   */
  async fetchModelList(apiKey?: string): Promise<ModelInfo[]> {
    // 检查缓存
    if (this.modelListCache && Date.now() - this.modelListCache.timestamp < this.CACHE_TTL) {
      console.log('[AdminConfigService] 使用缓存的模型列表');
      return this.modelListCache.data;
    }

    try {
      // 获取配置
      const config = await this.getConfig();
      
      // 使用提供的 API Key 或环境变量
      const key = apiKey || process.env.GEMINI_API_KEY;
      if (!key) {
        throw new ConfigServiceError('API Key 未配置');
      }

      // 创建临时客户端
      const client = new GoogleGenAI({ apiKey: key });
      
      // 调用 list models API
      const modelsPager = await client.models.list();
      
      // 收集所有模型
      const models: ModelInfo[] = [];
      for await (const model of modelsPager) {
        models.push({
          name: model.name || '',
          version: model.version,
          displayName: model.displayName || model.name || '',
          description: model.description,
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit,
          supportedGenerationMethods: (model as any).supportedGenerationMethods || [],
        });
      }

      // 更新缓存
      this.modelListCache = {
        data: models,
        timestamp: Date.now(),
      };

      console.log(`[AdminConfigService] 成功获取 ${models.length} 个模型`);
      return models;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ConfigServiceError(`获取模型列表失败: ${errorMessage}`);
    }
  }

  /**
   * 清除模型列表缓存
   */
  clearModelListCache(): void {
    this.modelListCache = null;
    console.log('[AdminConfigService] 模型列表缓存已清除');
  }

  /**
   * 导出配置为 JSON
   * @param includeApiKeys - 是否包含 API Keys
   * @returns 配置备份 JSON 字符串
   */
  async exportConfig(includeApiKeys: boolean = false): Promise<string> {
    const db = await this.getDatabase();
    
    // 获取配置
    const config = await this.getConfig();
    
    // 构建备份对象
    const backup: ConfigBackup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      config,
    };

    // 如果需要包含 API Keys
    if (includeApiKeys) {
      const keys = await db.all<Array<{
        key_name: string;
        key_value: string;
        priority: number;
        is_active: number;
      }>>(
        'SELECT key_name, key_value, priority, is_active FROM gemini_api_keys'
      );

      backup.apiKeys = keys.map(key => ({
        name: key.key_name,
        keyValue: key.key_value,
        priority: key.priority,
        isActive: key.is_active === 1,
      }));
    }

    return JSON.stringify(backup, null, 2);
  }

  /**
   * 从 JSON 导入配置
   * @param configJson - 配置备份 JSON 字符串
   * @returns 导入后的配置
   */
  async importConfig(configJson: string): Promise<GeminiConfig> {
    let backup: ConfigBackup;

    // 解析 JSON
    try {
      backup = JSON.parse(configJson);
    } catch (error) {
      throw new ConfigServiceError('配置文件格式无效，无法解析 JSON');
    }

    // 验证备份格式
    if (!backup.version || !backup.config) {
      throw new ConfigServiceError('配置文件格式无效，缺少必要字段');
    }

    // 验证配置内容
    const { config } = backup;
    if (!config.baseUrl || !config.defaultTextModel || !config.defaultVisionModel || !config.defaultImageGenModel) {
      throw new ConfigServiceError('配置文件内容不完整');
    }

    // 验证 Base URL
    this.validateBaseUrl(config.baseUrl);

    // 更新配置
    const updatedConfig = await this.updateConfig({
      baseUrl: config.baseUrl,
      defaultTextModel: config.defaultTextModel,
      defaultVisionModel: config.defaultVisionModel,
      defaultImageGenModel: config.defaultImageGenModel,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
    });

    // 如果备份包含 API Keys，导入它们
    if (backup.apiKeys && backup.apiKeys.length > 0) {
      const db = await this.getDatabase();
      
      // 注意：这里只是简单导入，实际应该由 AdminKeyService 处理
      // 为了避免循环依赖，这里只记录日志
      console.log(`[AdminConfigService] 配置备份包含 ${backup.apiKeys.length} 个 API Keys，需要手动导入`);
    }

    console.log('[AdminConfigService] 配置导入成功');
    return updatedConfig;
  }
}

/**
 * 导出单例实例
 */
let adminConfigServiceInstance: AdminConfigService | null = null;

export function getAdminConfigService(): AdminConfigService {
  if (!adminConfigServiceInstance) {
    adminConfigServiceInstance = new AdminConfigService();
  }
  return adminConfigServiceInstance;
}
