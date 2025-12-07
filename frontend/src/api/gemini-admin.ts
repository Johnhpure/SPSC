/**
 * Gemini 管理后台 API 客户端
 * 封装所有管理后台相关的 API 调用
 */
import axios, { AxiosError } from 'axios';

// 创建专门用于 Gemini 管理后台的 axios 实例
const geminiAdminClient = axios.create({
    baseURL: '/api/gemini-admin',
    timeout: 30000,
    withCredentials: true  // 允许携带 Cookie
});

// 请求拦截器：添加认证信息
geminiAdminClient.interceptors.request.use(
    (config) => {
        // 可以在这里添加额外的请求头
        // 例如：config.headers['X-Admin-Token'] = getAdminToken();
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 响应拦截器：统一处理错误
geminiAdminClient.interceptors.response.use(
    (response) => {
        // 检查响应数据中的 success 字段
        if (response.data && response.data.success === false) {
            // 将业务错误转换为异常
            const error: any = new Error(response.data.error?.message || '请求失败');
            error.code = response.data.error?.code;
            error.details = response.data.error?.details;
            error.response = response;
            return Promise.reject(error);
        }
        return response;
    },
    (error: AxiosError) => {
        // 网络错误或 HTTP 错误
        console.error('Gemini Admin API Error:', error);
        
        // 处理特定的 HTTP 状态码
        if (error.response) {
            const status = error.response.status;
            const data: any = error.response.data;
            
            if (status === 401) {
                // 未认证，重定向到登录页
                console.error('未认证，请先登录');
                localStorage.removeItem('isLoggedIn');
                window.location.href = '/login';
            } else if (status === 403) {
                // 权限不足
                console.error('权限不足');
            } else if (status === 404) {
                console.error('请求的资源不存在');
            } else if (status >= 500) {
                console.error('服务器错误');
            }
            
            // 如果响应包含错误信息，使用它
            if (data && data.error) {
                const apiError: any = new Error(data.error.message || '请求失败');
                apiError.code = data.error.code;
                apiError.details = data.error.details;
                return Promise.reject(apiError);
            }
        }
        
        return Promise.reject(error);
    }
);

// ==================== 类型定义 ====================

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

export interface ApiKey {
    id: number;
    name: string;
    keyValue: string;  // 脱敏后的密钥
    isActive: boolean;
    priority: number;
    usageCount: number;
    successCount: number;
    failureCount: number;
    lastUsedAt: string | null;
    createdAt: string;
}

export interface CallLog {
    id: number;
    requestId: string;
    timestamp: string;
    service: string;
    method: string;
    modelName: string;
    apiKeyId: number;
    requestParams: string;
    responseStatus: 'success' | 'error';
    responseTime: number;
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    responseData: string | null;
    errorType: string | null;
    errorMessage: string | null;
    userId: string | null;
}

export interface BenchmarkResult {
    id: number;
    modelName: string;
    testPrompt: string;
    firstTokenTime: number | null;
    totalResponseTime: number;
    tokensGenerated: number | null;
    tokensPerSecond: number | null;
    success: boolean;
    errorMessage: string | null;
    timestamp: string;
}

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
}

export interface ModelInfo {
    name: string;
    displayName: string;
    description: string;
    supportedGenerationMethods: string[];
}

// ==================== 配置管理 API ====================

/**
 * 获取当前配置
 */
export async function getConfig(): Promise<GeminiConfig> {
    const response = await geminiAdminClient.get('/config');
    return response.data.data;
}

/**
 * 更新配置
 */
export async function updateConfig(config: Partial<GeminiConfig>): Promise<GeminiConfig> {
    const response = await geminiAdminClient.put('/config', config);
    return response.data.data;
}

/**
 * 验证 URL 格式
 */
export async function validateUrl(url: string): Promise<boolean> {
    const response = await geminiAdminClient.post('/config/validate-url', { url });
    return response.data.data.valid;
}

/**
 * 获取模型列表
 */
export async function getModelList(): Promise<ModelInfo[]> {
    const response = await geminiAdminClient.get('/models');
    return response.data.data;
}

/**
 * 导出配置
 */
export async function exportConfig(): Promise<Blob> {
    const response = await geminiAdminClient.post('/config/export', {}, {
        responseType: 'blob'
    });
    return response.data;
}

/**
 * 导入配置
 */
export async function importConfig(configJson: string): Promise<void> {
    await geminiAdminClient.post('/config/import', { config: configJson });
}

// ==================== 密钥管理 API ====================

/**
 * 获取密钥列表
 */
export async function listKeys(): Promise<ApiKey[]> {
    const response = await geminiAdminClient.get('/keys');
    return response.data.data;
}

/**
 * 添加单个密钥
 */
export async function addKey(name: string, keyValue: string, priority?: number): Promise<ApiKey> {
    const response = await geminiAdminClient.post('/keys', { name, keyValue, priority });
    return response.data.data;
}

/**
 * 批量添加密钥
 */
export async function addMultipleKeys(keys: Array<{ name: string; keyValue: string }>): Promise<ApiKey[]> {
    const response = await geminiAdminClient.post('/keys/batch', { keys });
    return response.data.data;
}

/**
 * 更新密钥
 */
export async function updateKey(id: number, updates: Partial<ApiKey>): Promise<ApiKey> {
    const response = await geminiAdminClient.put(`/keys/${id}`, updates);
    return response.data.data;
}

/**
 * 删除密钥
 */
export async function deleteKey(id: number): Promise<void> {
    await geminiAdminClient.delete(`/keys/${id}`);
}

/**
 * 切换密钥状态
 */
export async function toggleKeyStatus(id: number, isActive: boolean): Promise<ApiKey> {
    const response = await geminiAdminClient.patch(`/keys/${id}/toggle`, { isActive });
    return response.data.data;
}

// ==================== 日志查询 API ====================

export interface LogQuery {
    startDate?: string;
    endDate?: string;
    modelName?: string;
    service?: string;
    status?: 'success' | 'error';
    keyword?: string;
    page?: number;
    pageSize?: number;
}

export interface LogQueryResult {
    logs: CallLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/**
 * 查询日志
 */
export async function queryLogs(query: LogQuery): Promise<LogQueryResult> {
    const response = await geminiAdminClient.get('/logs', { params: query });
    return response.data.data;
}

/**
 * 获取日志详情
 */
export async function getLogDetail(requestId: string): Promise<CallLog> {
    const response = await geminiAdminClient.get(`/logs/${requestId}`);
    return response.data.data;
}

/**
 * 导出日志
 */
export async function exportLogs(query: LogQuery, format: 'json' | 'csv' | 'excel'): Promise<Blob> {
    const response = await geminiAdminClient.post('/logs/export', 
        { ...query, format },
        { responseType: 'blob' }
    );
    return response.data;
}

// ==================== 测速 API ====================

export interface BenchmarkOptions {
    prompt?: string;
    iterations?: number;
    warmup?: boolean;
}

/**
 * 测试单个模型
 */
export async function benchmarkModel(modelName: string, options?: BenchmarkOptions): Promise<BenchmarkResult> {
    const response = await geminiAdminClient.post('/benchmark', { modelName, ...options });
    return response.data.data;
}

/**
 * 批量测试模型
 */
export async function benchmarkMultipleModels(modelNames: string[], options?: BenchmarkOptions): Promise<BenchmarkResult[]> {
    const response = await geminiAdminClient.post('/benchmark/batch', { modelNames, ...options });
    return response.data.data;
}

/**
 * 获取测速历史
 */
export async function getBenchmarkHistory(modelName?: string, limit?: number): Promise<BenchmarkResult[]> {
    const response = await geminiAdminClient.get('/benchmark/history', {
        params: { modelName, limit }
    });
    return response.data.data;
}

/**
 * 功能测试
 */
export async function testModel(modelName: string, prompt: string, options?: any): Promise<any> {
    const response = await geminiAdminClient.post('/test', { modelName, prompt, ...options });
    return response.data.data;
}

// ==================== 统计 API ====================

export interface StatisticsQuery {
    startDate?: string;
    endDate?: string;
    modelName?: string;
    service?: string;
    status?: 'success' | 'error';
}

export interface TimeSeriesData {
    labels: string[];
    values: number[];
}

export interface ModelDistribution {
    labels: string[];
    values: number[];
}

export interface CostAnalysis {
    totalTokens: number;
    estimatedCost: number;
    breakdown: Record<string, { tokens: number; cost: number }>;
}

/**
 * 获取统计数据
 */
export async function getStatistics(query?: StatisticsQuery): Promise<Statistics> {
    const response = await geminiAdminClient.get('/statistics', { params: query });
    return response.data.data;
}

/**
 * 获取时间序列数据
 */
export async function getTimeSeriesData(query: StatisticsQuery, granularity: 'hour' | 'day' | 'week'): Promise<TimeSeriesData> {
    const response = await geminiAdminClient.get('/statistics/timeseries', {
        params: { ...query, granularity }
    });
    return response.data.data;
}

/**
 * 获取模型使用分布
 */
export async function getModelUsageDistribution(query?: StatisticsQuery): Promise<ModelDistribution> {
    const response = await geminiAdminClient.get('/statistics/distribution', { params: query });
    return response.data.data;
}

/**
 * 获取成本分析
 */
export async function getCostAnalysis(query?: StatisticsQuery): Promise<CostAnalysis> {
    const response = await geminiAdminClient.get('/statistics/cost', { params: query });
    return response.data.data;
}
