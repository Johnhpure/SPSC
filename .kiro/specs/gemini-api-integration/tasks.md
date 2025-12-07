# Gemini API 完整集成实施计划

本文档定义了将 Google Gemini API 完整集成到后端服务的分步实施任务。每个任务都是可独立执行的代码实现步骤,按照依赖关系排序。

## 任务列表

- [x] 1. 项目准备和依赖升级
  - 安装新的 @google/genai SDK
  - 更新 package.json 中的依赖版本
  - 配置 TypeScript 以支持新的 SDK 类型
  - 更新环境变量配置文件（添加 GEMINI_API_KEY 等）
  - _需求: 1.1, 8.1_

- [x] 2. 实现 GeminiClientManager 单例管理器
  - 创建 `backend/src/services/gemini/client-manager.ts`
  - 实现单例模式和客户端初始化逻辑
  - 实现 API 密钥验证和错误处理
  - 添加 MOCK_MODE 支持
  - _需求: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. 实现 ErrorHandler 错误处理和重试模块
  - 创建 `backend/src/services/gemini/error-handler.ts`
  - 实现重试逻辑和指数退避算法
  - 实现错误分类和可重试判断
  - 实现降级策略
  - _需求: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 4. 实现 Logger 日志和监控模块
  - 创建 `backend/src/services/gemini/logger.ts`
  - 实现结构化日志记录
  - 实现指标收集功能
  - 添加日志级别控制
  - _需求: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 5. 实现 GeminiTextService 文本生成服务
  - 创建 `backend/src/services/gemini/text-service.ts`
  - 实现通用文本生成方法
  - 实现类目推荐功能
  - 实现产品分析功能
  - 集成 ErrorHandler 和 Logger
  - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. 实现 GeminiFileService 文件管理服务
  - 创建 `backend/src/services/gemini/file-service.ts`
  - 实现文件上传功能
  - 实现文件列表查询（支持分页）
  - 实现文件删除功能
  - 实现 MIME 类型验证
  - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 7. 实现 GeminiImageService 图像服务
  - 创建 `backend/src/services/gemini/image-service.ts`
  - 实现图像分析功能（支持 URL 和 Buffer）
  - 实现图像 URL 下载和转换
  - 实现多模态 Content 对象创建
  - 实现图像生成功能
  - 实现图像保存到本地文件系统
  - 实现产品图像优化功能
  - _需求: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 8. 实现 GeminiStreamService 流式响应服务
  - 创建 `backend/src/services/gemini/stream-service.ts`
  - 实现流式内容生成（AsyncGenerator）
  - 实现 SSE 集成
  - 实现流式错误处理
  - _需求: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. 更新现有服务以使用新的 Gemini 服务
  - 重构 `backend/src/services/gemini-text.ts` 使用新的 GeminiTextService
  - 重构 `backend/src/services/gemini-image.ts` 使用新的 GeminiImageService
  - 更新所有导入语句
  - 确保向后兼容性
  - _需求: 2.1, 3.1, 4.1_

- [x] 10. 编写单元测试和属性测试
  - 为所有核心服务编写单元测试
  - 实现属性测试验证正确性属性
  - 确保测试覆盖率达到要求
  - _需求: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 11. 添加 Express API 端点






  - 创建 `backend/src/routes/gemini.ts` 路由文件
  - 添加文本生成端点 POST /api/gemini/text
  - 添加图像分析端点 POST /api/gemini/image/analyze
  - 添加图像生成端点 POST /api/gemini/image/generate
  - 添加流式生成端点 GET /api/gemini/stream
  - 添加文件管理端点 POST/GET/DELETE /api/gemini/files
  - 在 app.ts 中集成新的路由
  - 初始化 GeminiClientManager（在应用启动时）
  - _需求: 2.1, 3.1, 4.1, 5.1, 6.1_

- [x] 12. 实现配置管理模块





  - 创建 `backend/src/services/gemini/config-manager.ts`
  - 实现配置文件读取（支持 JSON 配置文件）
  - 实现环境变量覆盖机制
  - 实现配置验证和默认值
  - 实现配置热更新监听（使用 fs.watch）
  - 导出配置访问接口
  - _需求: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 13. 添加缓存层（可选优化）




  - 创建 `backend/src/services/gemini/cache.ts`
  - 实现 LRU 缓存机制
  - 为文本生成添加缓存（基于提示词哈希）
  - 为图像分析添加缓存（基于图像 URL 或哈希）
  - 为文件 URI 添加缓存
  - 实现缓存过期和清理策略
  - 添加缓存统计和监控
  - _需求: 性能优化_

- [ ] 14. 扩展监控和指标收集（可选优化）




  - 扩展 Logger 模块添加更多指标类型
  - 实现 API 调用计数器（按服务和方法分类）
  - 实现响应时间分布统计（P50, P95, P99）
  - 实现错误率统计和分类
  - 添加告警阈值检查和通知机制
  - 创建指标导出接口（Prometheus 格式）
  - _需求: 9.4, 9.5_

- [ ] 15. 创建 API 使用文档
  - 创建 `docs/gemini-api-integration.md` 文档
  - 编写 API 端点使用说明
  - 添加代码示例和最佳实践
  - 编写配置指南
  - 创建从旧 SDK 的迁移指南
  - 添加故障排查指南
  - _需求: 文档_

- [x] 16. 最终清理和优化





  - 检查并移除旧的 @google/generative-ai 依赖（如果不再使用）
  - 删除废弃的代码和注释
  - 优化导入语句和模块结构
  - 运行代码格式化工具
  - 运行 lint 检查并修复问题
  - 验证所有测试通过
  - _需求: 代码质量_

## 注意事项

1. **增量开发**: 每个任务完成后进行验证，确保功能正常
2. **向后兼容**: 确保现有功能不受影响
3. **错误处理**: 所有服务都要有完善的错误处理
4. **日志记录**: 关键操作都要记录日志
5. **MOCK_MODE**: 所有服务都要支持 Mock 模式以便测试

## 依赖关系

- 任务 1-10 已完成 ✅
- 任务 11 是核心集成任务，需要优先完成
- 任务 12 可以与任务 11 并行开发
- 任务 13-14 是可选的性能优化任务
- 任务 15 在核心功能完成后编写
- 任务 16 在所有功能完成后执行

## 实施状态总结

### 已完成 ✅
- SDK 升级到 @google/genai v1.0.0
- 所有核心服务模块实现完成
- 完整的单元测试和属性测试覆盖
- 旧服务适配器实现向后兼容

### 待完成 🔄
- Express API 路由集成（任务 11）
- 配置管理模块（任务 12）
- 可选的性能优化（任务 13-14）
- 文档和清理（任务 15-16）
