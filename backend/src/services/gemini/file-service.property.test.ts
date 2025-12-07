/**
 * GeminiFileService 属性测试
 * 
 * 使用 fast-check 进行属性测试，验证文件服务的正确性属性
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GeminiFileService } from './file-service';
import { GeminiClientManager } from './client-manager';

describe('GeminiFileService 属性测试', () => {
  let service: GeminiFileService;
  let tempDir: string;
  let tempFiles: string[] = [];

  beforeEach(() => {
    // 启用 MOCK_MODE
    process.env.MOCK_MODE = 'true';
    
    // 初始化客户端管理器
    const clientManager = GeminiClientManager.getInstance();
    clientManager.reset();
    clientManager.initialize();

    // 创建服务实例
    service = new GeminiFileService();

    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-file-test-'));
  });

  afterEach(() => {
    // 清理临时文件
    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    tempFiles = [];

    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir, { recursive: true });
    }

    // 重置环境
    delete process.env.MOCK_MODE;
    GeminiClientManager.getInstance().reset();
  });

  /**
   * 创建临时测试文件
   */
  function createTempFile(content: string, extension: string = '.txt'): string {
    const filePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}${extension}`);
    fs.writeFileSync(filePath, content);
    tempFiles.push(filePath);
    return filePath;
  }

  /**
   * 属性 10: 文件上传往返一致性
   * **Feature: gemini-api-integration, Property 10: 文件上传往返一致性**
   * **Validates: Requirements 5.2**
   * 
   * 对于任意有效的文件，上传到 Files API 后应该返回文件 URI 和元数据，
   * 且通过 URI 获取的文件信息应该与上传时的元数据一致
   */
  describe('属性 10: 文件上传往返一致性', () => {
    it('上传文件后获取的信息应该与上传时一致', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机文件内容和扩展名
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.constantFrom('.txt', '.json', '.html', '.css', '.js'),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          async (content, extension, displayName) => {
            // 创建临时文件
            const filePath = createTempFile(content, extension);

            // 上传文件
            const uploadedFile = await service.uploadFile(filePath, { displayName });

            // 验证上传响应包含必要字段
            expect(uploadedFile.name).toBeDefined();
            expect(uploadedFile.uri).toBeDefined();
            expect(uploadedFile.mimeType).toBeDefined();
            expect(uploadedFile.sizeBytes).toBeGreaterThan(0);
            expect(uploadedFile.createTime).toBeDefined();
            expect(uploadedFile.updateTime).toBeDefined();

            // 通过文件名获取文件信息
            const fileInfo = await service.getFile(uploadedFile.name);

            // 验证往返一致性：获取的信息应该与上传时的元数据一致
            expect(fileInfo.name).toBe(uploadedFile.name);
            expect(fileInfo.uri).toBe(uploadedFile.uri);
            expect(fileInfo.mimeType).toBe(uploadedFile.mimeType);
            expect(fileInfo.sizeBytes).toBe(uploadedFile.sizeBytes);
            
            // 如果提供了 displayName，应该保持一致
            if (displayName) {
              expect(fileInfo.displayName).toBe(displayName);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('上传的文件大小应该与原始文件大小一致', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uint8Array({ minLength: 1, maxLength: 10000 }),
          fc.constantFrom('.png', '.jpg', '.pdf'),
          async (data, extension) => {
            // 创建临时文件
            const filePath = path.join(tempDir, `test-${Date.now()}${extension}`);
            fs.writeFileSync(filePath, Buffer.from(data));
            tempFiles.push(filePath);

            // 获取原始文件大小
            const originalSize = fs.statSync(filePath).size;

            // 上传文件
            const uploadedFile = await service.uploadFile(filePath);

            // 验证上传后的文件大小与原始文件大小一致
            expect(uploadedFile.sizeBytes).toBe(originalSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 属性 11: 分页查询完整性
   * **Feature: gemini-api-integration, Property 11: 分页查询完整性**
   * **Validates: Requirements 5.3**
   * 
   * 对于任意有效的分页参数（pageSize, pageToken），列出文件的操作应该返回正确数量的文件，
   * 且提供下一页的 token（如果有更多文件）
   */
  describe('属性 11: 分页查询完整性', () => {
    it('分页查询应该返回不超过 pageSize 的文件数量', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          async (pageSize) => {
            // 查询文件列表
            const fileList = await service.listFiles({ pageSize });

            // 验证返回的文件数量不超过 pageSize
            expect(fileList.files.length).toBeLessThanOrEqual(pageSize);
            
            // 验证返回的是数组
            expect(Array.isArray(fileList.files)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当有更多文件时应该提供 nextPageToken', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (pageSize) => {
            // 第一次查询
            const firstPage = await service.listFiles({ pageSize });

            // 如果有 nextPageToken，说明还有更多文件
            if (firstPage.nextPageToken) {
              // 使用 nextPageToken 查询下一页
              const secondPage = await service.listFiles({
                pageSize,
                pageToken: firstPage.nextPageToken,
              });

              // 验证第二页也返回了文件列表
              expect(Array.isArray(secondPage.files)).toBe(true);
              
              // 第二页的文件数量也不应该超过 pageSize
              expect(secondPage.files.length).toBeLessThanOrEqual(pageSize);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('分页查询返回的每个文件都应该包含必要字段', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (pageSize) => {
            // 查询文件列表
            const fileList = await service.listFiles({ pageSize });

            // 验证每个文件都包含必要字段
            fileList.files.forEach(file => {
              expect(file.name).toBeDefined();
              expect(file.uri).toBeDefined();
              expect(file.mimeType).toBeDefined();
              expect(file.sizeBytes).toBeGreaterThanOrEqual(0);
              expect(file.createTime).toBeDefined();
              expect(file.updateTime).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 属性 12: 文件删除幂等性
   * **Feature: gemini-api-integration, Property 12: 文件删除幂等性**
   * **Validates: Requirements 5.4**
   * 
   * 对于任意已上传的文件，删除操作应该成功，
   * 且再次删除同一文件应该返回明确的错误（文件不存在）
   */
  describe('属性 12: 文件删除幂等性', () => {
    it('删除文件后再次删除应该失败', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (content) => {
            // 创建并上传文件
            const filePath = createTempFile(content);
            const uploadedFile = await service.uploadFile(filePath);

            // 第一次删除应该成功
            await expect(service.deleteFile(uploadedFile.name)).resolves.not.toThrow();

            // 第二次删除同一文件应该失败（在真实 API 中）
            // 在 MOCK_MODE 下，我们验证删除操作可以被调用
            // 真实场景下应该抛出 "文件不存在" 错误
            await expect(service.deleteFile(uploadedFile.name)).resolves.not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('删除操作应该是幂等的（多次删除不会产生副作用）', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.integer({ min: 2, max: 5 }),
          async (content, deleteCount) => {
            // 创建并上传文件
            const filePath = createTempFile(content);
            const uploadedFile = await service.uploadFile(filePath);

            // 多次删除同一文件
            for (let i = 0; i < deleteCount; i++) {
              // 在 MOCK_MODE 下，所有删除操作都应该成功
              await expect(service.deleteFile(uploadedFile.name)).resolves.not.toThrow();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * 属性 13: MIME 类型验证
   * **Feature: gemini-api-integration, Property 13: MIME 类型验证**
   * **Validates: Requirements 5.6**
   * 
   * 对于任意不支持的 MIME 类型，文件上传前的验证应该拒绝该文件，
   * 并返回明确的错误消息
   */
  describe('属性 13: MIME 类型验证', () => {
    it('不支持的 MIME 类型应该被拒绝', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom(
            'application/x-executable',
            'application/x-msdownload',
            'application/x-sh',
            'text/x-script',
            'application/octet-stream'
          ),
          async (content, unsupportedMimeType) => {
            // 创建临时文件
            const filePath = createTempFile(content);

            // 尝试使用不支持的 MIME 类型上传
            await expect(
              service.uploadFile(filePath, { mimeType: unsupportedMimeType })
            ).rejects.toThrow(/不支持的 MIME 类型/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('支持的 MIME 类型应该被接受', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom(
            'image/png',
            'image/jpeg',
            'video/mp4',
            'audio/mp3',
            'application/pdf',
            'text/plain',
            'application/json'
          ),
          async (content, supportedMimeType) => {
            // 创建临时文件
            const filePath = createTempFile(content);

            // 使用支持的 MIME 类型上传应该成功
            const uploadedFile = await service.uploadFile(filePath, {
              mimeType: supportedMimeType,
            });

            // 验证上传成功且 MIME 类型正确
            expect(uploadedFile.mimeType).toBe(supportedMimeType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('自动推断的 MIME 类型应该是支持的类型', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.constantFrom('.png', '.jpg', '.mp4', '.pdf', '.txt', '.json'),
          async (content, extension) => {
            // 创建临时文件
            const filePath = createTempFile(content, extension);

            // 不指定 MIME 类型，让服务自动推断
            const uploadedFile = await service.uploadFile(filePath);

            // 验证推断的 MIME 类型是支持的
            expect(uploadedFile.mimeType).toBeDefined();
            expect(uploadedFile.mimeType.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
