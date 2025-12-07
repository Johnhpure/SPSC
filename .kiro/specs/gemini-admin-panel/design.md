# Gemini API 管理后台设计文档

## 概述

本设计文档详细说明了 Gemini API 管理后台的架构、组件和实现方案。该管理后台为系统管理员提供一个集中化的 Web 界面，用于管理 Gemini API 配置、监控 API 使用情况、测试模型性能，并查看完整的调用日志。

### 核心目标

1. 提供直观的 Web 界面管理 API 配置
2. 支持多 API Key 管理和负载均衡
3. 实现模型性能测试和对比
4. 记录和查询所有 API 调用日志
5. 提供统计分析和可视化功能
6. 确保配置和日志数据的安全性

## 架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   Vue 3 Frontend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ 配置管理页面 │  │ 日志查看页面 │  │ 统计面板页面 │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST API
┌────────────────────▼────────────────────────────────────┐
│              Express Backend API Layer                   │
│  /api/gemini-admin/* (配置、密钥、日志、统计)           │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Service Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Config       │  │ Logging      │  │ Benchmark    │ │
│  │ Service      │  │ Interceptor  │  │ Service      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Data Layer (SQLite)                         │
│  gemini_configs | gemini_api_keys | gemini_call_logs    │
└──────────────────────────────────────────────────────────┘
```

### 模块划分

#### 后端模块

1. **AdminConfigService**: 管理 API 配置（Base URL、模型选择）
2. **AdminKeyService**: 管理 API Key（增删改查、轮询策略）
3. **LoggingInterceptor**: 拦截并记录所有 Gemini API 调用
4. **BenchmarkService**: 执行模型性能测试
5. **StatisticsService**: 聚合和计算统计数据
6. **ExportService**: 导出日志和配置数据

#### 前端模块

1. **ConfigManagement**: 配置管理页面组件
2. **KeyManagement**: API Key 管理页面组件
3. **ModelManagement**: 模型列表和选择组件
4. **BenchmarkTool**: 模型测速工具组件
5. **LogViewer**: 日志查看和过滤组件
6. **StatisticsDashboard**: 统计面板和图表组件

## 组件和接口

### 1. AdminConfigService

**职责**: 管理 Gemini API 的配置信息

```typescript
interface GeminiConfig {
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

class AdminConfigService {
  async getConfig(): Promise<GeminiConfig>;
  async updateConfig(config: Partial<GeminiConfig>): Promise<GeminiConfig>;
  async validateBaseUrl(url: string): Promise<boolean>;
  async fetchModelList(baseUrl: string, apiKey: string): Promise<ModelInfo[]>;
  async exportConfig(): Promise<string>; // JSON string
  async importConfig(configJson: string): Promise<void>;
}
```

**关键方法**:
- `getConfig()`: 获取当前配置
- `updateConfig()`: 更新配置并触发客户端重新初始化
- `validateBaseUrl()`: 验证 URL 格式和可达性
- `fetchModelList()`: 从 API 获取可用模型列表
- `exportConfig()` / `importConfig()`: 配置备份和恢复

### 2. AdminKeyService

**职责**: 管理多个 API Key 及其使用策略

```typescript
interface ApiKey {
  id: number;
  name: string; // 备注名称
  keyValue: string; // 加密存储
  isActive: boolean;
  priority: number; // 优先级，数字越小优先级越高
  usageCount: number;
  successCount: number;
  failureCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

interface KeyRotationStrategy {
  type: 'round-robin' | 'priority' | 'random' | 'least-used';
}

class AdminKeyService {
  async listKeys(): Promise<ApiKey[]>;
  async addKey(name: string, keyValue: string, priority?: number): Promise<ApiKey>;
  async addMultipleKeys(keys: Array<{name: string, keyValue: string}>): Promise<ApiKey[]>;
  async updateKey(id: number, updates: Partial<ApiKey>): Promise<ApiKey>;
  async deleteKey(id: number): Promise<void>;
  async toggleKeyStatus(id: number, isActive: boolean): Promise<ApiKey>;
  async getNextKey(strategy: KeyRotationStrategy): Promise<ApiKey>;
  async recordKeyUsage(id: number, success: boolean): Promise<void>;
  async maskKey(keyValue: string): string; // 脱敏显示
}
```

**关键方法**:
- `listKeys()`: 获取所有 API Key（脱敏显示）
- `addKey()` / `addMultipleKeys()`: 添加单个或多个密钥
- `getNextKey()`: 根据策略选择下一个可用密钥
- `recordKeyUsage()`: 记录密钥使用情况
- `maskKey()`: 密钥脱敏（如：sk-...abc123）

### 3. LoggingInterceptor

**职责**: 拦截所有 Gemini API 调用并记录日志

```typescript
interface CallLog {
  id: number;
  requestId: string; // UUID
  timestamp: string;
  service: string; // 'text' | 'image' | 'file' | 'stream'
  method: string; // 方法名
  modelName: string;
  apiKeyId: number;
  requestParams: string; // JSON string
  responseStatus: 'success' | 'error';
  responseTime: number; // ms
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  responseData: string | null; // JSON string or text summary
  errorType: string | null;
  errorMessage: string | null;
  userId: string | null; // 调用用户
}

class LoggingInterceptor {
  async logRequest(requestData: Partial<CallLog>): Promise<string>; // returns requestId
  async logResponse(requestId: string, responseData: Partial<CallLog>): Promise<void>;
  wrapService<T>(service: T): T; // 装饰器模式包装服务
}
```

**关键方法**:
- `logRequest()`: 记录请求开始，返回 requestId
- `logResponse()`: 记录请求完成和响应数据
- `wrapService()`: 使用装饰器模式包装现有服务，自动记录日志

### 4. BenchmarkService

**职责**: 执行模型性能测试

```typescript
interface BenchmarkResult {
  id: number;
  modelName: string;
  testPrompt: string;
  firstTokenTime: number; // ms
  totalResponseTime: number; // ms
  tokensGenerated: number;
  tokensPerSecond: number;
  success: boolean;
  errorMessage: string | null;
  timestamp: string;
}

interface BenchmarkOptions {
  prompt?: string; // 自定义测试提示词
  iterations?: number; // 测试次数
  warmup?: boolean; // 是否预热
}

class BenchmarkService {
  async benchmarkModel(modelName: string, options?: BenchmarkOptions): Promise<BenchmarkResult>;
  async benchmarkMultipleModels(modelNames: string[], options?: BenchmarkOptions): Promise<BenchmarkResult[]>;
  async getBenchmarkHistory(modelName?: string, limit?: number): Promise<BenchmarkResult[]>;
  async compareBenchmarks(modelNames: string[]): Promise<BenchmarkComparison>;
}
```

**关键方法**:
- `benchmarkModel()`: 测试单个模型性能
- `benchmarkMultipleModels()`: 批量测试多个模型
- `getBenchmarkHistory()`: 获取历史测速记录
- `compareBenchmarks()`: 生成模型对比报告

### 5. StatisticsService

**职责**: 聚合和计算统计数据

```typescript
interface Statistics {
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
  callsByHour: Array<{hour: string, count: number}>;
  callsByDay: Array<{day: string, count: number}>;
}

interface StatisticsQuery {
  startDate?: string;
  endDate?: string;
  modelName?: string;
  service?: string;
  status?: 'success' | 'error';
}

class StatisticsService {
  async getStatistics(query?: StatisticsQuery): Promise<Statistics>;
  async getTimeSeriesData(query: StatisticsQuery, granularity: 'hour' | 'day' | 'week'): Promise<TimeSeriesData>;
  async getModelUsageDistribution(query?: StatisticsQuery): Promise<ModelDistribution>;
  async getCostAnalysis(query?: StatisticsQuery): Promise<CostAnalysis>;
}
```

**关键方法**:
- `getStatistics()`: 获取综合统计数据
- `getTimeSeriesData()`: 获取时间序列数据（用于趋势图）
- `getModelUsageDistribution()`: 获取模型使用分布（用于饼图）
- `getCostAnalysis()`: 分析 token 使用和成本

### 6. LogQueryService

**职责**: 查询和过滤调用日志

```typescript
interface LogQuery {
  startDate?: string;
  endDate?: string;
  modelName?: string;
  service?: string;
  status?: 'success' | 'error';
  keyword?: string; // 全文搜索
  page?: number;
  pageSize?: number;
}

interface LogQueryResult {
  logs: CallLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

class LogQueryService {
  async queryLogs(query: LogQuery): Promise<LogQueryResult>;
  async getLogDetail(requestId: string): Promise<CallLog>;
  async exportLogs(query: LogQuery, format: 'json' | 'csv' | 'excel'): Promise<string>; // file path
  async deleteOldLogs(beforeDate: string): Promise<number>; // returns deleted count
}
```

**关键方法**:
- `queryLogs()`: 分页查询日志
- `getLogDetail()`: 获取单条日志详情
- `exportLogs()`: 导出日志为文件
- `deleteOldLogs()`: 清理过期日志

## 数据模型

### gemini_configs 表

```sql
CREATE TABLE gemini_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_url TEXT NOT NULL,
  default_text_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  default_vision_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  default_image_gen_model TEXT NOT NULL DEFAULT 'imagen-3.0-generate-002',
  timeout INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### gemini_api_keys 表

```sql
CREATE TABLE gemini_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_value TEXT NOT NULL, -- 加密存储
  is_active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_active_priority ON gemini_api_keys(is_active, priority);
```

### gemini_call_logs 表

```sql
CREATE TABLE gemini_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  service TEXT NOT NULL, -- 'text' | 'image' | 'file' | 'stream'
  method TEXT NOT NULL,
  model_name TEXT NOT NULL,
  api_key_id INTEGER,
  request_params TEXT, -- JSON
  response_status TEXT NOT NULL, -- 'success' | 'error'
  response_time INTEGER, -- ms
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  response_data TEXT, -- JSON or summary
  error_type TEXT,
  error_message TEXT,
  user_id TEXT,
  FOREIGN KEY (api_key_id) REFERENCES gemini_api_keys(id)
);

CREATE INDEX idx_call_logs_timestamp ON gemini_call_logs(timestamp);
CREATE INDEX idx_call_logs_model ON gemini_call_logs(model_name);
CREATE INDEX idx_call_logs_status ON gemini_call_logs(response_status);
CREATE INDEX idx_call_logs_request_id ON gemini_call_logs(request_id);
```

### gemini_benchmarks 表

```sql
CREATE TABLE gemini_benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  test_prompt TEXT NOT NULL,
  first_token_time INTEGER, -- ms
  total_response_time INTEGER NOT NULL, -- ms
  tokens_generated INTEGER,
  tokens_per_second REAL,
  success INTEGER NOT NULL, -- 0 or 1
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_benchmarks_model ON gemini_benchmarks(model_name);
CREATE INDEX idx_benchmarks_timestamp ON gemini_benchmarks(timestamp);
```

### gemini_admin_operations 表（操作审计）

```sql
CREATE TABLE gemini_admin_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  operation_type TEXT NOT NULL, -- 'config_update' | 'key_add' | 'key_delete' | etc.
  operation_details TEXT, -- JSON
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_ops_user ON gemini_admin_operations(user_id);
CREATE INDEX idx_admin_ops_timestamp ON gemini_admin_operations(timestamp);
```


## 正确性属性

在编写正确性属性之前，让我先完成验收标准的可测试性分析：

### 验收标准可测试性分析

#### 需求 1: API Base URL 配置管理

1.1. WHEN 管理员访问配置页面时 THEN 系统应显示当前配置的 API Base URL
思考: 这是测试 UI 渲染的特定场景，可以通过检查页面加载后是否包含配置数据来验证
可测试性: yes - example

1.2. WHEN 管理员输入新的 Base URL 时 THEN 系统应验证 URL 格式的有效性
思考: 这是关于所有可能的 URL 输入的规则，可以生成随机 URL 字符串测试验证逻辑
可测试性: yes - property

1.3. WHEN 保存 Base URL 配置时 THEN 系统应将配置持久化到数据库
思考: 这是关于所有有效配置的规则，可以生成随机配置并验证保存后能读取相同数据
可测试性: yes - property

1.4. WHEN Base URL 更新后 THEN 系统应使用新的 URL 进行后续的 API 调用
思考: 这是关于配置更新后行为的规则，可以测试更新前后 API 调用使用的 URL 是否改变
可测试性: yes - property

1.5. WHEN Base URL 格式无效时 THEN 系统应显示明确的错误提示并阻止保存
思考: 这是关于错误处理的规则，可以生成无效 URL 并验证是否正确拒绝
可测试性: yes - property

#### 需求 2: API Key 批量管理

2.1. WHEN 管理员访问 API Key 管理页面时 THEN 系统应显示所有已配置的 API Key 列表
思考: 这是测试特定页面的渲染，可以验证页面是否包含所有密钥
可测试性: yes - example

2.2. WHEN 管理员添加新的 API Key 时 THEN 系统应支持一次性输入多个密钥
思考: 这是关于批量添加功能的规则，可以生成随机数量的密钥测试批量添加
可测试性: yes - property

2.3. WHEN 保存 API Key 时 THEN 系统应对每个密钥进行格式验证
思考: 这是关于所有密钥输入的验证规则，可以生成各种格式的密钥测试验证逻辑
可测试性: yes - property

2.4. WHEN 显示 API Key 时 THEN 系统应对密钥进行脱敏显示
思考: 这是关于所有密钥显示的规则，可以生成随机密钥验证脱敏后的格式
可测试性: yes - property

2.5. WHEN 删除 API Key 时 THEN 系统应要求确认并从数据库中移除该密钥
思考: 这是关于删除操作的规则，可以测试删除后密钥是否真的不存在
可测试性: yes - property

2.6. WHEN 编辑 API Key 时 THEN 系统应允许修改密钥的备注名称或启用状态
思考: 这是关于更新操作的规则，可以测试更新后数据是否正确保存
可测试性: yes - property

2.7. WHEN 存在多个 API Key 时 THEN 系统应支持设置密钥的优先级或轮询策略
思考: 这是关于密钥选择策略的规则，可以测试不同策略下选择的密钥是否符合预期
可测试性: yes - property

#### 需求 3: 模型列表获取与选择

3.1. WHEN 管理员点击"获取模型列表"按钮时 THEN 系统应从配置的 API Base URL 请求可用模型列表
思考: 这是测试特定用户操作的场景
可测试性: yes - example

3.2. WHEN 模型列表获取成功时 THEN 系统应显示所有可用模型及其基本信息
思考: 这是关于成功响应处理的规则，可以测试返回的数据是否正确解析和显示
可测试性: yes - property

3.3. WHEN 模型列表获取失败时 THEN 系统应显示错误信息并提供重试选项
思考: 这是关于错误处理的特定场景
可测试性: yes - example

3.4. WHEN 管理员选择模型时 THEN 系统应允许为不同的服务类型配置不同的默认模型
思考: 这是关于配置保存的规则，可以测试不同服务类型的模型配置是否独立
可测试性: yes - property

3.5. WHEN 保存模型配置时 THEN 系统应将选择的模型持久化到数据库
思考: 这是往返一致性，可以测试保存后读取是否得到相同配置
可测试性: yes - property

3.6. WHEN 模型配置更新后 THEN 系统应在后续的 API 调用中使用新配置的模型
思考: 这是关于配置生效的规则，可以测试更新后 API 调用使用的模型是否改变
可测试性: yes - property

#### 需求 4: 模型性能测速

4.1. WHEN 管理员选择一个模型进行测速时 THEN 系统应使用标准测试提示词向该模型发送请求
思考: 这是关于所有模型测速的规则，可以生成随机模型名称测试测速功能
可测试性: yes - property

4.2. WHEN 测速请求发送时 THEN 系统应记录请求开始时间
思考: 这是关于时间记录的规则，可以验证每次测速都有开始时间
可测试性: yes - property

4.3. WHEN 测速请求完成时 THEN 系统应计算并显示响应时间、token 生成速率等性能指标
思考: 这是关于性能指标计算的规则，可以验证计算结果的正确性
可测试性: yes - property

4.4. WHEN 测速失败时 THEN 系统应显示失败原因和错误详情
思考: 这是关于错误处理的规则，可以模拟失败场景验证错误信息
可测试性: yes - property

4.5. WHEN 进行批量测速时 THEN 系统应支持同时测试多个模型并生成对比报告
思考: 这是关于批量操作的规则，可以测试多个模型的测速结果是否都被记录
可测试性: yes - property

4.6. WHEN 测速完成时 THEN 系统应将测速结果保存到数据库以供历史对比
思考: 这是往返一致性，可以测试保存后能否查询到相同的测速结果
可测试性: yes - property

#### 需求 5: 模型功能测试

5.1. WHEN 管理员选择一个模型进行功能测试时 THEN 系统应提供自定义提示词输入框
思考: 这是 UI 功能测试
可测试性: yes - example

5.2. WHEN 管理员输入测试提示词并提交时 THEN 系统应调用选定的模型并返回生成结果
思考: 这是关于所有提示词的规则，可以生成随机提示词测试功能
可测试性: yes - property

5.3. WHEN 测试文本生成模型时 THEN 系统应显示生成的文本内容和相关元数据
思考: 这是关于响应处理的规则，可以验证返回数据包含必要字段
可测试性: yes - property

5.4. WHEN 测试图像分析模型时 THEN 系统应支持上传测试图像并显示分析结果
思考: 这是关于图像处理的规则，可以测试不同图像输入的处理
可测试性: yes - property

5.5. WHEN 测试图像生成模型时 THEN 系统应显示生成的图像和相关参数
思考: 这是关于图像生成的规则，可以验证生成结果的格式
可测试性: yes - property

5.6. WHEN 测试失败时 THEN 系统应显示详细的错误信息和调试建议
思考: 这是关于错误处理的规则
可测试性: yes - property

#### 需求 6: API 调用日志全记录

6.1. WHEN 系统调用 Gemini API 时 THEN 系统应记录请求的时间戳、模型名称、请求参数
思考: 这是关于所有 API 调用的规则，可以验证每次调用都有完整的请求记录
可测试性: yes - property

6.2. WHEN API 响应返回时 THEN 系统应记录响应时间、状态码、token 使用量、响应内容摘要
思考: 这是关于所有响应的规则，可以验证每次响应都有完整的记录
可测试性: yes - property

6.3. WHEN API 调用失败时 THEN 系统应记录错误类型、错误消息和堆栈跟踪
思考: 这是关于错误记录的规则，可以模拟失败场景验证错误日志
可测试性: yes - property

6.4. WHEN 记录日志时 THEN 系统应为每条日志生成唯一标识符以便追踪
思考: 这是关于唯一性的规则，可以验证所有日志的 ID 都不重复
可测试性: yes - property

6.5. WHEN 日志包含敏感信息时 THEN 系统应对 API Key 等敏感字段进行脱敏处理
思考: 这是关于所有日志的安全规则，可以验证日志中不包含完整密钥
可测试性: yes - property

6.6. WHEN 日志量较大时 THEN 系统应实施日志轮转或归档策略以控制存储空间
思考: 这是性能和存储管理需求，不太适合单元测试
可测试性: no

#### 需求 7: 日志查询与过滤

7.1. WHEN 管理员访问日志页面时 THEN 系统应显示最近的 API 调用日志列表
思考: 这是特定页面的渲染测试
可测试性: yes - example

7.2. WHEN 管理员设置时间范围过滤时 THEN 系统应仅显示指定时间段内的日志
思考: 这是关于过滤功能的规则，可以生成随机时间范围测试过滤结果
可测试性: yes - property

7.3. WHEN 管理员按模型名称过滤时 THEN 系统应仅显示使用该模型的调用日志
思考: 这是关于过滤功能的规则，可以验证过滤后的结果都匹配条件
可测试性: yes - property

7.4. WHEN 管理员按状态过滤时 THEN 系统应支持筛选成功、失败或特定错误类型的日志
思考: 这是关于过滤功能的规则
可测试性: yes - property

7.5. WHEN 管理员搜索关键词时 THEN 系统应在请求参数和响应内容中进行全文搜索
思考: 这是关于搜索功能的规则，可以验证搜索结果包含关键词
可测试性: yes - property

7.6. WHEN 日志数量较多时 THEN 系统应支持分页显示并提供页码导航
思考: 这是关于分页功能的规则，可以验证分页参数的正确性
可测试性: yes - property

#### 需求 8: 日志详情查看

8.1. WHEN 管理员点击某条日志时 THEN 系统应显示该日志的完整详情页面
思考: 这是特定操作的测试
可测试性: yes - example

8.2. WHEN 显示日志详情时 THEN 系统应展示请求的完整参数
思考: 这是关于所有日志详情的规则，可以验证详情包含所有必要字段
可测试性: yes - property

8.3. WHEN 显示日志详情时 THEN 系统应展示响应的完整内容
思考: 这是关于响应展示的规则
可测试性: yes - property

8.4. WHEN 显示日志详情时 THEN 系统应展示性能指标
思考: 这是关于指标展示的规则
可测试性: yes - property

8.5. WHEN 日志包含错误时 THEN 系统应高亮显示错误信息和堆栈跟踪
思考: 这是 UI 展示需求，不太适合自动化测试
可测试性: no

8.6. WHEN 查看日志详情时 THEN 系统应提供"复制"或"导出"功能以便分享或存档
思考: 这是功能性需求，可以测试导出的数据是否完整
可测试性: yes - property

#### 需求 9: 日志导出与下载

9.1. WHEN 管理员选择导出日志时 THEN 系统应支持导出为 JSON、CSV 或 Excel 格式
思考: 这是关于导出功能的规则，可以测试不同格式的导出结果
可测试性: yes - property

9.2. WHEN 导出日志时 THEN 系统应允许选择导出的时间范围和过滤条件
思考: 这是关于导出参数的规则，可以验证导出结果符合过滤条件
可测试性: yes - property

9.3. WHEN 导出大量日志时 THEN 系统应在后台处理并提供下载链接
思考: 这是异步处理需求，可以测试后台任务的完成状态
可测试性: yes - property

9.4. WHEN 导出完成时 THEN 系统应通知管理员并提供下载按钮
思考: 这是通知机制，可以测试完成后的状态变化
可测试性: yes - property

9.5. WHEN 下载日志文件时 THEN 系统应确保文件包含所有选定的日志记录和字段
思考: 这是数据完整性规则，可以验证导出文件的内容
可测试性: yes - property

#### 需求 10: 统计与可视化

10.1. WHEN 管理员访问统计页面时 THEN 系统应显示总调用次数、成功率、失败率等关键指标
思考: 这是特定页面的测试
可测试性: yes - example

10.2. WHEN 显示统计数据时 THEN 系统应提供时间维度的趋势图
思考: 这是关于统计计算的规则，可以验证计算结果的正确性
可测试性: yes - property

10.3. WHEN 分析模型使用时 THEN 系统应显示各模型的调用次数和占比
思考: 这是关于统计计算的规则
可测试性: yes - property

10.4. WHEN 分析性能时 THEN 系统应显示平均响应时间、P95、P99 等性能指标
思考: 这是关于性能指标计算的规则，可以验证百分位数计算的正确性
可测试性: yes - property

10.5. WHEN 分析成本时 THEN 系统应显示 token 使用量和预估成本
思考: 这是关于成本计算的规则，可以验证计算公式的正确性
可测试性: yes - property

10.6. WHEN 统计数据更新时 THEN 系统应支持实时或定期刷新统计数据
思考: 这是关于数据刷新的规则，可以测试刷新后数据是否更新
可测试性: yes - property

#### 需求 11: 配置备份与恢复

11.1. WHEN 管理员点击"备份配置"时 THEN 系统应导出当前所有配置为 JSON 文件
思考: 这是特定操作的测试
可测试性: yes - example

11.2. WHEN 备份配置时 THEN 系统应包含 Base URL、API Keys、模型选择等所有配置项
思考: 这是关于备份完整性的规则，可以验证备份文件包含所有必要字段
可测试性: yes - property

11.3. WHEN 管理员上传备份文件时 THEN 系统应验证文件格式和内容的有效性
思考: 这是关于验证功能的规则，可以生成各种格式的文件测试验证逻辑
可测试性: yes - property

11.4. WHEN 恢复配置时 THEN 系统应提示管理员确认并显示将要恢复的配置内容
思考: 这是 UI 交互需求
可测试性: no

11.5. WHEN 恢复完成时 THEN 系统应应用新配置并重新初始化 API 客户端
思考: 这是关于配置生效的规则，可以测试恢复后配置是否正确应用
可测试性: yes - property

#### 需求 12: 权限控制与安全

12.1. WHEN 用户访问管理后台时 THEN 系统应要求身份验证
思考: 这是特定场景的测试
可测试性: yes - example

12.2. WHEN 用户未登录时 THEN 系统应重定向到登录页面
思考: 这是关于所有未认证请求的规则，可以测试重定向行为
可测试性: yes - property

12.3. WHEN 用户权限不足时 THEN 系统应拒绝访问敏感操作
思考: 这是关于权限检查的规则，可以测试不同权限级别的访问控制
可测试性: yes - property

12.4. WHEN 记录操作日志时 THEN 系统应记录操作用户、操作类型和操作时间
思考: 这是关于审计日志的规则，可以验证每次操作都有完整记录
可测试性: yes - property

12.5. WHEN 显示敏感信息时 THEN 系统应对 API Key 等信息进行脱敏处理
思考: 这是关于所有敏感信息显示的规则，可以验证脱敏逻辑
可测试性: yes - property

### 属性反思与去重

审查所有可测试属性后，识别冗余：

- 属性 2.4（密钥脱敏）和属性 12.5（敏感信息脱敏）可以合并为一个通用的脱敏属性
- 属性 1.3（配置持久化）、2.5（密钥删除）、3.5（模型配置持久化）都是数据库往返一致性，可以合并
- 属性 6.1 和 6.2（请求和响应记录）可以合并为一个完整的日志记录属性
- 属性 7.2、7.3、7.4（各种过滤）可以合并为一个通用的过滤属性

经过去重后，保留最有价值的独立属性。

### 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

#### 属性 1: URL 格式验证一致性
*对于任意* URL 字符串，验证函数应该正确识别有效和无效的 URL 格式，且验证结果应该与标准 URL 规范一致
**验证需求: 1.2, 1.5**

#### 属性 2: 配置往返一致性
*对于任意* 有效的配置对象，保存到数据库后再读取应该得到等价的配置数据
**验证需求: 1.3, 3.5, 11.5**

#### 属性 3: 配置更新生效性
*对于任意* 配置更新操作，更新后的 API 调用应该使用新的配置参数（Base URL、模型名称等）
**验证需求: 1.4, 3.6**

#### 属性 4: 批量密钥添加原子性
*对于任意* 批量添加的密钥列表，要么所有密钥都成功添加，要么在验证失败时所有密钥都不添加
**验证需求: 2.2, 2.3**

#### 属性 5: 敏感信息脱敏完整性
*对于任意* API Key 或敏感字符串，脱敏后的字符串应该不包含完整的原始值，但应该保留足够的信息用于识别（如前后几位字符）
**验证需求: 2.4, 6.5, 12.5**

#### 属性 6: 密钥删除幂等性
*对于任意* 已存在的密钥，删除操作应该成功，且再次删除同一密钥应该返回明确的"不存在"错误
**验证需求: 2.5**

#### 属性 7: 密钥轮询策略一致性
*对于任意* 密钥轮询策略（轮询、优先级、随机），多次调用 getNextKey 应该按照策略规则返回密钥，且不应该返回已禁用的密钥
**验证需求: 2.7**

#### 属性 8: 模型列表解析完整性
*对于任意* 从 API 返回的模型列表响应，解析后的模型数据应该包含所有必要字段（名称、描述、能力），且数量应该与原始响应一致
**验证需求: 3.2**

#### 属性 9: 测速性能指标计算正确性
*对于任意* 测速请求，计算的性能指标（响应时间、token/秒）应该基于实际测量的时间和 token 数量，且 tokensPerSecond = tokensGenerated / (totalResponseTime / 1000)
**验证需求: 4.3**

#### 属性 10: 批量测速结果完整性
*对于任意* 批量测速的模型列表，返回的测速结果数量应该等于输入的模型数量，且每个模型都应该有对应的测速记录
**验证需求: 4.5**

#### 属性 11: 测速结果往返一致性
*对于任意* 测速结果，保存到数据库后再查询应该得到相同的性能指标数据
**验证需求: 4.6**

#### 属性 12: 日志记录完整性
*对于任意* Gemini API 调用，日志应该包含请求时间戳、模型名称、请求参数、响应状态、响应时间和 token 使用量（如果成功）或错误信息（如果失败）
**验证需求: 6.1, 6.2, 6.3**

#### 属性 13: 日志唯一标识符唯一性
*对于任意* 两条不同的日志记录，它们的 requestId 应该不相同
**验证需求: 6.4**

#### 属性 14: 日志过滤结果正确性
*对于任意* 日志查询条件（时间范围、模型名称、状态），返回的日志记录应该全部满足查询条件
**验证需求: 7.2, 7.3, 7.4**

#### 属性 15: 日志全文搜索包含性
*对于任意* 搜索关键词，返回的日志记录的请求参数或响应内容应该包含该关键词
**验证需求: 7.5**

#### 属性 16: 日志分页一致性
*对于任意* 分页参数（page, pageSize），返回的日志数量应该不超过 pageSize，且总记录数应该等于所有页的记录数之和
**验证需求: 7.6**

#### 属性 17: 日志详情完整性
*对于任意* 日志记录，通过 requestId 查询的详情应该包含该日志的所有字段（请求参数、响应内容、性能指标等）
**验证需求: 8.2, 8.3, 8.4**

#### 属性 18: 日志导出数据完整性
*对于任意* 导出查询条件，导出文件中的日志记录应该与查询结果一致，且包含所有选定的字段
**验证需求: 9.2, 9.5**

#### 属性 19: 日志导出格式正确性
*对于任意* 导出格式（JSON、CSV、Excel），导出的文件应该符合该格式的规范，且能够被相应的解析器正确解析
**验证需求: 9.1**

#### 属性 20: 统计数据计算正确性
*对于任意* 时间范围内的日志数据，统计的总调用次数应该等于日志记录数，成功率应该等于成功次数除以总次数，平均响应时间应该等于所有响应时间的算术平均值
**验证需求: 10.2, 10.3, 10.4**

#### 属性 21: 百分位数计算正确性
*对于任意* 响应时间数据集，计算的 P95 和 P99 应该满足：至少 95% 和 99% 的数据点小于或等于对应的百分位值
**验证需求: 10.4**

#### 属性 22: 成本计算一致性
*对于任意* token 使用量，预估成本应该基于一致的定价模型计算，且 estimatedCost = totalTokens * pricePerToken
**验证需求: 10.5**

#### 属性 23: 配置备份完整性
*对于任意* 当前配置状态，导出的备份文件应该包含所有配置项（Base URL、API Keys、模型选择），且不应该遗漏任何配置数据
**验证需求: 11.2**

#### 属性 24: 配置恢复往返一致性
*对于任意* 配置备份文件，导出后再导入应该恢复到相同的配置状态
**验证需求: 11.3, 11.5**

#### 属性 25: 权限检查一致性
*对于任意* 需要权限的操作，未认证或权限不足的用户应该被拒绝访问，且应该返回明确的错误信息
**验证需求: 12.2, 12.3**

#### 属性 26: 操作审计日志完整性
*对于任意* 管理操作（配置更新、密钥添加/删除等），审计日志应该记录操作用户、操作类型、操作时间和操作详情
**验证需求: 12.4**


## 错误处理

### 错误分类

1. **配置错误**
   - 无效的 Base URL 格式
   - 无效的 API Key 格式
   - 配置冲突（如重复的密钥）

2. **API 调用错误**
   - 网络连接失败
   - API 认证失败
   - 模型不存在或不可用
   - 请求超时

3. **数据库错误**
   - 连接失败
   - 查询超时
   - 约束违反（如唯一性约束）

4. **权限错误**
   - 未认证访问
   - 权限不足
   - 会话过期

### 错误处理策略

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

class ErrorHandler {
  static handleConfigError(error: any): ErrorResponse;
  static handleApiError(error: any): ErrorResponse;
  static handleDatabaseError(error: any): ErrorResponse;
  static handleAuthError(error: any): ErrorResponse;
}
```

**错误处理原则**:
1. 所有错误都应该返回标准化的错误响应
2. 错误消息应该清晰且可操作
3. 敏感信息（如完整的 API Key）不应该出现在错误消息中
4. 错误应该被记录到日志系统
5. 前端应该提供友好的错误提示和恢复建议

### 降级策略

1. **模型列表获取失败**: 使用缓存的模型列表或默认模型列表
2. **测速失败**: 标记为失败但不影响其他功能
3. **日志记录失败**: 记录到备用日志文件，不影响主要功能
4. **统计计算失败**: 显示部分可用的统计数据

## 测试策略

### 单元测试

**测试框架**: Vitest（与现有项目一致）

**测试覆盖**:

1. **AdminConfigService**
   - URL 格式验证
   - 配置 CRUD 操作
   - 配置备份和恢复
   - 模型列表获取和解析

2. **AdminKeyService**
   - 密钥 CRUD 操作
   - 批量添加密钥
   - 密钥脱敏
   - 密钥轮询策略
   - 使用统计更新

3. **LoggingInterceptor**
   - 请求日志记录
   - 响应日志记录
   - 错误日志记录
   - 服务包装（装饰器模式）

4. **BenchmarkService**
   - 单模型测速
   - 批量测速
   - 性能指标计算
   - 测速结果保存

5. **StatisticsService**
   - 基本统计计算（总数、成功率）
   - 百分位数计算（P95、P99）
   - 时间序列数据聚合
   - 成本计算

6. **LogQueryService**
   - 日志查询和过滤
   - 分页功能
   - 全文搜索
   - 日志导出

### 属性测试

**测试框架**: fast-check

**配置**: 每个属性测试运行至少 100 次迭代

**测试标注格式**:
```typescript
// **Feature: gemini-admin-panel, Property 1: URL 格式验证一致性**
// **Validates: Requirements 1.2, 1.5**
```

**属性测试覆盖**:
- 属性 1-26（如正确性属性部分所列）
- 每个属性对应一个独立的测试用例
- 使用 fast-check 生成随机输入数据
- 验证属性在所有输入下都成立

**生成器策略**:
```typescript
// URL 生成器
const urlArbitrary = fc.oneof(
  fc.webUrl(), // 有效 URL
  fc.string(), // 无效 URL
  fc.constant(''), // 空字符串
  fc.constant('not-a-url') // 明显无效的 URL
);

// API Key 生成器
const apiKeyArbitrary = fc.string({ minLength: 20, maxLength: 100 });

// 配置对象生成器
const configArbitrary = fc.record({
  baseUrl: fc.webUrl(),
  defaultTextModel: fc.constantFrom('gemini-2.0-flash', 'gemini-1.5-pro'),
  timeout: fc.integer({ min: 1000, max: 60000 }),
});

// 日志查询条件生成器
const logQueryArbitrary = fc.record({
  startDate: fc.date(),
  endDate: fc.date(),
  modelName: fc.option(fc.string()),
  status: fc.option(fc.constantFrom('success', 'error')),
});
```

### 集成测试

**测试场景**:
1. 完整的配置管理流程（创建、更新、备份、恢复）
2. 完整的密钥管理流程（添加、使用、轮询、删除）
3. 完整的日志记录流程（API 调用 → 日志记录 → 查询 → 导出）
4. 完整的测速流程（选择模型 → 执行测速 → 保存结果 → 查看历史）
5. 完整的统计流程（记录日志 → 聚合统计 → 展示图表）

### 前端测试

**测试框架**: Vitest + Vue Test Utils

**测试覆盖**:
1. 组件渲染测试
2. 用户交互测试（按钮点击、表单提交）
3. API 调用 mock 测试
4. 路由导航测试
5. 错误状态展示测试

## 性能考虑

### 数据库优化

1. **索引策略**
   - 在 `gemini_call_logs` 表的 `timestamp`、`model_name`、`response_status` 字段上创建索引
   - 在 `gemini_api_keys` 表的 `is_active` 和 `priority` 字段上创建复合索引
   - 在 `request_id` 字段上创建唯一索引

2. **查询优化**
   - 使用分页查询避免一次性加载大量数据
   - 使用 `LIMIT` 和 `OFFSET` 实现高效分页
   - 对于统计查询，使用聚合函数和 `GROUP BY`

3. **日志归档**
   - 定期将旧日志（如 30 天前）归档到单独的表或文件
   - 实施日志轮转策略，控制主表大小
   - 提供归档日志的查询接口

### 缓存策略

1. **配置缓存**
   - 将当前配置缓存在内存中
   - 配置更新时清除缓存
   - 缓存有效期：直到下次更新

2. **模型列表缓存**
   - 缓存从 API 获取的模型列表
   - 缓存有效期：24 小时
   - 提供手动刷新功能

3. **统计数据缓存**
   - 缓存计算密集的统计数据
   - 缓存有效期：5 分钟
   - 使用后台任务定期更新缓存

### 并发控制

1. **API 调用限流**
   - 限制同时进行的测速请求数量（最多 3 个）
   - 使用队列管理批量测速任务

2. **数据库连接池**
   - 配置合理的连接池大小（如 10 个连接）
   - 避免连接泄漏

3. **日志写入批处理**
   - 将日志写入操作批量处理
   - 使用异步写入避免阻塞主流程

### 前端性能

1. **虚拟滚动**
   - 对于大量日志列表，使用虚拟滚动技术
   - 只渲染可见区域的日志条目

2. **懒加载**
   - 图表组件按需加载
   - 使用 Vue 的异步组件功能

3. **防抖和节流**
   - 搜索输入使用防抖（300ms）
   - 统计数据刷新使用节流（5 秒）

## 安全考虑

### 数据加密

1. **API Key 加密存储**
   ```typescript
   import crypto from 'crypto';
   
   class EncryptionService {
     private algorithm = 'aes-256-gcm';
     private key: Buffer;
     
     constructor(secretKey: string) {
       this.key = crypto.scryptSync(secretKey, 'salt', 32);
     }
     
     encrypt(text: string): string {
       const iv = crypto.randomBytes(16);
       const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
       let encrypted = cipher.update(text, 'utf8', 'hex');
       encrypted += cipher.final('hex');
       const authTag = cipher.getAuthTag();
       return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
     }
     
     decrypt(encryptedText: string): string {
       const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
       const iv = Buffer.from(ivHex, 'hex');
       const authTag = Buffer.from(authTagHex, 'hex');
       const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
       decipher.setAuthTag(authTag);
       let decrypted = decipher.update(encrypted, 'hex', 'utf8');
       decrypted += decipher.final('utf8');
       return decrypted;
     }
   }
   ```

2. **敏感信息脱敏**
   ```typescript
   function maskApiKey(key: string): string {
     if (key.length <= 8) return '***';
     return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
   }
   
   function maskSensitiveData(data: any): any {
     const masked = { ...data };
     if (masked.apiKey) masked.apiKey = maskApiKey(masked.apiKey);
     if (masked.keyValue) masked.keyValue = maskApiKey(masked.keyValue);
     return masked;
   }
   ```

### 身份验证和授权

1. **会话管理**
   - 复用现有的登录系统（Pinhaopin 平台认证）
   - 使用 HttpOnly Cookie 存储会话令牌
   - 设置合理的会话过期时间（如 24 小时）

2. **权限检查中间件**
   ```typescript
   function requireAuth(req: Request, res: Response, next: NextFunction) {
     if (!req.session || !req.session.userId) {
       return res.status(401).json({
         success: false,
         error: { code: 'UNAUTHORIZED', message: '请先登录' }
       });
     }
     next();
   }
   
   function requireAdmin(req: Request, res: Response, next: NextFunction) {
     if (!req.session || !req.session.isAdmin) {
       return res.status(403).json({
         success: false,
         error: { code: 'FORBIDDEN', message: '权限不足' }
       });
     }
     next();
   }
   ```

3. **操作审计**
   - 记录所有敏感操作（配置更新、密钥添加/删除）
   - 审计日志包含用户 ID、操作类型、时间戳、操作详情
   - 审计日志不可修改或删除

### 输入验证

1. **URL 验证**
   ```typescript
   function validateUrl(url: string): boolean {
     try {
       const parsed = new URL(url);
       return ['http:', 'https:'].includes(parsed.protocol);
     } catch {
       return false;
     }
   }
   ```

2. **API Key 验证**
   ```typescript
   function validateApiKey(key: string): boolean {
     // Gemini API Key 格式：以 'AIza' 开头，长度约 39 字符
     return /^AIza[A-Za-z0-9_-]{35}$/.test(key);
   }
   ```

3. **SQL 注入防护**
   - 使用参数化查询
   - 避免字符串拼接 SQL
   - 使用 ORM 或查询构建器

### 配置备份安全

1. **备份文件加密**
   - 导出的配置文件包含敏感信息时进行加密
   - 提供密码保护选项

2. **备份文件验证**
   - 导入时验证文件签名
   - 检查文件完整性

## 部署和配置

### 环境变量

```bash
# 数据库配置
DATABASE_PATH=./products.db

# 加密密钥（用于 API Key 加密）
ENCRYPTION_SECRET=your_secret_key_here

# 会话配置
SESSION_SECRET=your_session_secret_here
SESSION_MAX_AGE=86400000

# 日志配置
LOG_LEVEL=info
LOG_RETENTION_DAYS=30

# 性能配置
MAX_CONCURRENT_BENCHMARKS=3
CACHE_TTL_SECONDS=300
```

### 数据库迁移

```sql
-- 创建管理后台相关表
-- 执行顺序：configs → api_keys → call_logs → benchmarks → admin_operations

-- 1. 创建配置表
CREATE TABLE IF NOT EXISTS gemini_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  base_url TEXT NOT NULL,
  default_text_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  default_vision_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  default_image_gen_model TEXT NOT NULL DEFAULT 'imagen-3.0-generate-002',
  timeout INTEGER NOT NULL DEFAULT 30000,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认配置
INSERT INTO gemini_configs (base_url) VALUES ('https://generativelanguage.googleapis.com');

-- 2. 创建 API Key 表
CREATE TABLE IF NOT EXISTS gemini_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active_priority ON gemini_api_keys(is_active, priority);

-- 3. 创建调用日志表
CREATE TABLE IF NOT EXISTS gemini_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  service TEXT NOT NULL,
  method TEXT NOT NULL,
  model_name TEXT NOT NULL,
  api_key_id INTEGER,
  request_params TEXT,
  response_status TEXT NOT NULL,
  response_time INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  response_data TEXT,
  error_type TEXT,
  error_message TEXT,
  user_id TEXT,
  FOREIGN KEY (api_key_id) REFERENCES gemini_api_keys(id)
);

CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON gemini_call_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_call_logs_model ON gemini_call_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_call_logs_status ON gemini_call_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_call_logs_request_id ON gemini_call_logs(request_id);

-- 4. 创建测速结果表
CREATE TABLE IF NOT EXISTS gemini_benchmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model_name TEXT NOT NULL,
  test_prompt TEXT NOT NULL,
  first_token_time INTEGER,
  total_response_time INTEGER NOT NULL,
  tokens_generated INTEGER,
  tokens_per_second REAL,
  success INTEGER NOT NULL,
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_benchmarks_model ON gemini_benchmarks(model_name);
CREATE INDEX IF NOT EXISTS idx_benchmarks_timestamp ON gemini_benchmarks(timestamp);

-- 5. 创建操作审计表
CREATE TABLE IF NOT EXISTS gemini_admin_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  operation_details TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_ops_user ON gemini_admin_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_ops_timestamp ON gemini_admin_operations(timestamp);
```

### 初始化脚本

```typescript
// backend/scripts/init_admin_panel.ts
import { db } from '../src/db';
import fs from 'fs';
import path from 'path';

async function initAdminPanel() {
  console.log('初始化 Gemini 管理后台...');
  
  // 读取并执行迁移 SQL
  const migrationSql = fs.readFileSync(
    path.join(__dirname, '../migrations/admin_panel.sql'),
    'utf8'
  );
  
  db.exec(migrationSql);
  
  console.log('✓ 数据库表创建完成');
  console.log('✓ 默认配置已插入');
  console.log('管理后台初始化完成！');
}

initAdminPanel().catch(console.error);
```

## 未来扩展

1. **多租户支持**: 支持多个团队或项目独立管理各自的 API 配置
2. **告警系统**: 当错误率、响应时间或成本超过阈值时发送告警
3. **自动化测试**: 定期自动执行模型测速，生成性能趋势报告
4. **成本优化建议**: 基于使用模式提供成本优化建议
5. **A/B 测试支持**: 支持同时使用多个模型并对比效果
6. **API 使用配额管理**: 设置和监控 API 使用配额，防止超支
7. **模型性能对比**: 提供更详细的模型性能对比和推荐
8. **日志分析**: 使用 AI 分析日志，识别异常模式和优化机会
