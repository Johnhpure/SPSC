/**
 * Gemini API 管理后台路由
 * 提供配置管理、密钥管理、日志查询、测速和统计等功能的 REST API
 */

import { Router } from 'express';
import { requireAdminAuth, auditLog } from '../middleware/auth';
import {
  getAdminConfigService,
  ConfigServiceError,
  getAdminKeyService,
  getLogQueryService,
  getBenchmarkService,
  getStatisticsService,
} from '../services/gemini-admin/index';

const router = Router();

// 应用全局中间件：所有管理后台接口都需要管理员认证
router.use(requireAdminAuth);

// ============================================================================
// 配置管理 API
// ============================================================================

/**
 * GET /api/gemini-admin/config
 * 获取当前 Gemini API 配置
 */
router.get('/config', async (req, res) => {
  try {
    const configService = getAdminConfigService();
    const config = await configService.getConfig();
    
    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取配置失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_GET_FAILED',
        message,
      },
    });
  }
});

/**
 * PUT /api/gemini-admin/config
 * 更新 Gemini API 配置
 */
router.put('/config', auditLog('config_update'), async (req, res) => {
  try {
    const configService = getAdminConfigService();
    const updates = req.body;
    
    const updatedConfig = await configService.updateConfig(updates);
    
    res.json({
      success: true,
      data: updatedConfig,
      message: '配置更新成功',
    });
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CONFIG_UPDATE_FAILED',
          message: error.message,
        },
      });
    } else {
      const message = error instanceof Error ? error.message : '更新配置失败';
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_UPDATE_FAILED',
          message,
        },
      });
    }
  }
});

/**
 * POST /api/gemini-admin/config/validate-url
 * 验证 Base URL 的有效性
 */
router.post('/config/validate-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'URL 参数缺失',
        },
      });
      return;
    }
    
    const configService = getAdminConfigService();
    configService.validateBaseUrl(url);
    
    res.json({
      success: true,
      message: 'URL 格式有效',
    });
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: error.message,
        },
      });
    } else {
      const message = error instanceof Error ? error.message : 'URL 验证失败';
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message,
        },
      });
    }
  }
});

/**
 * GET /api/gemini-admin/models
 * 获取可用模型列表
 */
router.get('/models', async (req, res) => {
  try {
    const configService = getAdminConfigService();
    const { apiKey, refresh } = req.query;
    
    // 如果请求刷新，清除缓存
    if (refresh === 'true') {
      configService.clearModelListCache();
    }
    
    const models = await configService.fetchModelList(apiKey as string | undefined);
    
    res.json({
      success: true,
      data: models,
      count: models.length,
    });
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MODEL_LIST_FAILED',
          message: error.message,
        },
      });
    } else {
      const message = error instanceof Error ? error.message : '获取模型列表失败';
      res.status(500).json({
        success: false,
        error: {
          code: 'MODEL_LIST_FAILED',
          message,
        },
      });
    }
  }
});

/**
 * POST /api/gemini-admin/config/export
 * 导出配置为 JSON 文件
 */
router.post('/config/export', auditLog('config_export'), async (req, res) => {
  try {
    const configService = getAdminConfigService();
    const { includeApiKeys } = req.body;
    
    const configJson = await configService.exportConfig(includeApiKeys === true);
    
    // 设置响应头，提示浏览器下载文件
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gemini-config-${Date.now()}.json"`);
    
    res.send(configJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出配置失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_EXPORT_FAILED',
        message,
      },
    });
  }
});

/**
 * POST /api/gemini-admin/config/import
 * 导入配置 JSON 文件
 */
router.post('/config/import', auditLog('config_import'), async (req, res) => {
  try {
    const { configJson } = req.body;
    
    if (!configJson) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '配置数据缺失',
        },
      });
      return;
    }
    
    const configService = getAdminConfigService();
    const importedConfig = await configService.importConfig(
      typeof configJson === 'string' ? configJson : JSON.stringify(configJson)
    );
    
    res.json({
      success: true,
      data: importedConfig,
      message: '配置导入成功',
    });
  } catch (error) {
    if (error instanceof ConfigServiceError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CONFIG_IMPORT_FAILED',
          message: error.message,
        },
      });
    } else {
      const message = error instanceof Error ? error.message : '导入配置失败';
      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_IMPORT_FAILED',
          message,
        },
      });
    }
  }
});

