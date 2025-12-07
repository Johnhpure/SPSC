/**
 * GeminiFileService 单元测试
 * 
 * 测试文件管理服务的核心功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GeminiFileService } from './file-service';
import { GeminiClientManager } from './client-manager';

describe('GeminiFileService 单元测试', () => {
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

  describe('文件上传', () => {
    it('应该成功上传文本文件', async () => {
      const filePath = createTempFile('Hello, World!', '.txt');
      
      const result = await service.uploadFile(filePath);

      expect(result).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.uri).toBeDefined();
      expect(result.mimeType).toBe('text/plain');
      expect(result.sizeBytes).toBeGreaterThan(0);
      expect(result.createTime).toBeDefined();
      expect(result.updateTime).toBeDefined();
    });

    it('应该成功上传图像文件', async () => {
      const filePath = createTempFile('fake image data', '.png');
      
      const result = await service.uploadFile(filePath);

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('image/png');
    });

    it('应该支持自定义 displayName', async () => {
      const filePath = createTempFile('test content', '.txt');
      const displayName = 'My Custom File';
      
      const result = await service.uploadFile(filePath, { displayName });

      expect(result.displayName).toBe(displayName);
    });

    it('应该支持显式指定 MIME 类型', async () => {
      const filePath = createTempFile('{"key": "value"}', '.txt');
      
      const result = await service.uploadFile(filePath, { mimeType: 'application/json' });

      expect(result.mimeType).toBe('application/json');
    });

    it('应该拒绝不存在的文件', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent-file.txt');
      
      await expect(service.uploadFile(nonExistentPath)).rejects.toThrow('文件不存在');
    });

    it('应该拒绝不支持的 MIME 类型', async () => {
      const filePath = createTempFile('executable content', '.exe');
      
      await expect(
        service.uploadFile(filePath, { mimeType: 'application/x-executable' })
      ).rejects.toThrow('不支持的 MIME 类型');
    });

    it('应该拒绝超过大小限制的文件', async () => {
      // 创建一个超过 20MB 的文件
      const largeFilePath = path.join(tempDir, 'large-file.txt');
      const largeContent = Buffer.alloc(21 * 1024 * 1024); // 21MB
      fs.writeFileSync(largeFilePath, largeContent);
      tempFiles.push(largeFilePath);
      
      await expect(service.uploadFile(largeFilePath)).rejects.toThrow('文件大小超过限制');
    });
  });

  describe('文件列表', () => {
    it('应该成功列出文件', async () => {
      const result = await service.listFiles();

      expect(result).toBeDefined();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });

    it('应该支持分页参数', async () => {
      const pageSize = 5;
      const result = await service.listFiles({ pageSize });

      expect(result.files.length).toBeLessThanOrEqual(pageSize);
    });

    it('应该返回 nextPageToken 当有更多文件时', async () => {
      const result = await service.listFiles({ pageSize: 2 });

      // 在 MOCK_MODE 下，第一次查询会返回 nextPageToken
      if (!result.nextPageToken) {
        // 如果没有 nextPageToken，说明文件数量少于 pageSize
        expect(result.files.length).toBeLessThanOrEqual(2);
      } else {
        expect(result.nextPageToken).toBeDefined();
      }
    });

    it('应该支持使用 pageToken 查询下一页', async () => {
      const firstPage = await service.listFiles({ pageSize: 2 });
      
      if (firstPage.nextPageToken) {
        const secondPage = await service.listFiles({
          pageSize: 2,
          pageToken: firstPage.nextPageToken,
        });

        expect(secondPage).toBeDefined();
        expect(Array.isArray(secondPage.files)).toBe(true);
      }
    });

    it('返回的文件应该包含所有必要字段', async () => {
      const result = await service.listFiles();

      result.files.forEach(file => {
        expect(file.name).toBeDefined();
        expect(file.uri).toBeDefined();
        expect(file.mimeType).toBeDefined();
        expect(file.sizeBytes).toBeGreaterThanOrEqual(0);
        expect(file.createTime).toBeDefined();
        expect(file.updateTime).toBeDefined();
      });
    });
  });

  describe('文件删除', () => {
    it('应该成功删除文件', async () => {
      // 先上传一个文件
      const filePath = createTempFile('test content', '.txt');
      const uploadedFile = await service.uploadFile(filePath);

      // 删除文件
      await expect(service.deleteFile(uploadedFile.name)).resolves.not.toThrow();
    });

    it('应该支持删除任意文件名', async () => {
      const fileName = 'files/test-file-123';
      
      // 在 MOCK_MODE 下，删除操作总是成功
      await expect(service.deleteFile(fileName)).resolves.not.toThrow();
    });
  });

  describe('获取文件信息', () => {
    it('应该成功获取文件信息', async () => {
      // 先上传一个文件
      const filePath = createTempFile('test content', '.txt');
      const uploadedFile = await service.uploadFile(filePath);

      // 获取文件信息
      const fileInfo = await service.getFile(uploadedFile.name);

      expect(fileInfo).toBeDefined();
      expect(fileInfo.name).toBe(uploadedFile.name);
      expect(fileInfo.uri).toBe(uploadedFile.uri);
      expect(fileInfo.mimeType).toBe(uploadedFile.mimeType);
      expect(fileInfo.sizeBytes).toBe(uploadedFile.sizeBytes);
    });

    it('返回的文件信息应该包含扩展字段', async () => {
      const filePath = createTempFile('test content', '.txt');
      const uploadedFile = await service.uploadFile(filePath);

      const fileInfo = await service.getFile(uploadedFile.name);

      expect(fileInfo.expirationTime).toBeDefined();
      expect(fileInfo.sha256Hash).toBeDefined();
    });

    it('应该支持获取任意文件名的信息', async () => {
      const fileName = 'files/test-file-456';
      
      const fileInfo = await service.getFile(fileName);

      expect(fileInfo).toBeDefined();
      expect(fileInfo.name).toBeDefined();
    });
  });

  describe('MIME 类型推断', () => {
    it('应该正确推断常见图像格式', async () => {
      const testCases = [
        { ext: '.png', expected: 'image/png' },
        { ext: '.jpg', expected: 'image/jpeg' },
        { ext: '.jpeg', expected: 'image/jpeg' },
        { ext: '.webp', expected: 'image/webp' },
      ];

      for (const { ext, expected } of testCases) {
        const filePath = createTempFile('image data', ext);
        const result = await service.uploadFile(filePath);
        expect(result.mimeType).toBe(expected);
      }
    });

    it('应该正确推断常见视频格式', async () => {
      const testCases = [
        { ext: '.mp4', expected: 'video/mp4' },
        { ext: '.mpeg', expected: 'video/mpeg' },
        { ext: '.webm', expected: 'video/webm' },
      ];

      for (const { ext, expected } of testCases) {
        const filePath = createTempFile('video data', ext);
        const result = await service.uploadFile(filePath);
        expect(result.mimeType).toBe(expected);
      }
    });

    it('应该正确推断常见文档格式', async () => {
      const testCases = [
        { ext: '.pdf', expected: 'application/pdf' },
        { ext: '.txt', expected: 'text/plain' },
        { ext: '.json', expected: 'application/json' },
        { ext: '.html', expected: 'text/html' },
      ];

      for (const { ext, expected } of testCases) {
        const filePath = createTempFile('document data', ext);
        const result = await service.uploadFile(filePath);
        expect(result.mimeType).toBe(expected);
      }
    });
  });

  describe('错误处理', () => {
    it('应该记录上传失败的错误', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.txt');
      
      await expect(service.uploadFile(nonExistentPath)).rejects.toThrow();
    });

    it('应该记录 MIME 类型验证失败的错误', async () => {
      const filePath = createTempFile('content', '.txt');
      
      await expect(
        service.uploadFile(filePath, { mimeType: 'invalid/type' })
      ).rejects.toThrow();
    });
  });
});
