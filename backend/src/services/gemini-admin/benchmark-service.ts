/**
 * BenchmarkService - Gemini 模型性能测试服务
 * 
 * 职责：
 * - 测试单个模型的性能指标
 * - 批量测试多个模型并生成对比报告
 * - 记录和查询测速历史
 * - 支持自定义提示词的功能测试
 */

import { getGeminiClientManager } from '../gemini/client-manager';
import { getDb } from '../../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * 测速结果接口
 */
export interface BenchmarkResult {
  id?: number;
  modelName: string;
  testPrompt: string;
  firstTokenTime: number | null; // ms
  totalResponseTime: number; // ms
  tokensGenerated: number | null;
  tokensPerSecond: number | null;
  success: boolean;
  errorMessage: string | null;
  timestamp?: string;
}

/**
 * 测速选项接口
 */
export interface BenchmarkOptions {
  prompt?: string; // 自定义测试提示词
  iterations?: number; // 测试次数（暂不实现多次迭代）
  warmup?: boolean; // 是否预热（暂不实现）
}

/**
 * 对比报告接口
 */
export interface BenchmarkComparison {
  models: string[];
  results: BenchmarkResult[];
  statistics: {
    [modelName: string]: {
      avgResponseTime: number;
      avgTokensPerSecond: number;
      successRate: number;
      totalTests: number;
    };
  };
}

/**
 * 功能测试选项接口
 */
export interface FunctionTestOptions {
  modelName: string;
  testType: 'text' | 'vision' | 'image-gen';
  prompt: string;
  imageData?: string; // Base64 编码的图像数据（用于 vision 测试）
  imageMimeType?: string; // 图像 MIME 类型
}

/**
 * 功能测试结果接口
 */
export interface FunctionTestResult {
  success: boolean;
  modelName: string;
  testType: string;
  prompt: string;
  responseTime: number;
  result: any; // 生成的内容
  metadata: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    finishReason?: string;
  };
  errorMessage?: string;
}

/**
 * BenchmarkService 类
 */
export class BenchmarkService {
  private clientManager = getGeminiClientManager();
  private async getDatabase() {
    return await getDb();
  }

