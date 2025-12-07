/**
 * GeminiFileService - Gemini Files API 文件管理服务
 * 
 * 职责：
 * - 上传文件到 Gemini Files API
 * - 查询已上传的文件列表（支持分页）
 * - 删除指定文件
 * - 验证 MIME 类型
 * - 集成错误处理和日志记录
 */

import * as fs from 'fs';
import * as path from 'path';
import { GeminiClientManager } from './client-manager';
import { ErrorHandler } from './error-handler';
import { Logger } from './logger';

/**
 * 文件上传选项
 */
export interface UploadFileOptions {
  /** MIME 类型 */
  mimeType?: string;
  /** 显示名称 */
  displayName?: string;
}

/**
 * 文件列表查询选项
 */
export interface ListFilesOptions {
  /** 每页数量，默认 10 */
  pageSize?: number;
  /** 分页令牌 */
  pageToken?: string;
}

/**
 * 已上传文件信息
 */
export interface UploadedFile {
  /** 文件名称 */
  name: string;
  /** 文件 URI */
  uri: string;
  /** MIME 类型 */
  mimeType: string;
  /** 文件大小（字节） */
  sizeBytes: number;
  /** 创建时间 */
  createTime: string;
  /** 更新时间 */
  updateTime: string;
  /** 显示名称 */
  displayName?: string;
  /** 状态 */
  state?: string;
}

/**
 * 文件列表响应
 */
export interface FileList {
  /** 文件列表 */
  files: UploadedFile[];
  /** 下一页令牌 */
  nextPageToken?: string;
}

/**
 * 文件信息
 */
export interface FileInfo extends UploadedFile {
  /** 过期时间 */
  expirationTime?: string;
  /** SHA256 哈希 */
  sha256Hash?: string;
}

/**
 * 支持的 MIME 类型白名单
 */
const SUPPORTED_MIME_TYPES = [
  // 图像
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/heic',
  'image/heif',
  // 视频
  'video/mp4',
  'video/mpeg',
  'video/mov',
  'video/avi',
  'video/x-flv',
  'video/mpg',
  'video/webm',
  'video/wmv',
  'video/3gpp',
  // 音频
  'audio/wav',
  'audio/mp3',
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac',
  // 文档
  'application/pdf',
  'text/plain',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
];

/**
 * 最大文件大小（20MB）
 */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/**
 * GeminiFileService 类
 */
export class GeminiFileService {
  private clientManager: GeminiClientManager;
  private logger: Logger;

  constructor() {
    this.clientManager = GeminiClientManager.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * 验证 MIME 类型
   * @param mimeType - MIME 类型
   * @throws {Error} 当 MIME 类型不支持时
   */
  private validateMimeType(mimeType: string): void {
    if (!SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
      throw new Error(
        `不支持的 MIME 类型: ${mimeType}。支持的类型: ${SUPPORTED_MIME_TYPES.join(', ')}`
      );
    }
  }

  /**
   * 验证文件大小
   * @param filePath - 文件路径
   * @throws {Error} 当文件大小超过限制时
   */
  private validateFileSize(filePath: string): void {
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error(
        `文件大小超过限制: ${stats.size} 字节（最大 ${MAX_FILE_SIZE} 字节）`
      );
    }
  }

  /**
   * 上传文件到 Gemini Files API
   * @param filePath - 文件路径
   * @param options - 上传选项
   * @returns 已上传文件信息
   */
  async uploadFile(
    filePath: string,
    options: UploadFileOptions = {}
  ): Promise<UploadedFile> {
    const startTime = Date.now();

    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 验证文件大小
      this.validateFileSize(filePath);

      // 获取或推断 MIME 类型
      const mimeType = options.mimeType || this.inferMimeType(filePath);
      this.validateMimeType(mimeType);

      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 模拟文件上传', { filePath, mimeType });
        const mockFile = this.createMockUploadedFile(filePath, mimeType, options.displayName);
        
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiFileService',
          method: 'uploadFile',
          requestParams: { filePath, options },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return mockFile;
      }

      // 真实 API 调用
      const client = this.clientManager.getClient();
      
      const result = await ErrorHandler.withRetry(
        async () => {
          // 读取文件内容
          const fileBuffer = fs.readFileSync(filePath);
          
          // 创建 Blob 对象
          const blob = new Blob([fileBuffer], { type: mimeType });
          
          // 调用 Files API 上传
          const uploadResponse = await client.files.upload({
            file: blob,
            config: {
              displayName: options.displayName || path.basename(filePath),
            },
          });

          return uploadResponse;
        },
        {},
        {
          service: 'GeminiFileService',
          method: 'uploadFile',
          params: { filePath, options },
        }
      );

