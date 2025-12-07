/**
 * AdminConfigService 单元测试
 * 
 * 测试配置管理服务的核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminConfigService, ConfigServiceError } from './config-service';
import { getDb } from '../../db';

describe('AdminConfigService', () => {
  let service: AdminConfigService;

  beforeEach(async () => {
    service = new AdminConfigService();
    
    // 确保数据库已初始化
    const db = await getDb();
    
    // 重置配置为默认值
    await db.run(`
      UPDATE gemini_configs 
      SET base_url = 'https://generativelanguage.googleapis.com',
          default_text_model = 'gemini-2.0-flash',
          default_vision_model = 'gemini-2.0-flash',
          default_image_gen_model = 'imagen-3.0-generate-002',
          timeout = 30000,
          max_retries = 3
      WHERE id = 1
    `);
  });

  describe('配置获取', () => {
    it('应该获取当前配置', async () => {
      const config = await service.getConfig();
      
      expect(config).toBeDefined();
      expect(config.id).toBe(1);
      expect(config.baseUrl).toBe('https://generativelanguage.googleapis.com');
      expect(config.defaultTextModel).toBe('gemini-2.0-flash');
      expect(config.defaultVisionModel).toBe('gemini-2.0-flash');
      expect(config.defaultImageGenModel).toBe('imagen-3.0-generate-002');
      expect(config.timeout).toBe(30000);
      expect(config.maxRetries).toBe(3);
    });
  });

  describe('配置更新', () => {
    it('应该更新 Base URL', async () => {
      const newUrl = 'https://custom-api.example.com';
      const updated = await service.updateConfig({ baseUrl: newUrl });
      
      expect(updated.baseUrl).toBe(newUrl);
      
      // 验证持久化
      const config = await service.getConfig();
      expect(config.baseUrl).toBe(newUrl);
    });

    it('应该更新默认模型', async () => {
      const updated = await service.updateConfig({
        defaultTextModel: 'gemini-1.5-pro',
        defaultVisionModel: 'gemini-1.5-pro-vision',
      });
      
      expect(updated.defaultTextModel).toBe('gemini-1.5-pro');
      expect(updated.defaultVisionModel).toBe('gemini-1.5-pro-vision');
    });

    it('应该更新超时和重试设置', async () => {
      const updated = await service.updateConfig({
        timeout: 60000,
        maxRetries: 5,
      });
      
      expect(updated.timeout).toBe(60000);
      expect(updated.maxRetries).toBe(5);
    });

    it('应该支持部分更新', async () => {
      const original = await service.getConfig();
      const updated = await service.updateConfig({
        defaultTextModel: 'new-model',
      });
      
      expect(updated.defaultTextModel).toBe('new-model');
      expect(updated.baseUrl).toBe(original.baseUrl); // 其他字段不变
      expect(updated.timeout).toBe(original.timeout);
    });
  });

  describe('URL 验证', () => {
    it('应该接受有效的 HTTP URL', () => {
      expect(() => service.validateBaseUrl('http://example.com')).not.toThrow();
    });

    it('应该接受有效的 HTTPS URL', () => {
      expect(() => service.validateBaseUrl('https://example.com')).not.toThrow();
    });

    it('应该接受带端口的 URL', () => {
      expect(() => service.validateBaseUrl('https://example.com:8080')).not.toThrow();
    });

    it('应该接受带路径的 URL', () => {
      expect(() => service.validateBaseUrl('https://example.com/api/v1')).not.toThrow();
    });

    it('应该拒绝空 URL', () => {
      expect(() => service.validateBaseUrl('')).toThrow(ConfigServiceError);
      expect(() => service.validateBaseUrl('   ')).toThrow(ConfigServiceError);
    });

    it('应该拒绝无效协议', () => {
      expect(() => service.validateBaseUrl('ftp://example.com')).toThrow(ConfigServiceError);
      expect(() => service.validateBaseUrl('file:///path/to/file')).toThrow(ConfigServiceError);
    });

    it('应该拒绝格式错误的 URL', () => {
      expect(() => service.validateBaseUrl('not-a-url')).toThrow(ConfigServiceError);
      expect(() => service.validateBaseUrl('://invalid')).toThrow(ConfigServiceError);
    });

    it('更新配置时应该验证 URL', async () => {
      await expect(
        service.updateConfig({ baseUrl: 'invalid-url' })
      ).rejects.toThrow(ConfigServiceError);
    });
  });

  describe('配置导出', () => {
    it('应该导出配置为 JSON', async () => {
      const json = await service.exportConfig(false);
      const backup = JSON.parse(json);
      
      expect(backup).toHaveProperty('version');
      expect(backup).toHaveProperty('exportedAt');
      expect(backup).toHaveProperty('config');
      expect(backup.config).toHaveProperty('baseUrl');
      expect(backup.config).toHaveProperty('defaultTextModel');
    });

    it('导出的 JSON 应该可以解析', async () => {
      const json = await service.exportConfig(false);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('应该包含所有配置字段', async () => {
      const json = await service.exportConfig(false);
      const backup = JSON.parse(json);
      
      expect(backup.config).toHaveProperty('id');
      expect(backup.config).toHaveProperty('baseUrl');
      expect(backup.config).toHaveProperty('defaultTextModel');
      expect(backup.config).toHaveProperty('defaultVisionModel');
      expect(backup.config).toHaveProperty('defaultImageGenModel');
      expect(backup.config).toHaveProperty('timeout');
      expect(backup.config).toHaveProperty('maxRetries');
    });
  });

  describe('配置导入', () => {
    it('应该导入有效的配置', async () => {
      // 先导出
      const exported = await service.exportConfig(false);
      const backup = JSON.parse(exported);
      
      // 修改配置
      backup.config.baseUrl = 'https://new-api.example.com';
      backup.config.defaultTextModel = 'new-model';
      
      // 导入
      const imported = await service.importConfig(JSON.stringify(backup));
      
      expect(imported.baseUrl).toBe('https://new-api.example.com');
      expect(imported.defaultTextModel).toBe('new-model');
    });

    it('应该拒绝无效的 JSON', async () => {
      await expect(
        service.importConfig('invalid json')
      ).rejects.toThrow(ConfigServiceError);
    });

    it('应该拒绝缺少必要字段的配置', async () => {
      const invalid = JSON.stringify({
        version: '1.0',
        // 缺少 config 字段
      });
      
      await expect(
        service.importConfig(invalid)
      ).rejects.toThrow(ConfigServiceError);
    });

    it('应该拒绝不完整的配置', async () => {
      const invalid = JSON.stringify({
        version: '1.0',
        config: {
          baseUrl: 'https://example.com',
          // 缺少其他必要字段
        },
      });
      
      await expect(
        service.importConfig(invalid)
      ).rejects.toThrow(ConfigServiceError);
    });

    it('应该验证导入配置中的 URL', async () => {
      const invalid = JSON.stringify({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        config: {
          baseUrl: 'invalid-url',
          defaultTextModel: 'model',
          defaultVisionModel: 'model',
          defaultImageGenModel: 'model',
          timeout: 30000,
          maxRetries: 3,
        },
      });
      
      await expect(
        service.importConfig(invalid)
      ).rejects.toThrow(ConfigServiceError);
    });
  });

  describe('配置往返一致性', () => {
    it('导出后导入应该保持配置一致', async () => {
      // 设置特定配置
      await service.updateConfig({
        baseUrl: 'https://test-api.example.com',
        defaultTextModel: 'test-model',
        timeout: 45000,
        maxRetries: 4,
      });
      
      // 导出
      const exported = await service.exportConfig(false);
      
      // 修改配置
      await service.updateConfig({
        baseUrl: 'https://different.example.com',
        defaultTextModel: 'different-model',
      });
      
      // 导入
      await service.importConfig(exported);
      
      // 验证恢复
      const restored = await service.getConfig();
      expect(restored.baseUrl).toBe('https://test-api.example.com');
      expect(restored.defaultTextModel).toBe('test-model');
      expect(restored.timeout).toBe(45000);
      expect(restored.maxRetries).toBe(4);
    });
  });

  describe('模型列表缓存', () => {
    it('应该清除模型列表缓存', () => {
      expect(() => service.clearModelListCache()).not.toThrow();
    });
  });
});
