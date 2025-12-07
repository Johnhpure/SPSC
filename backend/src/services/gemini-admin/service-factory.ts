/**
 * Gemini 服务工厂
 * 负责创建并包装 Gemini 服务实例，自动应用日志拦截器
 */

import { GeminiTextService } from '../gemini/text-service';
import { GeminiImageService } from '../gemini/image-service';
import { GeminiFileService } from '../gemini/file-service';
import { GeminiStreamService } from '../gemini/stream-service';
import { getLoggingInterceptor } from './logging-interceptor';

/**
 * 服务工厂类
 * 提供创建已包装日志拦截器的服务实例的方法
 */
export class GeminiServiceFactory {
  private static textServiceInstance: GeminiTextService | null = null;
  private static imageServiceInstance: GeminiImageService | null = null;
  private static fileServiceInstance: GeminiFileService | null = null;
  private static streamServiceInstance: GeminiStreamService | null = null;

  /**
   * 获取文本服务实例（带日志拦截）
   * @returns 包装后的 GeminiTextService 实例
   */
  static getTextService(): GeminiTextService {
    if (!this.textServiceInstance) {
      const interceptor = getLoggingInterceptor();
      const rawService = new GeminiTextService();
      this.textServiceInstance = interceptor.wrapService(rawService, 'text');
    }
    return this.textServiceInstance;
  }

  /**
   * 获取图像服务实例（带日志拦截）
   * @returns 包装后的 GeminiImageService 实例
   */
  static getImageService(): GeminiImageService {
    if (!this.imageServiceInstance) {
      const interceptor = getLoggingInterceptor();
      const rawService = new GeminiImageService();
      this.imageServiceInstance = interceptor.wrapService(rawService, 'image');
    }
    return this.imageServiceInstance;
  }

  /**
   * 获取文件服务实例（带日志拦截）
   * @returns 包装后的 GeminiFileService 实例
   */
  static getFileService(): GeminiFileService {
    if (!this.fileServiceInstance) {
      const interceptor = getLoggingInterceptor();
      const rawService = new GeminiFileService();
      this.fileServiceInstance = interceptor.wrapService(rawService, 'file');
    }
    return this.fileServiceInstance;
  }

  /**
   * 获取流式服务实例（带日志拦截）
   * @returns 包装后的 GeminiStreamService 实例
   */
  static getStreamService(): GeminiStreamService {
    if (!this.streamServiceInstance) {
      const interceptor = getLoggingInterceptor();
      const rawService = new GeminiStreamService();
      this.streamServiceInstance = interceptor.wrapService(rawService, 'stream');
    }
    return this.streamServiceInstance;
  }

  /**
   * 重置所有服务实例（主要用于测试）
   */
  static reset(): void {
    this.textServiceInstance = null;
    this.imageServiceInstance = null;
    this.fileServiceInstance = null;
    this.streamServiceInstance = null;
  }
}

/**
 * 便捷导出函数
 */
export const getTextService = () => GeminiServiceFactory.getTextService();
export const getImageService = () => GeminiServiceFactory.getImageService();
export const getFileService = () => GeminiServiceFactory.getFileService();
export const getStreamService = () => GeminiServiceFactory.getStreamService();