      // 转换响应格式
      const uploadedFile: UploadedFile = {
        name: result.name || '',
        uri: result.uri || '',
        mimeType: result.mimeType || mimeType,
        sizeBytes: typeof result.sizeBytes === 'number' ? result.sizeBytes : 0,
        createTime: result.createTime || new Date().toISOString(),
        updateTime: result.updateTime || new Date().toISOString(),
        displayName: result.displayName,
        state: result.state,
      };

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'uploadFile',
        requestParams: { filePath, options },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

      return uploadedFile;
    } catch (error) {
      this.logger.error('文件上传失败', {
        filePath,
        options,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'uploadFile',
        requestParams: { filePath, options },
        responseTime: Date.now() - startTime,
        statusCode: 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 列出已上传的文件
   * @param options - 查询选项
   * @returns 文件列表
   */
  async listFiles(options: ListFilesOptions = {}): Promise<FileList> {
    const startTime = Date.now();

    try {
      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 模拟文件列表查询', { options });
        const mockList = this.createMockFileList(options);
        
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiFileService',
          method: 'listFiles',
          requestParams: { options },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return mockList;
      }

      // 真实 API 调用
      const client = this.clientManager.getClient();
      
      const result = await ErrorHandler.withRetry(
        async () => {
          const listResponse = await client.files.list();
          return listResponse;
        },
        {},
        {
          service: 'GeminiFileService',
          method: 'listFiles',
          params: { options },
        }
      );

      // 转换响应格式 - result 是一个 Pager 对象
      const files: UploadedFile[] = [];
      for await (const file of result) {
        files.push({
          name: file.name || '',
          uri: file.uri || '',
          mimeType: file.mimeType || '',
          sizeBytes: typeof file.sizeBytes === 'number' ? file.sizeBytes : 0,
          createTime: file.createTime || new Date().toISOString(),
          updateTime: file.updateTime || new Date().toISOString(),
          displayName: file.displayName,
          state: file.state,
        });
        
        // 限制返回数量
        if (files.length >= (options.pageSize || 10)) {
          break;
        }
      }
      
      const fileList: FileList = {
        files,
        nextPageToken: undefined, // Pager 不直接提供 nextPageToken
      };

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'listFiles',
        requestParams: { options },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

      return fileList;
    } catch (error) {
      this.logger.error('文件列表查询失败', {
        options,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'listFiles',
        requestParams: { options },
        responseTime: Date.now() - startTime,
        statusCode: 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 删除文件
   * @param fileName - 文件名称
   */
  async deleteFile(fileName: string): Promise<void> {
    const startTime = Date.now();

    try {
      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 模拟文件删除', { fileName });
        
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiFileService',
          method: 'deleteFile',
          requestParams: { fileName },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return;
      }

      // 真实 API 调用
      const client = this.clientManager.getClient();
      
      await ErrorHandler.withRetry(
        async () => {
          await client.files.delete({ name: fileName });
        },
        {},
        {
          service: 'GeminiFileService',
          method: 'deleteFile',
          params: { fileName },
        }
      );

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'deleteFile',
        requestParams: { fileName },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });
    } catch (error) {
      this.logger.error('文件删除失败', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'deleteFile',
        requestParams: { fileName },
        responseTime: Date.now() - startTime,
        statusCode: 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 获取文件信息
   * @param fileName - 文件名称
   * @returns 文件信息
   */
  async getFile(fileName: string): Promise<FileInfo> {
    const startTime = Date.now();

    try {
      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 模拟获取文件信息', { fileName });
        const mockInfo = this.createMockFileInfo(fileName);
        
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiFileService',
          method: 'getFile',
          requestParams: { fileName },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return mockInfo;
      }

      // 真实 API 调用
      const client = this.clientManager.getClient();
      
      const result = await ErrorHandler.withRetry(
        async () => {
          const fileResponse = await client.files.get({ name: fileName });
          return fileResponse;
        },
        {},
        {
          service: 'GeminiFileService',
          method: 'getFile',
          params: { fileName },
        }
      );

      // 转换响应格式
      const fileInfo: FileInfo = {
        name: result.name || '',
        uri: result.uri || '',
        mimeType: result.mimeType || '',
        sizeBytes: typeof result.sizeBytes === 'number' ? result.sizeBytes : 0,
        createTime: result.createTime || new Date().toISOString(),
        updateTime: result.updateTime || new Date().toISOString(),
        displayName: result.displayName,
        state: result.state,
        expirationTime: result.expirationTime,
        sha256Hash: result.sha256Hash,
      };

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'getFile',
        requestParams: { fileName },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

      return fileInfo;
    } catch (error) {
      this.logger.error('获取文件信息失败', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiFileService',
        method: 'getFile',
        requestParams: { fileName },
        responseTime: Date.now() - startTime,
        statusCode: 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * 推断文件的 MIME 类型
   * @param filePath - 文件路径
   * @returns MIME 类型
   */
  private inferMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const mimeTypeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
      '.mp4': 'video/mp4',
      '.mpeg': 'video/mpeg',
      '.mov': 'video/mov',
      '.avi': 'video/avi',
      '.flv': 'video/x-flv',
      '.mpg': 'video/mpg',
      '.webm': 'video/webm',
      '.wmv': 'video/wmv',
      '.3gpp': 'video/3gpp',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mp3',
      '.aiff': 'audio/aiff',
      '.aac': 'audio/aac',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
    };

    return mimeTypeMap[ext] || 'application/octet-stream';
  }

  /**
   * 创建模拟的已上传文件信息
   * 存储上传的文件信息以便后续 getFile 调用
   */
  private mockUploadedFiles: Map<string, UploadedFile> = new Map();

  private createMockUploadedFile(
    filePath: string,
    mimeType: string,
    displayName?: string
  ): UploadedFile {
    const fileName = path.basename(filePath);
    const stats = fs.statSync(filePath);
    
    const mockFile: UploadedFile = {
      name: `files/mock-${Date.now()}-${fileName}`,
      uri: `https://generativelanguage.googleapis.com/v1beta/files/mock-${Date.now()}-${fileName}`,
      mimeType,
      sizeBytes: stats.size,
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      displayName: displayName || fileName,
      state: 'ACTIVE',
    };

    // 存储以便后续 getFile 调用
    this.mockUploadedFiles.set(mockFile.name, mockFile);
    
    return mockFile;
  }

  /**
   * 创建模拟的文件列表
   */
  private createMockFileList(options: ListFilesOptions): FileList {
    const pageSize = options.pageSize || 10;
    const mockFiles: UploadedFile[] = [];

    for (let i = 0; i < Math.min(pageSize, 3); i++) {
      mockFiles.push({
        name: `files/mock-file-${i}`,
        uri: `https://generativelanguage.googleapis.com/v1beta/files/mock-file-${i}`,
        mimeType: 'image/png',
        sizeBytes: 1024 * (i + 1),
        createTime: new Date(Date.now() - i * 3600000).toISOString(),
        updateTime: new Date(Date.now() - i * 1800000).toISOString(),
        displayName: `Mock File ${i}`,
        state: 'ACTIVE',
      });
    }

    return {
      files: mockFiles,
      nextPageToken: options.pageToken ? undefined : 'mock-next-page-token',
    };
  }

  /**
   * 创建模拟的文件信息
   * 优先从存储的上传文件中获取，否则创建新的模拟数据
   */
  private createMockFileInfo(fileName: string): FileInfo {
    // 如果文件之前被上传过，返回存储的信息
    const uploadedFile = this.mockUploadedFiles.get(fileName);
    if (uploadedFile) {
      return {
        ...uploadedFile,
        expirationTime: new Date(Date.now() + 86400000).toISOString(),
        sha256Hash: 'mock-sha256-hash',
      };
    }

    // 否则创建新的模拟数据
    // 尝试从文件名中提取扩展名来推断 MIME 类型
    let mimeType = 'image/png';
    if (fileName.includes('-')) {
      const parts = fileName.split('-');
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.includes('.')) {
        const ext = '.' + lastPart.split('.').pop();
        mimeType = this.inferMimeType('dummy' + ext);
      }
    }

    return {
      name: fileName,
      uri: `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
      mimeType,
      sizeBytes: 2048,
      createTime: new Date(Date.now() - 3600000).toISOString(),
      updateTime: new Date(Date.now() - 1800000).toISOString(),
      displayName: 'Mock File',
      state: 'ACTIVE',
      expirationTime: new Date(Date.now() + 86400000).toISOString(),
      sha256Hash: 'mock-sha256-hash',
    };
  }
}
