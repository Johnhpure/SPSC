import { Database } from 'sqlite';

/**
 * 日志查询条件接口
 */
export interface LogQuery {
  startDate?: string;
  endDate?: string;
  modelName?: string;
  service?: string;
  status?: 'success' | 'error';
  keyword?: string; // 全文搜索
  page?: number;
  pageSize?: number;
}

/**
 * 日志查询结果接口
 */
export interface LogQueryResult {
  logs: CallLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 调用日志接口
 */
export interface CallLog {
  id: number;
  requestId: string;
  timestamp: string;
  service: string;
  method: string;
  modelName: string;
  apiKeyId: number | null;
  requestParams: string | null;
  responseStatus: 'success' | 'error';
  responseTime: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  responseData: string | null;
  errorType: string | null;
  errorMessage: string | null;
  userId: string | null;
}

/**
 * 日志查询服务
 * 负责查询、过滤和导出调用日志
 */
export class LogQueryService {
  constructor(private db: any) {}

  /**
   * 查询日志（支持多维度过滤和分页）
   * @param query 查询条件
   * @returns 分页的日志查询结果
   */
  async queryLogs(query: LogQuery = {}): Promise<LogQueryResult> {
    const {
      startDate,
      endDate,
      modelName,
      service,
      status,
      keyword,
      page = 1,
      pageSize = 20
    } = query;

    // 构建 WHERE 子句
    const conditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      conditions.push('timestamp >= ?');
      params.push(startDate);
    }

    if (endDate) {
      conditions.push('timestamp <= ?');
      params.push(endDate);
    }

    if (modelName) {
      conditions.push('model_name = ?');
      params.push(modelName);
    }

    if (service) {
      conditions.push('service = ?');
      params.push(service);
    }

    if (status) {
      conditions.push('response_status = ?');
      params.push(status);
    }

