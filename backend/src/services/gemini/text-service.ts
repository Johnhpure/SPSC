/**
 * GeminiTextService - Gemini 文本生成服务
 * 
 * 提供文本生成、类目推荐和产品分析功能
 */

import { GeminiClientManager } from './client-manager';
import { ErrorHandler, GeminiError } from './error-handler';
import { Logger, LogLevel } from './logger';
import { CONFIG } from '../../config';

/**
 * 文本生成配置选项
 */
export interface TextGenerationOptions {
  /** 模型名称，默认 gemini-2.0-flash */
  model?: string;
  /** 最大输出 token 数 */
  maxOutputTokens?: number;
  /** 温度参数 (0-2)，控制随机性 */
  temperature?: number;
  /** Top-p 采样参数 */
  topP?: number;
  /** Top-k 采样参数 */
  topK?: number;
}

/**
 * 产品分析结果接口
 */
export interface ProductAnalysis {
  /** 推荐的类目列表 */
  categories: string[];
  /** 产品标签 */
  tags: string[];
  /** 产品描述 */
  description: string;
  /** 改进建议 */
  suggestedImprovements: string[];
  /** 质量评分 (0-100) */
  qualityScore: number;
}

/**
 * Mock 数据
 */
const MOCK_RESPONSES = {
  categories: ['电子产品', '手机配件', '充电器'],
  productAnalysis: {
    categories: ['电子产品', '数码配件'],
    tags: ['充电', '快充', 'USB'],
    description: '这是一款高质量的充电设备',
    suggestedImprovements: ['建议添加更多产品细节', '优化产品图片'],
    qualityScore: 85,
  },
};

/**
 * GeminiTextService 类
 */
export class GeminiTextService {
  private clientManager: GeminiClientManager;
  private logger: Logger;
  private defaultModel: string;

  constructor() {
    this.clientManager = GeminiClientManager.getInstance();
    this.logger = Logger.getInstance();
    this.defaultModel = process.env.GEMINI_DEFAULT_TEXT_MODEL || 'gemini-2.0-flash';
  }

  /**
   * 通用文本生成方法
   * 
   * @param prompt - 文本提示
   * @param options - 生成配置选项
   * @returns 生成的文本内容
   */
  async generateText(
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<string> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    try {
      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 返回模拟文本生成结果');
        const mockResponse = `模拟响应: ${prompt.substring(0, 50)}...`;
        
        // 记录 API 调用日志
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiTextService',
          method: 'generateText',
          model,
          requestParams: { prompt, options },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return mockResponse;
      }

      // 使用 ErrorHandler 包装 API 调用
      const result = await ErrorHandler.withRetry(
        async () => {
          const client = this.clientManager.getClient();
          
          // 构建生成配置
          const generationConfig: any = {};
          if (options.maxOutputTokens) generationConfig.maxOutputTokens = options.maxOutputTokens;
          if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
          if (options.topP !== undefined) generationConfig.topP = options.topP;
          if (options.topK !== undefined) generationConfig.topK = options.topK;

          // 调用 API
          const response = await client.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
          });

          // 提取文本内容
          const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new GeminiError(
              '响应中未找到文本内容',
              'NO_TEXT_CONTENT',
              undefined,
              false
            );
          }

