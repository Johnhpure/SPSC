/**
 * GeminiClientManager - Gemini API 客户端单例管理器
 * 
 * 职责：
 * - 管理 GoogleGenAI 客户端的生命周期
 * - 提供单例访问模式
 * - 处理 API 密钥验证
 * - 支持 MOCK_MODE
 */

import { GoogleGenAI } from '@google/genai';
import { CONFIG } from '../../config';

/**
 * Gemini 客户端管理器错误类
 */
export class GeminiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiClientError';
  }
}

/**
 * GeminiClientManager 单例类
 * 
 * 使用单例模式确保整个应用只有一个 GoogleGenAI 客户端实例
 */
export class GeminiClientManager {
  private static instance: GeminiClientManager;
  private client: GoogleGenAI | null = null;
  private initialized: boolean = false;

  /**
   * 私有构造函数，防止外部实例化
   */
  private constructor() {
    // 不在构造函数中读取 MOCK_MODE，而是在需要时动态读取
  }

  /**
   * 获取单例实例
   * @returns GeminiClientManager 实例
   */
  public static getInstance(): GeminiClientManager {
    if (!GeminiClientManager.instance) {
      GeminiClientManager.instance = new GeminiClientManager();
    }
    return GeminiClientManager.instance;
  }

  /**
   * 初始化 Gemini 客户端
   * @param apiKey - Gemini API 密钥（可选，默认从配置读取）
   * @throws {GeminiClientError} 当 API 密钥无效或初始化失败时
   */
  public initialize(apiKey?: string): void {
    // 如果已经初始化，直接返回
    if (this.initialized) {
      console.log('[GeminiClientManager] 客户端已初始化，跳过重复初始化');
      return;
    }

    // MOCK_MODE 下跳过真实客户端初始化
    if (this.isMockMode()) {
      console.log('[GeminiClientManager] MOCK_MODE 已启用，跳过真实 API 初始化');
      this.initialized = true;
      return;
    }

    // 获取 API 密钥 - 动态读取环境变量以支持测试
    const key = apiKey !== undefined ? apiKey : (process.env.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY);

    // 验证 API 密钥
    if (!key || key.trim() === '') {
      throw new GeminiClientError(
        'Gemini API 密钥缺失。请设置 GEMINI_API_KEY 环境变量或通过 initialize() 方法提供密钥。'
      );
    }

    // 基本格式验证（Gemini API 密钥通常以 'AI' 开头）
    if (key.length < 10) {
      throw new GeminiClientError(
        'Gemini API 密钥格式无效。密钥长度过短。'
      );
    }

    try {
      // 初始化 GoogleGenAI 客户端
      this.client = new GoogleGenAI({ apiKey: key });
      this.initialized = true;
      console.log('[GeminiClientManager] Gemini 客户端初始化成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new GeminiClientError(
        `Gemini 客户端初始化失败: ${errorMessage}`
      );
    }
  }

  /**
   * 获取已初始化的 Gemini 客户端
   * @returns GoogleGenAI 客户端实例
   * @throws {GeminiClientError} 当客户端未初始化或在 MOCK_MODE 下调用时
   */
  public getClient(): GoogleGenAI {
    if (this.isMockMode()) {
      throw new GeminiClientError(
        'MOCK_MODE 已启用，无法获取真实客户端。请在业务逻辑中检查 MOCK_MODE 并使用模拟数据。'
      );
    }

    if (!this.initialized || !this.client) {
      throw new GeminiClientError(
        'Gemini 客户端未初始化。请先调用 initialize() 方法。'
      );
    }

    return this.client;
  }

  /**
   * 检查客户端是否已初始化
   * @returns 是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 检查是否处于 MOCK_MODE
   * @returns 是否为 MOCK_MODE
   */
  public isMockMode(): boolean {
    // 动态读取环境变量以支持测试
    return process.env.MOCK_MODE === 'true' || CONFIG.MOCK_MODE;
  }

  /**
   * 重置客户端状态（主要用于测试）
   * @internal
   */
  public reset(): void {
    this.client = null;
    this.initialized = false;
    console.log('[GeminiClientManager] 客户端已重置');
  }
}

// 导出单例实例的便捷访问方法
export const getGeminiClientManager = () => GeminiClientManager.getInstance();