// ============================================================================
// 密钥管理 API
// ============================================================================

/**
 * GET /api/gemini-admin/keys
 * 获取所有 API Key 列表（脱敏显示）
 */
router.get('/keys', async (req, res) => {
  try {
    const keyService = getAdminKeyService();
    const keys = await keyService.listKeys();
    
    res.json({
      success: true,
      data: keys,
      count: keys.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取密钥列表失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'KEY_LIST_FAILED',
        message,
      },
    });
  }
});

/**
 * POST /api/gemini-admin/keys
 * 添加单个 API Key
 */
router.post('/keys', auditLog('key_add'), async (req, res) => {
  try {
    const { name, keyValue, priority } = req.body;
    
    if (!name || !keyValue) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '密钥名称和值不能为空',
        },
      });
      return;
    }
    
    const keyService = getAdminKeyService();
    const addedKey = await keyService.addKey(name, keyValue, priority);
    
    res.json({
      success: true,
      data: addedKey,
      message: '密钥添加成功',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '添加密钥失败';
    res.status(400).json({
      success: false,
      error: {
        code: 'KEY_ADD_FAILED',
        message,
      },
    });
  }
});

/**
 * POST /api/gemini-admin/keys/batch
 * 批量添加 API Key
 */
router.post('/keys/batch', auditLog('key_batch_add'), async (req, res) => {
  try {
    const { keys } = req.body;
    
    if (!Array.isArray(keys) || keys.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '密钥数组不能为空',
        },
      });
      return;
    }
    
    const keyService = getAdminKeyService();
    const addedKeys = await keyService.addMultipleKeys(keys);
    
    res.json({
      success: true,
      data: addedKeys,
      count: addedKeys.length,
      message: `成功添加 ${addedKeys.length} 个密钥`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '批量添加密钥失败';
    res.status(400).json({
      success: false,
      error: {
        code: 'KEY_BATCH_ADD_FAILED',
        message,
      },
    });
  }
});

/**
 * PUT /api/gemini-admin/keys/:id
 * 更新指定 API Key
 */
router.put('/keys/:id', auditLog('key_update'), async (req, res) => {
  try {
    const keyId = parseInt(req.params.id || '0', 10);
    
    if (isNaN(keyId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '无效的密钥 ID',
        },
      });
      return;
    }
    
    const updates = req.body;
    const keyService = getAdminKeyService();
    const updatedKey = await keyService.updateKey(keyId, updates);
    
    res.json({
      success: true,
      data: updatedKey,
      message: '密钥更新成功',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新密钥失败';
    res.status(400).json({
      success: false,
      error: {
        code: 'KEY_UPDATE_FAILED',
        message,
      },
    });
  }
});

/**
 * DELETE /api/gemini-admin/keys/:id
 * 删除指定 API Key
 */
router.delete('/keys/:id', auditLog('key_delete'), async (req, res) => {
  try {
    const keyId = parseInt(req.params.id || '0', 10);
    
    if (isNaN(keyId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '无效的密钥 ID',
        },
      });
      return;
    }
    
    const keyService = getAdminKeyService();
    await keyService.deleteKey(keyId);
    
    res.json({
      success: true,
      message: '密钥删除成功',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除密钥失败';
    res.status(400).json({
      success: false,
      error: {
        code: 'KEY_DELETE_FAILED',
        message,
      },
    });
  }
});

/**
 * PATCH /api/gemini-admin/keys/:id/toggle
 * 切换 API Key 的启用/禁用状态
 */
