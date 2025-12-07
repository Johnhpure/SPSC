/**
 * ConfigManager 单元测试
 * 
 * 测试配置管理器的核心功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager, getConfigManager, getConfig, ConfigValidationError } from './config-manager';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testConfigPath: string;
  let originalMockMode: string | undefined;

  beforeEach(() => {
    // 保存原始 MOCK_MODE
    originalMockMode = process.env.MOCK_MODE;
    
    // 设置 MOCK_MODE 以避免 API 密钥验证
    process.env.MOCK_MODE = 'true';
    
    // 获取单例实例
    configManager = ConfigManager.getInstance();
    
    // 设置测试配置文件路径
    testConfigPath = path.join(process.cwd(), 'test-gemini-config.json');
    configManager.setConfigFilePath(testConfigPath);
    
    // 清理测试配置文件
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  afterEach(() => {
    // 清理测试配置文件
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    
    // 停止监听
    if (configManager) {
      configManager.stopWatching();
    }
    
    // 恢复原始 MOCK_MODE
    if (originalMockMode !== undefined) {
      process.env.MOCK_MODE = originalMockMode;
    } else {
      delete process.env.MOCK_MODE;
    }
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = ConfigManager.getInstance();
      const instance2 = ConfigManager.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('getConfigManager 应该返回单例实例', () => {
      const instance1 = getConfigManager();
      const instance2 = getConfigManager();
      expect(instance1).toBe(instance2);
    });
  });

  describe('配置加载', () => {
    it('应该加载默认配置', () => {
      const config = configManager.getConfig();
      expect(config).toBeDefined();
      expect(config.defaultTextModel).toBeDefined();
      expect(config.maxConcurrentRequests).toBeGreaterThan(0);
    });

    it('应该从 JSON 文件加载配置', () => {
      // 清除可能影响测试的环境变量
      const originalEnv = process.env.GEMINI_DEFAULT_TEXT_MODEL;
      delete process.env.GEMINI_DEFAULT_TEXT_MODEL;

      // 创建测试配置文件
      const testConfig = {
        defaultTextModel: 'test-model',
        maxConcurrentRequests: 20,
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // 重新加载配置
      configManager.reload();

      const config = configManager.getConfig();
      expect(config.defaultTextModel).toBe('test-model');
      expect(config.maxConcurrentRequests).toBe(20);

      // 恢复环境变量
      if (originalEnv !== undefined) {
        process.env.GEMINI_DEFAULT_TEXT_MODEL = originalEnv;
      }
    });

    it('应该使用环境变量覆盖配置', () => {
      // 创建测试配置文件
      const testConfig = {
        defaultTextModel: 'file-model',
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // 设置环境变量
      const originalEnv = process.env.GEMINI_DEFAULT_TEXT_MODEL;
      process.env.GEMINI_DEFAULT_TEXT_MODEL = 'env-model';

      // 重新加载配置
      configManager.reload();

      const config = configManager.getConfig();
      expect(config.defaultTextModel).toBe('env-model');

      // 恢复环境变量
      if (originalEnv !== undefined) {
        process.env.GEMINI_DEFAULT_TEXT_MODEL = originalEnv;
      } else {
        delete process.env.GEMINI_DEFAULT_TEXT_MODEL;
      }
    });
  });

  describe('配置验证', () => {
    it('应该验证数值范围', () => {
      // 清除环境变量以避免干扰
      const originalEnv = process.env.GEMINI_MAX_CONCURRENT_REQUESTS;
      delete process.env.GEMINI_MAX_CONCURRENT_REQUESTS;

      // 创建无效配置
      const invalidConfig = {
        maxConcurrentRequests: 200, // 超出范围
        mockMode: true, // 避免 API 密钥验证
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

      // 应该抛出验证错误
      expect(() => configManager.reload()).toThrow(ConfigValidationError);

      // 恢复环境变量
      if (originalEnv !== undefined) {
        process.env.GEMINI_MAX_CONCURRENT_REQUESTS = originalEnv;
      }
    });

    it('应该验证日志级别', () => {
      // 清除环境变量以避免干扰
      const originalEnv = process.env.LOG_LEVEL;
      delete process.env.LOG_LEVEL;

      // 创建无效配置
      const invalidConfig = {
        logLevel: 'invalid',
        mockMode: true, // 避免 API 密钥验证
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(invalidConfig, null, 2));

      // 应该抛出验证错误
      expect(() => configManager.reload()).toThrow(ConfigValidationError);

      // 恢复环境变量
      if (originalEnv !== undefined) {
        process.env.LOG_LEVEL = originalEnv;
      }
    });

    it('在 MOCK_MODE 下应该允许空 API 密钥', () => {
      // 创建配置
      const testConfig = {
        apiKey: '',
        mockMode: true,
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // 不应该抛出错误
      expect(() => configManager.reload()).not.toThrow();
    });
  });

  describe('配置访问', () => {
    it('应该获取完整配置', () => {
      const config = configManager.getConfig();
      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('defaultTextModel');
      expect(config).toHaveProperty('maxConcurrentRequests');
    });

    it('应该获取特定配置项', () => {
      const textModel = configManager.get('defaultTextModel');
      expect(textModel).toBe('gemini-2.0-flash');
    });

    it('getConfig 便捷方法应该工作', () => {
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config).toHaveProperty('defaultTextModel');
    });
  });

  describe('配置热更新', () => {
    it('应该监听配置文件变化', (done) => {
      // 创建初始配置文件
      const initialConfig = {
        defaultTextModel: 'initial-model',
      };
      fs.writeFileSync(testConfigPath, JSON.stringify(initialConfig, null, 2));
      configManager.reload();

      // 注册变更回调
      const callback = vi.fn((newConfig) => {
        expect(newConfig.defaultTextModel).toBe('updated-model');
        done();
      });
      configManager.onConfigChange(callback);

      // 启动监听
      configManager.startWatching();

      // 修改配置文件
      setTimeout(() => {
        const updatedConfig = {
          defaultTextModel: 'updated-model',
        };
        fs.writeFileSync(testConfigPath, JSON.stringify(updatedConfig, null, 2));
      }, 100);
    }, 5000);

    it('应该支持移除变更回调', () => {
      const callback = vi.fn();
      configManager.onConfigChange(callback);
      configManager.offConfigChange(callback);

      // 重新加载配置
      configManager.reload();

      // 回调不应该被调用
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('配置重置', () => {
    it('应该重置配置管理器', () => {
      // 注册回调
      const callback = vi.fn();
      configManager.onConfigChange(callback);

      // 重置
      configManager.reset();

      // 重新加载配置
      configManager.reload();

      // 回调不应该被调用（因为已被清除）
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
