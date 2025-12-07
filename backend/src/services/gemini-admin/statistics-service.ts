import { Database } from 'sqlite';

/**
 * 统计查询条件接口
 */
export interface StatisticsQuery {
  startDate?: string;
  endDate?: string;
  modelName?: string;
  service?: string;
  status?: 'success' | 'error';
}

/**
 * 统计数据接口
 */
export interface Statistics {
  totalCalls: number;
  successRate: number;
  failureRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalTokensUsed: number;
  estimatedCost: number;
  callsByModel: Record<string, number>;
  callsByService: Record<string, number>;
  callsByHour: Array<{ hour: string; count: number }>;
  callsByDay: Array<{ day: string; count: number }>;
}

/**
 * 时间序列数据点接口
 */
export interface TimeSeriesDataPoint {
  timestamp: string;
  count: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
}

/**
 * 时间序列数据接口
 */
export interface TimeSeriesData {
  granularity: 'hour' | 'day' | 'week';
  dataPoints: TimeSeriesDataPoint[];
}

/**
 * 模型使用分布接口
 */
export interface ModelDistribution {
  modelName: string;
  callCount: number;
  percentage: number;
  successRate: number;
}

/**
 * 成本分析接口
 */
export interface CostAnalysis {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  costByModel: Array<{
    modelName: string;
    promptTokens: number;
    completionTokens: number;
    cost: number;
  }>;
}

/**
 * Gemini API 定价模型（每百万 token 的价格，单位：美元）
 * 参考：https://ai.google.dev/pricing
 */
const PRICING_MODEL: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-pro': { input: 0.50, output: 1.50 },
  'default': { input: 0.50, output: 1.50 }, // 默认定价
};

/**
 * 统计分析服务类
 * 负责聚合和计算 Gemini API 调用的统计数据
 */
export class StatisticsService {
  constructor(private db: any) {}

  /**
   * 获取综合统计数据
   * @param query 查询条件
   * @returns 统计数据
   */
  async getStatistics(query?: StatisticsQuery): Promise<Statistics> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    // 计算基本统计
    const basicStats = await this.db.get(
      `
      SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN response_status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN response_status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(response_time) as avg_response_time,
        SUM(COALESCE(total_tokens, 0)) as total_tokens
      FROM gemini_call_logs
      ${whereClause}
    `,
      params
    );

    const totalCalls = basicStats?.total_calls || 0;
    const successCount = basicStats?.success_count || 0;
    const errorCount = basicStats?.error_count || 0;

    // 计算百分位数
    const p95ResponseTime = await this.calculatePercentile(95, query);
    const p99ResponseTime = await this.calculatePercentile(99, query);

    // 计算成本
    const costAnalysis = await this.getCostAnalysis(query);

    // 按模型统计
    const callsByModel = await this.getCallsByModel(query);

    // 按服务统计
    const callsByService = await this.getCallsByService(query);

    // 按小时统计
    const callsByHour = await this.getCallsByHour(query);

    // 按天统计
    const callsByDay = await this.getCallsByDay(query);