  /**
   * 测试单个模型的性能
   * @param modelName - 模型名称
   * @param options - 测速选项
   * @returns 测速结果
   */
  async benchmarkModel(
    modelName: string,
    options: BenchmarkOptions = {}
  ): Promise<BenchmarkResult> {
    const testPrompt = options.prompt || 'Hello, how are you?';
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokensGenerated: number | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      // 获取 Gemini 客户端
      const client = this.clientManager.getClient();
      
      // 使用流式响应以捕获首 token 时间
      const result = await client.models.generateContentStream({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: testPrompt }] }],
      });

      let isFirstChunk = true;
      let fullText = '';
      let finalResponse: any;

      for await (const chunk of result) {
        if (isFirstChunk) {
          firstTokenTime = Date.now() - startTime;
          isFirstChunk = false;
        }
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
        fullText += chunkText;
        finalResponse = chunk;
      }

      // 获取最终响应和 token 使用量
      const response = finalResponse;
      const usageMetadata = response.usageMetadata;

      if (usageMetadata) {
        tokensGenerated = usageMetadata.candidatesTokenCount || null;
      }

      success = true;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      success = false;
    }

    const totalResponseTime = Date.now() - startTime;
    const tokensPerSecond =
      tokensGenerated && totalResponseTime > 0
        ? (tokensGenerated / (totalResponseTime / 1000))
        : null;

    const result: BenchmarkResult = {
      modelName,
      testPrompt,
      firstTokenTime,
      totalResponseTime,
      tokensGenerated,
      tokensPerSecond,
      success,
      errorMessage,
    };

    // 保存测速结果到数据库
    await this.saveBenchmarkResult(result);

    return result;
  }

  /**
   * 批量测试多个模型
   * @param modelNames - 模型名称列表
   * @param options - 测速选项
   * @returns 测速结果列表
   */
  async benchmarkMultipleModels(
    modelNames: string[],
    options: BenchmarkOptions = {}
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    const maxConcurrent = 3;

    // 将模型列表分成每组最多 3 个
    const chunks = this.chunkArray(modelNames, maxConcurrent);

    for (const chunk of chunks) {
      // 并发测试当前组的模型
      const chunkResults = await Promise.all(
        chunk.map((modelName) => this.benchmarkModel(modelName, options))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * 获取测速历史记录
   * @param modelName - 模型名称（可选，用于过滤）
   * @param limit - 返回记录数量限制
   * @returns 测速历史记录
   */
  async getBenchmarkHistory(
    modelName?: string,
    limit: number = 50
  ): Promise<BenchmarkResult[]> {
    let query = 'SELECT * FROM gemini_benchmarks';
    const params: any[] = [];

    if (modelName) {
      query += ' WHERE model_name = ?';
      params.push(modelName);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const db = await this.getDatabase();
    const rows: any = await db.all(query, params);

    return rows.map((row: any) => ({
      id: row.id,
      modelName: row.model_name,
      testPrompt: row.test_prompt,
      firstTokenTime: row.first_token_time,
      totalResponseTime: row.total_response_time,
      tokensGenerated: row.tokens_generated,
      tokensPerSecond: row.tokens_per_second,
      success: row.success === 1,
      errorMessage: row.error_message,
      timestamp: row.timestamp,
    }));
  }

  /**
   * 生成模型对比报告
   * @param modelNames - 要对比的模型名称列表
   * @returns 对比报告
   */
  async compareBenchmarks(modelNames: string[]): Promise<BenchmarkComparison> {
    const results: BenchmarkResult[] = [];
    const statistics: BenchmarkComparison['statistics'] = {};

    // 获取每个模型的历史记录
    for (const modelName of modelNames) {
      const history = await this.getBenchmarkHistory(modelName, 10);
      results.push(...history);

      // 计算统计数据
      const modelResults = history.filter((r) => r.modelName === modelName);
      const successfulResults = modelResults.filter((r) => r.success);

      if (modelResults.length > 0) {
        const avgResponseTime =
          successfulResults.reduce((sum, r) => sum + r.totalResponseTime, 0) /
          (successfulResults.length || 1);

        const avgTokensPerSecond =
          successfulResults
            .filter((r) => r.tokensPerSecond !== null)
            .reduce((sum, r) => sum + (r.tokensPerSecond || 0), 0) /
          (successfulResults.filter((r) => r.tokensPerSecond !== null).length || 1);

        const successRate = successfulResults.length / modelResults.length;

        statistics[modelName] = {
          avgResponseTime,
          avgTokensPerSecond,
          successRate,
          totalTests: modelResults.length,
        };
      }
    }

    return {
      models: modelNames,
      results,
      statistics,
    };
  }

  /**
   * 测试模型功能
   * @param options - 功能测试选项
   * @returns 功能测试结果
   */
  async testModelFunction(
    options: FunctionTestOptions
  ): Promise<FunctionTestResult> {
    const { modelName, testType, prompt, imageData, imageMimeType } = options;
    const startTime = Date.now();

    try {
      const client = this.clientManager.getClient();

      let result: any;
      let responseData: any;

      switch (testType) {
        case 'text':
          // 文本生成测试
          result = await client.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          responseData = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;

        case 'vision':
          // 图像分析测试
          if (!imageData || !imageMimeType) {
            throw new Error('图像分析测试需要提供 imageData 和 imageMimeType');
          }

          result = await client.models.generateContent({
            model: modelName,
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inlineData: { data: imageData, mimeType: imageMimeType } },
              ],
            }],
          });
          responseData = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          break;

        case 'image-gen':
          // 图像生成测试
          result = await client.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          responseData = result.response;
          break;

        default:
          throw new Error(`不支持的测试类型: ${testType}`);
      }

      const responseTime = Date.now() - startTime;
      const usageMetadata = result.response.usageMetadata;

      return {
        success: true,
        modelName,
        testType,
        prompt,
        responseTime,
        result: responseData,
        metadata: {
          promptTokens: usageMetadata?.promptTokenCount,
          completionTokens: usageMetadata?.candidatesTokenCount,
          totalTokens: usageMetadata?.totalTokenCount,
          finishReason: result.response.candidates?.[0]?.finishReason,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        modelName,
        testType,
        prompt,
        responseTime,
        result: null,
        metadata: {},
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 保存测速结果到数据库
   * @param result - 测速结果
   */
  private async saveBenchmarkResult(result: BenchmarkResult): Promise<void> {
    const query = `
      INSERT INTO gemini_benchmarks (
        model_name, test_prompt, first_token_time, total_response_time,
        tokens_generated, tokens_per_second, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const db = await this.getDatabase();
    await db.run(query, [
      result.modelName,
      result.testPrompt,
      result.firstTokenTime,
      result.totalResponseTime,
      result.tokensGenerated,
      result.tokensPerSecond,
      result.success ? 1 : 0,
      result.errorMessage,
    ]);
  }

  /**
   * 将数组分成指定大小的块
   * @param array - 原始数组
   * @param size - 每块的大小
   * @returns 分块后的数组
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// 导出单例实例
let benchmarkServiceInstance: BenchmarkService | null = null;

export function getBenchmarkService(): BenchmarkService {
  if (!benchmarkServiceInstance) {
    benchmarkServiceInstance = new BenchmarkService();
  }
  return benchmarkServiceInstance;
}