          return text;
        },
        {},
        {
          service: 'GeminiTextService',
          method: 'generateText',
          params: { prompt: prompt.substring(0, 100), options },
        }
      );

      // 记录成功的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiTextService',
        method: 'generateText',
        model,
        requestParams: { prompt: prompt.substring(0, 100), options },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

      return result;
    } catch (error) {
      // 记录失败的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiTextService',
        method: 'generateText',
        model,
        requestParams: { prompt: prompt.substring(0, 100), options },
        responseTime: Date.now() - startTime,
        statusCode: error instanceof GeminiError ? error.status || 500 : 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // 降级响应
      this.logger.warn('文本生成失败，返回降级响应', { error });
      return '抱歉，文本生成服务暂时不可用。';
    }
  }

  /**
   * 推荐产品类目
   * 
   * @param title - 产品标题
   * @param description - 产品描述
   * @param options - 生成配置选项
   * @returns 推荐的类目列表
   */
  async recommendCategories(
    title: string,
    description: string,
    options: TextGenerationOptions = {}
  ): Promise<string[]> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    try {
      // MOCK_MODE 处理 - 直接返回模拟数据
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 返回模拟类目推荐结果');
        
        // 记录 API 调用日志
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiTextService',
          method: 'recommendCategories',
          model,
          requestParams: { title, description, options },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return MOCK_RESPONSES.categories;
      }

      // 构建提示词
      const prompt = `请根据以下产品信息推荐3-5个合适的类目：

产品标题：${title}
产品描述：${description}

请以JSON数组格式返回类目列表，例如：["类目1", "类目2", "类目3"]
只返回JSON数组，不要包含其他文字说明。`;

      // 使用 ErrorHandler 包装 API 调用
      const result = await ErrorHandler.withRetry(
        async () => {
          // 直接调用 API 而不是通过 generateText
          const client = this.clientManager.getClient();
          
          // 构建生成配置
          const generationConfig: any = {
            temperature: options.temperature ?? 0.3,
          };
          if (options.maxOutputTokens) generationConfig.maxOutputTokens = options.maxOutputTokens;
          if (options.topP !== undefined) generationConfig.topP = options.topP;
          if (options.topK !== undefined) generationConfig.topK = options.topK;

          // 调用 API
          const response = await client.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: generationConfig,
          });

          // 提取文本内容
          const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new GeminiError(
              '响应中未找到文本内容',
              'NO_TEXT_CONTENT',
              undefined,
              false
            );
          }

          // 解析 JSON 响应
          try {
            // 尝试提取 JSON 数组
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const categories = JSON.parse(jsonMatch[0]);
              if (Array.isArray(categories) && categories.every(c => typeof c === 'string')) {
                return categories;
              }
            }
            
            // 如果解析失败，返回空数组
            throw new Error('无法解析类目列表');
          } catch (parseError) {
            this.logger.warn('类目推荐响应解析失败', { text, parseError });
            return [];
          }
        },
        {},
        {
          service: 'GeminiTextService',
          method: 'recommendCategories',
          params: { title, description, options },
        }
      );

      // 记录成功的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiTextService',
        method: 'recommendCategories',
        model,
        requestParams: { title, description, options },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

      return result;
    } catch (error) {
      // 记录失败的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiTextService',
        method: 'recommendCategories',
        model,
        requestParams: { title, description, options },
        responseTime: Date.now() - startTime,
        statusCode: error instanceof GeminiError ? error.status || 500 : 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // 降级响应：返回空数组
      this.logger.warn('类目推荐失败，返回空数组', { error });
      return [];
    }
  }

  /**
   * 分析产品信息
   * 
   * @param title - 产品标题
   * @param description - 产品描述
   * @param imageUrl - 产品图片URL（可选）
   * @param options - 生成配置选项
   * @returns 产品分析结果
   */
  async analyzeProduct(
    title: string,
    description: string,
    imageUrl?: string,
    options: TextGenerationOptions = {}
  ): Promise<ProductAnalysis> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    try {
      // MOCK_MODE 处理 - 直接返回模拟数据
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 返回模拟产品分析结果');
        
        // 记录 API 调用日志
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiTextService',
          method: 'analyzeProduct',
          model,
          requestParams: { title, description, imageUrl, options },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return MOCK_RESPONSES.productAnalysis;
      }

      // 构建提示词
      const prompt = `请分析以下产品信息并提供详细的分析报告：

产品标题：${title}
产品描述：${description}
${imageUrl ? `产品图片：${imageUrl}` : ''}

请以JSON格式返回分析结果，包含以下字段：
{
  "categories": ["类目1", "类目2"],
  "tags": ["标签1", "标签2", "标签3"],
  "description": "产品描述总结",
  "suggestedImprovements": ["改进建议1", "改进建议2"],
  "qualityScore": 85
}

只返回JSON对象，不要包含其他文字说明。`;

      // 使用 ErrorHandler 包装 API 调用
      const result = await ErrorHandler.withRetry(
        async () => {
          // 直接调用 API 而不是通过 generateText
          const client = this.clientManager.getClient();
          
          // 构建生成配置
          const generationConfig: any = {
            temperature: options.temperature ?? 0.3,
          };
          if (options.maxOutputTokens) generationConfig.maxOutputTokens = options.maxOutputTokens;
          if (options.topP !== undefined) generationConfig.topP = options.topP;
          if (options.topK !== undefined) generationConfig.topK = options.topK;

          // 调用 API
          const response = await client.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: generationConfig,
          });

          // 提取文本内容
          const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new GeminiError(
              '响应中未找到文本内容',
              'NO_TEXT_CONTENT',
              undefined,
              false
            );
          }

          // 解析 JSON 响应
          try {
            // 尝试提取 JSON 对象
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const analysis = JSON.parse(jsonMatch[0]);
              
              // 验证必需字段
              if (
                Array.isArray(analysis.categories) &&
                Array.isArray(analysis.tags) &&
                typeof analysis.description === 'string' &&
                Array.isArray(analysis.suggestedImprovements) &&
                typeof analysis.qualityScore === 'number'
              ) {
                return analysis as ProductAnalysis;
              }
            }
            
            throw new Error('无法解析产品分析结果');
          } catch (parseError) {
            this.logger.warn('产品分析响应解析失败', { text, parseError });
            // 返回默认分析结果
            return {
              categories: [],
              tags: [],
              description: '无法生成产品描述',
              suggestedImprovements: [],
              qualityScore: 0,
            };
          }
        },
        {},
        {
          service: 'GeminiTextService',
          method: 'analyzeProduct',
          params: { title, description, imageUrl, options },
        }
      );

      // 记录成功的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiTextService',
        method: 'analyzeProduct',
        model,
        requestParams: { title, description, imageUrl, options },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

      return result;
    } catch (error) {
      // 记录失败的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiTextService',
        method: 'analyzeProduct',
        model,
        requestParams: { title, description, imageUrl, options },
        responseTime: Date.now() - startTime,
        statusCode: error instanceof GeminiError ? error.status || 500 : 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // 降级响应：返回默认分析结果
      this.logger.warn('产品分析失败，返回降级响应', { error });
      return {
        categories: [],
        tags: [],
        description: '产品分析服务暂时不可用',
        suggestedImprovements: [],
        qualityScore: 0,
      };
    }
  }
}