    return {
      totalCalls,
      successRate: totalCalls > 0 ? (successCount / totalCalls) * 100 : 0,
      failureRate: totalCalls > 0 ? (errorCount / totalCalls) * 100 : 0,
      averageResponseTime: basicStats?.avg_response_time || 0,
      p95ResponseTime,
      p99ResponseTime,
      totalTokensUsed: basicStats?.total_tokens || 0,
      estimatedCost: costAnalysis.estimatedCost,
      callsByModel,
      callsByService,
      callsByHour,
      callsByDay,
    };
  }

  /**
   * 计算指定百分位数的响应时间
   * @param percentile 百分位数（如 95 表示 P95）
   * @param query 查询条件
   * @returns 百分位数值
   */
  private async calculatePercentile(
    percentile: number,
    query?: StatisticsQuery
  ): Promise<number> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    // 获取总记录数
    const countResult = await this.db.get(
      `SELECT COUNT(*) as count FROM gemini_call_logs ${whereClause}`,
      params
    );

    const totalCount = countResult?.count || 0;
    if (totalCount === 0) return 0;

    // 计算位置（向上取整）
    const position = Math.ceil((percentile / 100) * totalCount) - 1;

    // 使用 ORDER BY + LIMIT + OFFSET 获取百分位数值
    const result = await this.db.get(
      `
      SELECT response_time 
      FROM gemini_call_logs 
      ${whereClause}
      ORDER BY response_time ASC
      LIMIT 1 OFFSET ?
    `,
      [...params, position]
    );

    return result?.response_time || 0;
  }

  /**
   * 按模型统计调用次数
   */
  private async getCallsByModel(
    query?: StatisticsQuery
  ): Promise<Record<string, number>> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    const results = await this.db.all(
      `
      SELECT model_name, COUNT(*) as count
      FROM gemini_call_logs
      ${whereClause}
      GROUP BY model_name
      ORDER BY count DESC
    `,
      params
    );

    const callsByModel: Record<string, number> = {};
    results.forEach((row: any) => {
      callsByModel[row.model_name] = row.count;
    });

    return callsByModel;
  }

  /**
   * 按服务统计调用次数
   */
  private async getCallsByService(
    query?: StatisticsQuery
  ): Promise<Record<string, number>> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    const results = await this.db.all(
      `
      SELECT service, COUNT(*) as count
      FROM gemini_call_logs
      ${whereClause}
      GROUP BY service
      ORDER BY count DESC
    `,
      params
    );

    const callsByService: Record<string, number> = {};
    results.forEach((row: any) => {
      callsByService[row.service] = row.count;
    });

    return callsByService;
  }

  /**
   * 按小时统计调用次数
   */
  private async getCallsByHour(
    query?: StatisticsQuery
  ): Promise<Array<{ hour: string; count: number }>> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    const results = await this.db.all(
      `
      SELECT 
        strftime('%Y-%m-%d %H:00', timestamp) as hour,
        COUNT(*) as count
      FROM gemini_call_logs
      ${whereClause}
      GROUP BY hour
      ORDER BY hour DESC
      LIMIT 24
    `,
      params
    );

    return results;
  }

  /**
   * 按天统计调用次数
   */
  private async getCallsByDay(
    query?: StatisticsQuery
  ): Promise<Array<{ day: string; count: number }>> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    const results = await this.db.all(
      `
      SELECT 
        strftime('%Y-%m-%d', timestamp) as day,
        COUNT(*) as count
      FROM gemini_call_logs
      ${whereClause}
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `,
      params
    );

    return results;
  }

  /**
   * 获取时间序列数据
   * @param query 查询条件
   * @param granularity 时间粒度
   * @returns 时间序列数据
   */
  async getTimeSeriesData(
    query: StatisticsQuery,
    granularity: 'hour' | 'day' | 'week'
  ): Promise<TimeSeriesData> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    let timeFormat: string;
    let limit: number;

    switch (granularity) {
      case 'hour':
        timeFormat = '%Y-%m-%d %H:00';
        limit = 24;
        break;
      case 'day':
        timeFormat = '%Y-%m-%d';
        limit = 30;
        break;
      case 'week':
        timeFormat = '%Y-W%W';
        limit = 12;
        break;
    }

    const results = await this.db.all(
      `
      SELECT 
        strftime('${timeFormat}', timestamp) as timestamp,
        COUNT(*) as count,
        SUM(CASE WHEN response_status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN response_status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(response_time) as avg_response_time
      FROM gemini_call_logs
      ${whereClause}
      GROUP BY timestamp
      ORDER BY timestamp DESC
      LIMIT ?
    `,
      [...params, limit]
    );

    const dataPoints: TimeSeriesDataPoint[] = results.map((row: any) => ({
      timestamp: row.timestamp,
      count: row.count,
      successCount: row.success_count,
      errorCount: row.error_count,
      avgResponseTime: row.avg_response_time || 0,
    }));

    return {
      granularity,
      dataPoints: dataPoints.reverse(), // 反转以按时间正序排列
    };
  }

  /**
   * 获取模型使用分布
   * @param query 查询条件
   * @returns 模型分布数据
   */
  async getModelUsageDistribution(
    query?: StatisticsQuery
  ): Promise<ModelDistribution[]> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    // 获取总调用次数
    const totalResult = await this.db.get(
      `SELECT COUNT(*) as total FROM gemini_call_logs ${whereClause}`,
      params
    );
    const totalCalls = totalResult?.total || 0;

    if (totalCalls === 0) return [];

    // 按模型统计
    const results = await this.db.all(
      `
      SELECT 
        model_name,
        COUNT(*) as call_count,
        SUM(CASE WHEN response_status = 'success' THEN 1 ELSE 0 END) as success_count
      FROM gemini_call_logs
      ${whereClause}
      GROUP BY model_name
      ORDER BY call_count DESC
    `,
      params
    );

    return results.map((row: any) => ({
      modelName: row.model_name,
      callCount: row.call_count,
      percentage: (row.call_count / totalCalls) * 100,
      successRate: row.call_count > 0 ? (row.success_count / row.call_count) * 100 : 0,
    }));
  }

  /**
   * 获取成本分析
   * @param query 查询条件
   * @returns 成本分析数据
   */
  async getCostAnalysis(query?: StatisticsQuery): Promise<CostAnalysis> {
    const whereClause = this.buildWhereClause(query);
    const params = this.buildQueryParams(query);

    // 总体 token 使用量
    const totalResult = await this.db.get(
      `
      SELECT 
        SUM(COALESCE(prompt_tokens, 0)) as total_prompt_tokens,
        SUM(COALESCE(completion_tokens, 0)) as total_completion_tokens,
        SUM(COALESCE(total_tokens, 0)) as total_tokens
      FROM gemini_call_logs
      ${whereClause}
    `,
      params
    );

    // 按模型统计 token 使用量
    const modelResults = await this.db.all(
      `
      SELECT 
        model_name,
        SUM(COALESCE(prompt_tokens, 0)) as prompt_tokens,
        SUM(COALESCE(completion_tokens, 0)) as completion_tokens
      FROM gemini_call_logs
      ${whereClause}
      GROUP BY model_name
    `,
      params
    );

    // 计算每个模型的成本
    const costByModel = modelResults.map((row: any) => {
      const pricing = PRICING_MODEL[row.model_name] || PRICING_MODEL['default'];
      if (!pricing) {
        return {
          modelName: row.model_name,
          promptTokens: row.prompt_tokens,
          completionTokens: row.completion_tokens,
          cost: 0,
        };
      }
      const promptCost = (row.prompt_tokens / 1_000_000) * pricing.input;
      const completionCost = (row.completion_tokens / 1_000_000) * pricing.output;
      const totalCost = promptCost + completionCost;

      return {
        modelName: row.model_name,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        cost: totalCost,
      };
    });

    // 计算总成本
    const estimatedCost = costByModel.reduce((sum: any, item: any) => sum + item.cost, 0);

    return {
      totalPromptTokens: totalResult?.total_prompt_tokens || 0,
      totalCompletionTokens: totalResult?.total_completion_tokens || 0,
      totalTokens: totalResult?.total_tokens || 0,
      estimatedCost,
      costByModel,
    };
  }

  /**
   * 构建 WHERE 子句
   */
  private buildWhereClause(query?: StatisticsQuery): string {
    if (!query) return '';

    const conditions: string[] = [];

    if (query.startDate) {
      conditions.push('timestamp >= ?');
    }
    if (query.endDate) {
      conditions.push('timestamp <= ?');
    }
    if (query.modelName) {
      conditions.push('model_name = ?');
    }
    if (query.service) {
      conditions.push('service = ?');
    }
    if (query.status) {
      conditions.push('response_status = ?');
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  }

  /**
   * 构建查询参数数组
   */
  private buildQueryParams(query?: StatisticsQuery): any[] {
    if (!query) return [];

    const params: any[] = [];

    if (query.startDate) params.push(query.startDate);
    if (query.endDate) params.push(query.endDate);
    if (query.modelName) params.push(query.modelName);
    if (query.service) params.push(query.service);
    if (query.status) params.push(query.status);

    return params;
  }
}

/**
 * 获取统计服务单例
 */
let statisticsServiceInstance: StatisticsService | null = null;

export function getStatisticsService(): StatisticsService {
  if (!statisticsServiceInstance) {
    const { getDatabase } = require('../gemini/database');
    statisticsServiceInstance = new StatisticsService(getDatabase());
  }
  return statisticsServiceInstance;
}