    // 全文搜索：在 request_params 和 response_data 中搜索关键词
    if (keyword) {
      conditions.push('(request_params LIKE ? OR response_data LIKE ?)');
      const searchPattern = `%${keyword}%`;
      params.push(searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // 查询总数
    const countSql = `SELECT COUNT(*) as total FROM gemini_call_logs ${whereClause}`;
    const countResult = await this.db.get(countSql, params);
    const total = countResult?.total || 0;

    // 计算分页
    const offset = (page - 1) * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    // 查询日志数据
    const dataSql = `
      SELECT 
        id,
        request_id as requestId,
        timestamp,
        service,
        method,
        model_name as modelName,
        api_key_id as apiKeyId,
        request_params as requestParams,
        response_status as responseStatus,
        response_time as responseTime,
        prompt_tokens as promptTokens,
        completion_tokens as completionTokens,
        total_tokens as totalTokens,
        response_data as responseData,
        error_type as errorType,
        error_message as errorMessage,
        user_id as userId
      FROM gemini_call_logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const logs = await this.db.all(dataSql, [...params, pageSize, offset]);

    return {
      logs: logs || [],
      total,
      page,
      pageSize,
      totalPages
    };
  }

  /**
   * 获取日志详情
   * @param requestId 请求唯一标识符
   * @returns 完整的日志信息
   */
  async getLogDetail(requestId: string): Promise<CallLog | null> {
    const sql = `
      SELECT 
        id,
        request_id as requestId,
        timestamp,
        service,
        method,
        model_name as modelName,
        api_key_id as apiKeyId,
        request_params as requestParams,
        response_status as responseStatus,
        response_time as responseTime,
        prompt_tokens as promptTokens,
        completion_tokens as completionTokens,
        total_tokens as totalTokens,
        response_data as responseData,
        error_type as errorType,
        error_message as errorMessage,
        user_id as userId
      FROM gemini_call_logs
      WHERE request_id = ?
    `;

    const log = await this.db.get(sql, [requestId]);
    return log || null;
  }

  /**
   * 导出日志
   * @param query 查询条件
   * @param format 导出格式
   * @returns 导出文件路径
   */
  async exportLogs(
    query: LogQuery,
    format: 'json' | 'csv' | 'excel'
  ): Promise<string> {
    // 获取所有匹配的日志（不分页）
    const allLogsQuery = { ...query, page: 1, pageSize: 999999 };
    const result = await this.queryLogs(allLogsQuery);
    const logs = result.logs;

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gemini_logs_${timestamp}`;

    switch (format) {
      case 'json':
        return await this.exportToJson(logs, filename);
      case 'csv':
        return await this.exportToCsv(logs, filename);
      case 'excel':
        return await this.exportToExcel(logs, filename);
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 导出为 JSON 格式
   */
  private async exportToJson(logs: CallLog[], filename: string): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    
    const exportDir = path.resolve(__dirname, '../../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    const filepath = path.join(exportDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(logs, null, 2), 'utf-8');
    
    return filepath;
  }

  /**
   * 导出为 CSV 格式
   */
  private async exportToCsv(logs: CallLog[], filename: string): Promise<string> {
    const fs = require('fs').promises;
    const path = require('path');
    
    const exportDir = path.resolve(__dirname, '../../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    const filepath = path.join(exportDir, `${filename}.csv`);
    
    // CSV 表头
    const headers = [
      'ID',
      'Request ID',
      'Timestamp',
      'Service',
      'Method',
      'Model Name',
      'API Key ID',
      'Response Status',
      'Response Time (ms)',
      'Prompt Tokens',
      'Completion Tokens',
      'Total Tokens',
      'Error Type',
      'Error Message',
      'User ID'
    ];
    
    // 构建 CSV 内容
    const rows = logs.map(log => [
      log.id,
      log.requestId,
      log.timestamp,
      log.service,
      log.method,
      log.modelName,
      log.apiKeyId || '',
      log.responseStatus,
      log.responseTime || '',
      log.promptTokens || '',
      log.completionTokens || '',
      log.totalTokens || '',
      log.errorType || '',
      log.errorMessage ? `"${log.errorMessage.replace(/"/g, '""')}"` : '',
      log.userId || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    await fs.writeFile(filepath, csvContent, 'utf-8');
    
    return filepath;
  }

  /**
   * 导出为 Excel 格式
   */
  private async exportToExcel(logs: CallLog[], filename: string): Promise<string> {
    const ExcelJS = require('exceljs');
    const path = require('path');
    const fs = require('fs').promises;
    
    const exportDir = path.resolve(__dirname, '../../../exports');
    await fs.mkdir(exportDir, { recursive: true });
    
    const filepath = path.join(exportDir, `${filename}.xlsx`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Gemini Call Logs');
    
    // 定义列
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Request ID', key: 'requestId', width: 40 },
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Service', key: 'service', width: 15 },
      { header: 'Method', key: 'method', width: 20 },
      { header: 'Model Name', key: 'modelName', width: 25 },
      { header: 'API Key ID', key: 'apiKeyId', width: 12 },
      { header: 'Response Status', key: 'responseStatus', width: 15 },
      { header: 'Response Time (ms)', key: 'responseTime', width: 18 },
      { header: 'Prompt Tokens', key: 'promptTokens', width: 15 },
      { header: 'Completion Tokens', key: 'completionTokens', width: 18 },
      { header: 'Total Tokens', key: 'totalTokens', width: 15 },
      { header: 'Error Type', key: 'errorType', width: 20 },
      { header: 'Error Message', key: 'errorMessage', width: 40 },
      { header: 'User ID', key: 'userId', width: 20 }
    ];
    
    // 添加数据行
    logs.forEach(log => {
      worksheet.addRow({
        id: log.id,
        requestId: log.requestId,
        timestamp: log.timestamp,
        service: log.service,
        method: log.method,
        modelName: log.modelName,
        apiKeyId: log.apiKeyId,
        responseStatus: log.responseStatus,
        responseTime: log.responseTime,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        totalTokens: log.totalTokens,
        errorType: log.errorType,
        errorMessage: log.errorMessage,
        userId: log.userId
      });
    });
    
    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    await workbook.xlsx.writeFile(filepath);
    
    return filepath;
  }

  /**
   * 删除旧日志
   * @param beforeDate 删除此日期之前的日志
   * @returns 删除的日志数量
   */
  async deleteOldLogs(beforeDate: string): Promise<number> {
    const sql = 'DELETE FROM gemini_call_logs WHERE timestamp < ?';
    const result = await this.db.run(sql, [beforeDate]);
    return result.changes || 0;
  }
}

/**
 * 导出单例实例
 */
import { getDb } from '../../db';

let logQueryServiceInstance: LogQueryService | null = null;

export async function getLogQueryService(): Promise<LogQueryService> {
  if (!logQueryServiceInstance) {
    const db = await getDb();
    logQueryServiceInstance = new LogQueryService(db);
  }
  return logQueryServiceInstance;
}
