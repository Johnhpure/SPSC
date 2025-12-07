/**
 * GeminiStreamService - Gemini 流式响应服务
 * 
 * 提供流式内容生成功能，支持 AsyncGenerator 和 SSE 集成
 */

import { Response } from 'express';
import { GeminiClientManager } from './client-manager';
import { ErrorHandler, GeminiError } from './error-handler';
import { Logger } from './logger';
import { TextGenerationOptions } from './text-service';

/**
 * 流式响应块接口
 */
export interface StreamChunk {
  /** 文本内容 */
  text: string;
  /** 是否为最后一块 */
  done: boolean;
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * GeminiStreamService 类
 */
export class GeminiStreamService {
  private clientManager: GeminiClientManager;
  private logger: Logger;
  private defaultModel: string;

  constructor() {
    this.clientManager = GeminiClientManager.getInstance();
    this.logger = Logger.getInstance();
    this.defaultModel = process.env.GEMINI_DEFAULT_TEXT_MODEL || 'gemini-2.0-flash';
  }

  /**
   * 流式生成内容（AsyncGenerator）
   * 
   * @param prompt - 文本提示
   * @param options - 生成配置选项
   * @yields 流式响应块
   */
  async *generateContentStream(
    prompt: string,
    options: TextGenerationOptions = {}
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    try {
      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 返回模拟流式响应');
        
        // 模拟流式响应：将提示词分成多个块
        const mockText = `模拟流式响应: ${prompt.substring(0, 100)}...`;
        const chunks = mockText.match(/.{1,10}/g) || [mockText];
        
        for (let i = 0; i < chunks.length; i++) {
          yield {
            text: chunks[i] || '',
            done: i === chunks.length - 1,
          };
        }

        // 记录 API 调用日志
        this.logger.logApiCall({
          timestamp: new Date().toISOString(),
          service: 'GeminiStreamService',
          method: 'generateContentStream',
          model,
          requestParams: { prompt: prompt.substring(0, 100), options },
          responseTime: Date.now() - startTime,
          statusCode: 200,
          success: true,
        });

        return;
      }

      // 使用 ErrorHandler 包装流式 API 调用
      const client = this.clientManager.getClient();
      
      // 构建生成配置
      const generationConfig: any = {};
      if (options.maxOutputTokens) generationConfig.maxOutputTokens = options.maxOutputTokens;
      if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
      if (options.topP !== undefined) generationConfig.topP = options.topP;
      if (options.topK !== undefined) generationConfig.topK = options.topK;

      // 调用流式 API
      const stream = await client.models.generateContentStream({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(Object.keys(generationConfig).length > 0 && { generationConfig }),
      });

      // 逐块处理流式响应
      let hasContent = false;
      for await (const chunk of stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
          hasContent = true;
          yield {
            text,
            done: false,
          };
        }
      }

      // 发送完成信号
      yield {
        text: '',
        done: true,
      };

      // 如果没有内容，记录警告
      if (!hasContent) {
        this.logger.warn('流式响应未返回任何内容', { prompt: prompt.substring(0, 100) });
      }

      // 记录成功的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiStreamService',
        method: 'generateContentStream',
        model,
        requestParams: { prompt: prompt.substring(0, 100), options },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

    } catch (error) {
      // 记录失败的 API 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiStreamService',
        method: 'generateContentStream',
        model,
        requestParams: { prompt: prompt.substring(0, 100), options },
        responseTime: Date.now() - startTime,
        statusCode: error instanceof GeminiError ? error.status || 500 : 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // 发送错误块
      yield {
        text: '',
        done: true,
        error: error instanceof Error ? error.message : '流式生成失败',
      };

      this.logger.error('流式内容生成失败', { error });
    }
  }

  /**
   * 将流式内容通过 Server-Sent Events (SSE) 发送到客户端
   * 
   * @param res - Express Response 对象
   * @param prompt - 文本提示
   * @param options - 生成配置选项
   */
  async streamToSSE(
    res: Response,
    prompt: string,
    options: TextGenerationOptions = {}
  ): Promise<void> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;

    try {
      // 设置 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // 禁用 Nginx 缓冲

      // 发送初始连接确认
      res.write('data: {"type":"connected"}\n\n');

      // 使用流式生成器
      for await (const chunk of this.generateContentStream(prompt, options)) {
        // 检查客户端是否断开连接
        if (res.writableEnded) {
          this.logger.info('客户端断开连接，停止流式传输');
          break;
        }

        // 发送数据块
        const data = JSON.stringify({
          type: chunk.done ? 'done' : 'chunk',
          text: chunk.text,
          error: chunk.error,
        });
        
        res.write(`data: ${data}\n\n`);

        // 如果是最后一块或有错误，结束流
        if (chunk.done) {
          break;
        }
      }

      // 关闭连接
      res.end();

      // 记录成功的 SSE 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiStreamService',
        method: 'streamToSSE',
        model,
        requestParams: { prompt: prompt.substring(0, 100), options },
        responseTime: Date.now() - startTime,
        statusCode: 200,
        success: true,
      });

    } catch (error) {
      // 记录失败的 SSE 调用
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiStreamService',
        method: 'streamToSSE',
        model,
        requestParams: { prompt: prompt.substring(0, 100), options },
        responseTime: Date.now() - startTime,
        statusCode: error instanceof GeminiError ? error.status || 500 : 500,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // 如果响应还未结束，发送错误消息
      if (!res.writableEnded) {
        const errorData = JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : '流式传输失败',
        });
        res.write(`data: ${errorData}\n\n`);
        res.end();
      }

      this.logger.error('SSE 流式传输失败', { error });
    }
  }
}
