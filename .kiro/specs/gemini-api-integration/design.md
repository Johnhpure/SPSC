# Gemini API 完整集成设计文档

## 概述

本设计文档详细说明了如何将 Google Gemini API 完整集成到后端服务中。当前系统使用旧版 `@google/generative-ai` SDK (v0.24.1) 和过时的模型（gemini-pro），且缺少关键功能。本次升级将：

1. 迁移到最新的统一 SDK `@google/genai`
2. 升级到最新的模型（gemini-2.0-flash, imagen-3.0-generate 等）
3. 实现完整的功能集：文本生成、图像分析、图像生成、文件管理、流式响应
4. 建立健壮的错误处理和重试机制
5. 提供全面的日志和监控能力

## 架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Express API Layer                     │
│  (/api/gemini/text, /api/gemini/image, /api/gemini/...)│
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Gemini Service Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Text Service │  │Image Service │  │ File Service │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│           Gemini Client Manager (Singleton)              │
│              GoogleGenAI Client Instance                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Google Gemini API                           │
│  (Text Generation, Image Analysis, Image Generation)     │
└──────────────────────────────────────────────────────────┘
```

### 模块划分

1. **GeminiClientManager**: 单例客户端管理器，负责初始化和提供 GoogleGenAI 客户端
2. **GeminiTextService**: 文本生成服务，处理类目推荐、产品分析等
3. **GeminiImageService**: 图像服务，包括图像分析和图像生成
4. **GeminiFileService**: 文件管理服务，处理文件上传、列表、删除
5. **GeminiStreamService**: 流式响应服务，提供实时内容生成
6. **ErrorHandler**: 统一错误处理和重试逻辑
7. **Logger**: 日志和监控模块


## 组件和接口

### 1. GeminiClientManager

**职责**: 管理 GoogleGenAI 客户端的生命周期，提供单例访问

```typescript
class GeminiClientManager {
  private static instance: GeminiClientManager;
  private client: GoogleGenAI | null = null;
  
  private constructor() {}
  