router.patch('/keys/:id/toggle', auditLog('key_toggle'), async (req, res) => {
  try {
    const keyId = parseInt(req.params.id || '0', 10);
    
    if (isNaN(keyId)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '无效的密钥 ID',
        },
      });
      return;
    }
    
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'isActive 参数必须是布尔值',
        },
      });
      return;
    }
    
    const keyService = getAdminKeyService();
    const updatedKey = await keyService.toggleKeyStatus(keyId, isActive);
    
    res.json({
      success: true,
      data: updatedKey,
      message: `密钥已${isActive ? '启用' : '禁用'}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '切换密钥状态失败';
    res.status(400).json({
      success: false,
      error: {
        code: 'KEY_TOGGLE_FAILED',
        message,
      },
    });
  }
});

// ============================================================================
// 日志查询 API
// ============================================================================

/**
 * GET /api/gemini-admin/logs
 * 查询调用日志（支持过滤和分页）
 */
router.get('/logs', async (req, res) => {
  try {
    const logQueryService = await getLogQueryService();
    
    // 从查询参数构建查询条件
    const query = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      modelName: req.query.modelName as string | undefined,
      service: req.query.service as string | undefined,
      status: req.query.status as 'success' | 'error' | undefined,
      keyword: req.query.keyword as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined,
    };
    
    const result = await logQueryService.queryLogs(query);
    
    res.json({
      success: true,
      data: result.logs,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询日志失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'LOG_QUERY_FAILED',
        message,
      },
    });
  }
});

/**
 * GET /api/gemini-admin/logs/:requestId
 * 获取指定日志的详细信息
 */
router.get('/logs/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    const logQueryService = await getLogQueryService();
    const log = await logQueryService.getLogDetail(requestId);
    
    if (!log) {
      res.status(404).json({
        success: false,
        error: {
          code: 'LOG_NOT_FOUND',
          message: '日志不存在',
        },
      });
      return;
    }
    
    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取日志详情失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'LOG_DETAIL_FAILED',
        message,
      },
    });
  }
});

/**
 * POST /api/gemini-admin/logs/export
 * 导出日志数据
 */
router.post('/logs/export', auditLog('logs_export'), async (req, res) => {
  try {
    const { query, format = 'json' } = req.body;
    
    if (!['json', 'csv', 'excel'].includes(format)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: '不支持的导出格式，仅支持 json、csv、excel',
        },
      });
      return;
    }
    
    const logQueryService = await getLogQueryService();
    const filepath = await logQueryService.exportLogs(query || {}, format);
    
    res.json({
      success: true,
      data: {
        filepath,
        downloadUrl: `/exports/${filepath.split('/').pop()}`,
      },
      message: '日志导出成功',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出日志失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'LOG_EXPORT_FAILED',
        message,
      },
    });
  }
});

// ============================================================================
// 测速 API
// ============================================================================

/**
 * POST /api/gemini-admin/benchmark
 * 测试单个模型的性能
 */
router.post('/benchmark', async (req, res) => {
  try {
    const { modelName, options } = req.body;
    
    if (!modelName) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '模型名称不能为空',
        },
      });
      return;
    }
    
    const benchmarkService = getBenchmarkService();
    const result = await benchmarkService.benchmarkModel(modelName, options || {});
    
    res.json({
      success: true,
      data: result,
      message: '测速完成',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '测速失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'BENCHMARK_FAILED',
        message,
      },
    });
  }
});

/**
 * POST /api/gemini-admin/benchmark/batch
 * 批量测试多个模型的性能
 */
router.post('/benchmark/batch', async (req, res) => {
  try {
    const { modelNames, options } = req.body;
    
    if (!Array.isArray(modelNames) || modelNames.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '模型名称数组不能为空',
        },
      });
      return;
    }
    
    const benchmarkService = getBenchmarkService();
    const results = await benchmarkService.benchmarkMultipleModels(modelNames, options || {});
    
    res.json({
      success: true,
      data: results,
      count: results.length,
      message: `批量测速完成，共测试 ${results.length} 个模型`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '批量测速失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'BATCH_BENCHMARK_FAILED',
        message,
      },
    });
  }
});

/**
 * GET /api/gemini-admin/benchmark/history
 * 获取测速历史记录
 */
router.get('/benchmark/history', async (req, res) => {
  try {
    const { modelName, limit } = req.query;
    
    const benchmarkService = getBenchmarkService();
    const history = await benchmarkService.getBenchmarkHistory(
      modelName as string | undefined,
      limit ? parseInt(limit as string, 10) : undefined
    );
    
    res.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取测速历史失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'BENCHMARK_HISTORY_FAILED',
        message,
      },
    });
  }
});

/**
 * POST /api/gemini-admin/test
 * 功能测试（自定义提示词测试）
 */
router.post('/test', async (req, res) => {
  try {
    const { modelName, testType, prompt, imageData, imageMimeType } = req.body;
    
    if (!modelName || !testType || !prompt) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: '模型名称、测试类型和提示词不能为空',
        },
      });
      return;
    }
    
    if (!['text', 'vision', 'image-gen'].includes(testType)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TEST_TYPE',
          message: '测试类型必须是 text、vision 或 image-gen',
        },
      });
      return;
    }
    
    const benchmarkService = getBenchmarkService();
    const result = await benchmarkService.testModelFunction({
      modelName,
      testType,
      prompt,
      imageData,
      imageMimeType,
    });
    
    res.json({
      success: true,
      data: result,
      message: '功能测试完成',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '功能测试失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'FUNCTION_TEST_FAILED',
        message,
      },
    });
  }
});

// ============================================================================
// 统计 API
// ============================================================================

/**
 * GET /api/gemini-admin/statistics
 * 获取综合统计数据
 */
router.get('/statistics', async (req, res) => {
  try {
    const statisticsService = getStatisticsService();
    
    // 构建查询条件
    const query = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      modelName: req.query.modelName as string | undefined,
      service: req.query.service as string | undefined,
      status: req.query.status as 'success' | 'error' | undefined,
    };
    
    const statistics = await statisticsService.getStatistics(query);
    
    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取统计数据失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'STATISTICS_FAILED',
        message,
      },
    });
  }
});

/**
 * GET /api/gemini-admin/statistics/timeseries
 * 获取时间序列数据
 */
router.get('/statistics/timeseries', async (req, res) => {
  try {
    const { granularity = 'day' } = req.query;
    
    if (!['hour', 'day', 'week'].includes(granularity as string)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GRANULARITY',
          message: '时间粒度必须是 hour、day 或 week',
        },
      });
      return;
    }
    
    const statisticsService = getStatisticsService();
    
    // 构建查询条件
    const query = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      modelName: req.query.modelName as string | undefined,
      service: req.query.service as string | undefined,
      status: req.query.status as 'success' | 'error' | undefined,
    };
    
    const timeSeriesData = await statisticsService.getTimeSeriesData(
      query,
      granularity as 'hour' | 'day' | 'week'
    );
    
    res.json({
      success: true,
      data: timeSeriesData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取时间序列数据失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'TIMESERIES_FAILED',
        message,
      },
    });
  }
});

/**
 * GET /api/gemini-admin/statistics/distribution
 * 获取模型使用分布数据
 */
router.get('/statistics/distribution', async (req, res) => {
  try {
    const statisticsService = getStatisticsService();
    
    // 构建查询条件
    const query = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      service: req.query.service as string | undefined,
      status: req.query.status as 'success' | 'error' | undefined,
    };
    
    const distribution = await statisticsService.getModelUsageDistribution(query);
    
    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取分布数据失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'DISTRIBUTION_FAILED',
        message,
      },
    });
  }
});

/**
 * GET /api/gemini-admin/statistics/cost
 * 获取成本分析数据
 */
router.get('/statistics/cost', async (req, res) => {
  try {
    const statisticsService = getStatisticsService();
    
    // 构建查询条件
    const query = {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      modelName: req.query.modelName as string | undefined,
      service: req.query.service as string | undefined,
      status: req.query.status as 'success' | 'error' | undefined,
    };
    
    const costAnalysis = await statisticsService.getCostAnalysis(query);
    
    res.json({
      success: true,
      data: costAnalysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取成本分析失败';
    res.status(500).json({
      success: false,
      error: {
        code: 'COST_ANALYSIS_FAILED',
        message,
      },
    });
  }
});

export default router;