  static getInstance(): GeminiClientManager;
  getClient(): GoogleGenAI;
  initialize(apiKey: string): void;
  isInitialized(): boolean;
}
```

**关键方法**:
- `getInstance()`: 获取单例实例
- `getClient()`: 获取已初始化的客户端，如果未初始化则抛出错误
- `initialize(apiKey)`: 使用 API 密钥初始化客户端
- `isInitialized()`: 检查客户端是否已初始化

### 2. GeminiTextService

**职责**: 提供文本生成功能，包括类目推荐、产品分析等

```typescript
interface TextGenerationOptions {
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

class GeminiTextService {
  async generateText(prompt: string, options?: TextGenerationOptions): Promise<string>;
  async recommendCategories(title: string, description: string): Promise<string[]>;
  async analyzeProduct(title: string, description: string, imageUrl?: string): Promise<ProductAnalysis>;
}
```

**关键方法**:
- `generateText()`: 通用文本生成方法
- `recommendCategories()`: 基于产品信息推荐类目
- `analyzeProduct()`: 综合分析产品，返回结构化数据

### 3. GeminiImageService

**职责**: 提供图像分析和生成功能

```typescript
interface ImageAnalysisOptions {
  model?: string;
  prompt?: string;
}

interface ImageGenerationOptions {
  model?: string;
  numberOfImages?: number;
  includeRaiReason?: boolean;
}

class GeminiImageService {
  async analyzeImage(imageSource: string | Buffer, prompt: string, options?: ImageAnalysisOptions): Promise<ImageAnalysis>;
  async generateImage(prompt: string, options?: ImageGenerationOptions): Promise<GeneratedImage[]>;
  async optimizeProductImage(imageUrl: string, productInfo: ProductInfo): Promise<string>;
}
```

**关键方法**:
- `analyzeImage()`: 分析图像内容，支持 URL 或 Buffer 输入
- `generateImage()`: 根据文本提示生成图像
- `optimizeProductImage()`: 优化产品图像（结合分析和生成）

### 4. GeminiFileService

**职责**: 管理 Files API 的文件上传、列表、删除

```typescript
interface UploadFileOptions {
  mimeType?: string;
  displayName?: string;
}

interface ListFilesOptions {
  pageSize?: number;
  pageToken?: string;
}

class GeminiFileService {
  async uploadFile(filePath: string, options?: UploadFileOptions): Promise<UploadedFile>;
  async listFiles(options?: ListFilesOptions): Promise<FileList>;
  async deleteFile(fileName: string): Promise<void>;
  async getFile(fileName: string): Promise<FileInfo>;
}
```

**关键方法**:
- `uploadFile()`: 上传文件到 Files API
- `listFiles()`: 列出已上传的文件（支持分页）
- `deleteFile()`: 删除指定文件
- `getFile()`: 获取文件信息

### 5. GeminiStreamService

**职责**: 提供流式内容生成功能

```typescript
class GeminiStreamService {
  async *generateContentStream(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string>;
  async streamToSSE(res: Response, prompt: string, options?: TextGenerationOptions): Promise<void>;
}
```

**关键方法**:
- `generateContentStream()`: 返回异步生成器，逐块生成内容
- `streamToSSE()`: 将流式内容通过 Server-Sent Events 发送到客户端

### 6. ErrorHandler

**职责**: 统一处理 API 错误和实施重试策略

```typescript
interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

class ErrorHandler {
  async withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
  handleError(error: any): never;
  isRetryableError(error: any): boolean;
}
```

**关键方法**:
- `withRetry()`: 包装异步函数，自动实施重试策略
- `handleError()`: 统一错误处理，记录日志并抛出标准化错误
- `isRetryableError()`: 判断错误是否可重试（429, 5xx 等）


## 数据模型

### ProductAnalysis

```typescript
interface ProductAnalysis {
  categories: string[];
  tags: string[];
  description: string;
  suggestedImprovements: string[];
  qualityScore: number;
}
```

### ImageAnalysis

```typescript
interface ImageAnalysis {
  description: string;
  objects: string[];
  colors: string[];
  quality: {
    resolution: string;
    clarity: string;
    composition: string;
  };
  suggestions: string[];
}
```

### GeneratedImage

```typescript
interface GeneratedImage {
  imageBytes: string; // base64 encoded
  revisedPrompt?: string;
  finishReason: string;
  savedPath?: string; // 保存到本地后的路径
  url?: string; // 可访问的 URL
}
```

### UploadedFile

```typescript
interface UploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  sizeBytes: number;
  createTime: string;
  updateTime: string;
}
```

### FileList

```typescript
interface FileList {
  files: UploadedFile[];
  nextPageToken?: string;
}
```

### ProductInfo

```typescript
interface ProductInfo {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
}
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 客户端单例一致性
*对于任意*多次调用 `GeminiClientManager.getInstance()`，返回的实例应该是同一个对象（引用相等）
**验证需求: 1.4**

### 属性 2: 配置参数传递完整性
*对于任意*有效的 `TextGenerationOptions` 配置对象，调用文本生成服务时，所有配置参数应该被正确传递到底层 API 调用中
**验证需求: 2.3**

### 属性 3: 错误处理降级一致性
*对于任意*导致 API 调用失败的错误场景，系统应该捕获错误、记录日志并返回降级响应，而不是抛出未处理的异常
**验证需求: 2.4, 4.6**

### 属性 4: 输出格式验证
*对于任意*成功的文本生成响应，解析后的输出应该符合预期的数据结构（如类目推荐返回字符串数组）
**验证需求: 2.5**

### 属性 5: 多模态输入灵活性
*对于任意*有效的图像输入（URL 或 Buffer），图像分析服务应该能够处理并返回分析结果
**验证需求: 3.1**

### 属性 6: 图像转换正确性
*对于任意*有效的图像 URL，下载并转换为 base64 或上传到 Files API 的过程应该成功，且转换后的数据应该能被 API 接受
**验证需求: 3.2**

### 属性 7: Content 对象组装完整性
*对于任意*有效的文本提示和图像数据，创建的 Content 对象应该包含所有必要的 Part 元素，且格式符合 API 要求
**验证需求: 3.3**

### 属性 8: 图像生成输出格式
*对于任意*成功的图像生成请求，返回的图像数据应该是有效的 base64 编码字符串，且能够被解码为有效的图像文件
**验证需求: 4.4**

### 属性 9: 文件保存完整性
*对于任意*生成的图像数据，保存到 uploads 目录的操作应该成功，且保存的文件应该能够被读取并与原始数据一致
**验证需求: 4.5**

### 属性 10: 文件上传往返一致性
*对于任意*有效的文件，上传到 Files API 后应该返回文件 URI 和元数据，且通过 URI 获取的文件信息应该与上传时的元数据一致
**验证需求: 5.2**

### 属性 11: 分页查询完整性
*对于任意*有效的分页参数（pageSize, pageToken），列出文件的操作应该返回正确数量的文件，且提供下一页的 token（如果有更多文件）
**验证需求: 5.3**

### 属性 12: 文件删除幂等性
*对于任意*已上传的文件，删除操作应该成功，且再次删除同一文件应该返回明确的错误（文件不存在）
**验证需求: 5.4**

### 属性 13: MIME 类型验证
*对于任意*不支持的 MIME 类型，文件上传前的验证应该拒绝该文件，并返回明确的错误消息
**验证需求: 5.6**

### 属性 14: 流式响应完整性
*对于任意*流式生成请求，接收到的所有块拼接后应该形成完整的响应内容，且最后应该收到完成信号
**验证需求: 6.2, 6.5**

### 属性 15: 流式错误处理
*对于任意*在流式传输过程中发生的错误，系统应该优雅地处理错误、通知客户端并关闭连接
**验证需求: 6.4**

### 属性 16: 限流重试策略
*对于任意*返回 429 错误的 API 调用，系统应该实施指数退避重试，且重试间隔应该递增
**验证需求: 7.1**

### 属性 17: 重试次数限制
*对于任意*返回 5xx 错误的 API 调用，系统应该最多重试 3 次，且在所有重试失败后返回降级响应
**验证需求: 7.2, 7.3**

### 属性 18: 超时处理
*对于任意*超过 30 秒未响应的 API 调用，系统应该取消请求并返回超时错误
**验证需求: 7.4**

### 属性 19: 错误日志完整性
*对于任意*发生的错误，日志应该包含请求参数、错误类型、堆栈跟踪等完整的调试信息
**验证需求: 7.5**

### 属性 20: 环境变量配置读取
*对于任意*有效的环境变量设置，系统应该正确读取并应用这些配置参数
**验证需求: 8.1**

### 属性 21: 配置热更新
*对于任意*配置文件的修改，系统应该能够检测变化并重新加载配置，而无需重启服务
**验证需求: 8.5**

### 属性 22: API 调用日志完整性
*对于任意*API 调用，日志应该包含请求参数、模型名称、时间戳、响应时间、token 使用量和状态码
**验证需求: 9.1, 9.2**

### 属性 23: 使用统计准确性
*对于任意*时间段内的 API 调用，统计数据应该准确反映调用次数、成功率和平均响应时间
**验证需求: 9.4**

### 属性 24: MOCK_MODE 一致性
*对于任意*相同的输入，在 MOCK_MODE 下应该返回一致的模拟数据
**验证需求: 10.3**


## 错误处理

### 错误分类

1. **客户端错误 (4xx)**
   - 400 Bad Request: 请求参数无效
   - 401 Unauthorized: API 密钥无效或缺失
   - 403 Forbidden: 权限不足
   - 404 Not Found: 资源不存在
   - 429 Too Many Requests: 超过速率限制

2. **服务器错误 (5xx)**
   - 500 Internal Server Error: 服务器内部错误
   - 503 Service Unavailable: 服务暂时不可用

3. **网络错误**
   - Timeout: 请求超时
   - Connection Error: 连接失败

### 重试策略

```typescript
interface RetryConfig {
  maxRetries: 3;
  initialDelay: 1000; // ms
  maxDelay: 32000; // ms
  backoffMultiplier: 2;
  retryableStatusCodes: [429, 500, 502, 503, 504];
}
```

**重试逻辑**:
1. 检查错误是否可重试（429, 5xx）
2. 如果重试次数未达上限，计算延迟时间
3. 延迟时间 = min(initialDelay * (backoffMultiplier ^ retryCount), maxDelay)
4. 等待延迟后重试
5. 如果所有重试失败，返回降级响应

### 降级策略

1. **文本生成失败**: 返回默认类目或空数组
2. **图像分析失败**: 返回基本的占位符分析结果
3. **图像生成失败**: 返回占位符图像 URL
4. **文件上传失败**: 使用本地文件系统作为备选

### 错误日志格式

```typescript
interface ErrorLog {
  timestamp: string;
  service: string;
  method: string;
  requestParams: any;
  errorType: string;
  errorMessage: string;
  stackTrace: string;
  retryCount: number;
  userId?: string;
}
```

## 测试策略

### 单元测试

**测试框架**: Jest 或 Vitest

**测试覆盖**:
1. **GeminiClientManager**
   - 单例模式验证
   - 初始化逻辑
   - 错误处理

2. **GeminiTextService**
   - 文本生成基本功能
   - 参数传递
   - 响应解析
   - 错误处理

3. **GeminiImageService**
   - 图像分析（URL 和 Buffer 输入）
   - 图像生成
   - 文件保存
   - 错误处理

4. **GeminiFileService**
   - 文件上传
   - 文件列表（分页）
   - 文件删除
   - MIME 类型验证

5. **ErrorHandler**
   - 重试逻辑
   - 指数退避计算
   - 错误分类
   - 降级策略

### 属性测试

**测试框架**: fast-check (JavaScript 属性测试库)

**配置**: 每个属性测试运行至少 100 次迭代

**测试标注格式**: 
```typescript
// **Feature: gemini-api-integration, Property 1: 客户端单例一致性**
// **Validates: Requirements 1.4**
```

**属性测试覆盖**:
- 属性 1-24（如正确性属性部分所列）
- 每个属性对应一个独立的测试用例
- 使用 fast-check 生成随机输入数据
- 验证属性在所有输入下都成立

### 集成测试

**测试场景**:
1. 端到端文本生成流程
2. 端到端图像分析流程
3. 端到端图像生成和保存流程
4. 文件上传、列表、删除完整流程
5. 流式响应完整流程
6. 错误和重试场景

### Mock 策略

**MOCK_MODE 实现**:
- 环境变量 `MOCK_MODE=true` 启用
- 所有服务检查 MOCK_MODE 标志
- Mock 数据应该与真实 API 响应格式一致
- Mock 数据应该是确定性的（相同输入返回相同输出）

**Mock 数据示例**:
```typescript
const MOCK_RESPONSES = {
  textGeneration: {
    categories: ['电子产品', '手机配件', '充电器'],
  },
  imageAnalysis: {
    description: '一个白色的充电器',
    objects: ['充电器', 'USB接口'],
    colors: ['白色', '灰色'],
    quality: {
      resolution: '高',
      clarity: '清晰',
      composition: '居中',
    },
    suggestions: ['建议使用纯色背景', '增加产品细节展示'],
  },
  imageGeneration: {
    imageBytes: 'base64_placeholder_data',
    revisedPrompt: '优化后的提示词',
    finishReason: 'STOP',
  },
};
```

## 性能考虑

### 并发控制

- 使用连接池限制并发请求数
- 默认最大并发数: 10
- 可通过环境变量配置

### 缓存策略

1. **文本生成结果缓存**
   - 相同输入缓存 1 小时
   - 使用 LRU 缓存，最大 1000 条

2. **图像分析结果缓存**
   - 基于图像 URL 或哈希缓存
   - 缓存 24 小时

3. **文件 URI 缓存**
   - 上传后的文件 URI 缓存
   - 缓存直到文件删除

### 超时设置

- API 调用超时: 30 秒
- 文件上传超时: 60 秒
- 流式响应超时: 120 秒

### 资源清理

- 定期清理过期的上传文件（7 天）
- 清理临时下载的图像文件
- 清理过期的缓存条目

## 安全考虑

### API 密钥管理

- API 密钥存储在环境变量中
- 不在日志中记录完整的 API 密钥
- 定期轮换 API 密钥

### 输入验证

- 验证所有用户输入
- 限制文件大小（最大 20MB）
- 验证 MIME 类型白名单
- 防止路径遍历攻击

### 输出过滤

- 过滤 AI 生成内容中的敏感信息
- 验证生成的图像内容
- 记录所有 AI 生成的内容以便审计

## 监控和日志

### 日志级别

- ERROR: 错误和异常
- WARN: 警告和降级
- INFO: 重要操作和状态变化
- DEBUG: 详细的调试信息

### 监控指标

1. **API 调用指标**
   - 总调用次数
   - 成功率
   - 平均响应时间
   - P95/P99 响应时间

2. **错误指标**
   - 错误率（按错误类型）
   - 重试次数
   - 降级次数

3. **资源使用指标**
   - Token 使用量
   - 文件存储使用量
   - 缓存命中率

4. **业务指标**
   - 文本生成请求数
   - 图像分析请求数
   - 图像生成请求数
   - 文件上传数

### 告警规则

- 错误率超过 5%
- 平均响应时间超过 10 秒
- Token 使用量接近配额 80%
- 文件存储使用量超过 80%

## 部署和配置

### 环境变量

```bash
# Gemini API 配置
GEMINI_API_KEY=your_api_key_here
GEMINI_DEFAULT_TEXT_MODEL=gemini-2.0-flash
GEMINI_DEFAULT_IMAGE_MODEL=imagen-3.0-generate-002
GEMINI_DEFAULT_VISION_MODEL=gemini-2.0-flash

# 性能配置
GEMINI_MAX_CONCURRENT_REQUESTS=10
GEMINI_REQUEST_TIMEOUT=30000
GEMINI_MAX_RETRIES=3

# 缓存配置
GEMINI_CACHE_ENABLED=true
GEMINI_CACHE_TTL=3600

# Mock 模式
MOCK_MODE=false

# 日志配置
LOG_LEVEL=info
```

### 依赖更新

```json
{
  "dependencies": {
    "@google/genai": "^1.0.0",
    "fast-check": "^3.0.0"
  }
}
```

### 迁移步骤

1. 安装新的 SDK: `npm install @google/genai`
2. 更新导入语句
3. 重构服务类以使用新的 API
4. 更新测试
5. 验证功能
6. 移除旧的 SDK: `npm uninstall @google/generative-ai`

## 未来扩展

1. **视频生成支持**: 集成 Veo 模型进行视频生成
2. **音频处理**: 支持语音转文本和文本转语音
3. **批处理 API**: 支持批量处理请求以提高效率
4. **自定义模型**: 支持使用微调的自定义模型
5. **多语言支持**: 优化多语言内容生成
