/**
 * GeminiImageService - Gemini API 图像服务
 * 
 * 职责：
 * - 图像分析（支持 URL 和 Buffer 输入）
 * - 图像生成
 * - 产品图像优化
 * - 图像下载和转换
 * - 多模态 Content 对象创建
 */

import { GoogleGenAI, Content, Part } from '@google/genai';
import { GeminiClientManager } from './client-manager';
import { ErrorHandler } from './error-handler';
import { Logger } from './logger';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { CONFIG } from '../../config';

/**
 * 图像分析选项
 */
export interface ImageAnalysisOptions {
  /** 使用的模型，默认 gemini-2.0-flash */
  model?: string;
  /** 分析提示词 */
  prompt?: string;
}

/**
 * 图像生成选项
 */
export interface ImageGenerationOptions {
  /** 使用的模型，默认 imagen-3.0-generate-002 */
  model?: string;
  /** 生成图像数量，默认 1 */
  numberOfImages?: number;
  /** 是否包含 RAI 原因 */
  includeRaiReason?: boolean;
}

/**
 * 图像分析结果
 */
export interface ImageAnalysis {
  description: string;
  objects: string[];
  colors: string[];
  quality: {
    resolution: string;
    clarity: string;
    composition: string;
  };
  suggestions: string[];
}

/**
 * 生成的图像
 */
export interface GeneratedImage {
  /** base64 编码的图像数据 */
  imageBytes: string;
  /** 修订后的提示词 */
  revisedPrompt?: string;
  /** 完成原因 */
  finishReason: string;
  /** 保存的本地路径 */
  savedPath?: string;
  /** 可访问的 URL */
  url?: string;
}

/**
 * 产品信息
 */
export interface ProductInfo {
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
}

/**
 * 支持的 MIME 类型
 */
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * GeminiImageService 类
 */
export class GeminiImageService {
  private clientManager: GeminiClientManager;
  private logger: Logger;
  private readonly DEFAULT_VISION_MODEL = 'gemini-2.0-flash';
  private readonly DEFAULT_IMAGE_GEN_MODEL = 'imagen-3.0-generate-002';
  private readonly UPLOADS_DIR = path.join(process.cwd(), 'uploads');

  constructor() {
    this.clientManager = GeminiClientManager.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * 分析图像
   * @param imageSource - 图像源（URL 或 Buffer）
   * @param prompt - 分析提示词
   * @param options - 分析选项
   * @returns 图像分析结果
   */
  async analyzeImage(
    imageSource: string | Buffer,
    prompt: string,
    options: ImageAnalysisOptions = {}
  ): Promise<ImageAnalysis> {
    const startTime = Date.now();
    const model = options.model || this.DEFAULT_VISION_MODEL;

    try {
      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 返回模拟图像分析结果');
        return this.getMockImageAnalysis();
      }

      // 下载或转换图像
      const imageData = await this.prepareImageData(imageSource);

      // 创建多模态内容
      const content = this.createMultimodalContent(prompt, imageData);

      // 调用 API 进行分析
      const result = await ErrorHandler.withRetry(
        async () => {
          const client = this.clientManager.getClient();
          const generativeModel = client.models.generateContent({
            model,
            contents: [content],
          });
          return generativeModel;
        },
        {},
        {
          service: 'GeminiImageService',
          method: 'analyzeImage',
          params: { model, promptLength: prompt.length },
        }
      );

      // 解析响应
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const analysis = this.parseImageAnalysis(responseText);

      // 记录日志
      const responseTime = Date.now() - startTime;
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiImageService',
        method: 'analyzeImage',
        model,
        requestParams: { promptLength: prompt.length },
        responseTime,
        statusCode: 200,
        success: true,
      });

      return analysis;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiImageService',
        method: 'analyzeImage',
        model,
        requestParams: { promptLength: prompt.length },
        responseTime,
        statusCode: (error as any).status || 500,
        success: false,
        errorMessage: (error as any).message,
      });

      // 返回降级响应
      this.logger.warn('图像分析失败，返回降级响应', { error: (error as any).message });
      return this.getFallbackImageAnalysis();
    }
  }

  /**
   * 生成图像
   * @param prompt - 生成提示词
   * @param options - 生成选项
   * @returns 生成的图像数组
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    const model = options.model || this.DEFAULT_IMAGE_GEN_MODEL;
    const numberOfImages = options.numberOfImages || 1;

    try {
      // MOCK_MODE 处理
      if (this.clientManager.isMockMode()) {
        this.logger.info('MOCK_MODE: 返回模拟生成图像');
        return this.getMockGeneratedImages(numberOfImages);
      }

      // 调用 API 生成图像
      const result = await ErrorHandler.withRetry(
        async () => {
          const client = this.clientManager.getClient();
          const response = await client.models.generateImages({
            model,
            prompt,
            config: {
              numberOfImages,
            },
          });
          return response;
        },
        {},
        {
          service: 'GeminiImageService',
          method: 'generateImage',
          params: { model, promptLength: prompt.length, numberOfImages },
        }
      );

      // 解析响应
      const images: GeneratedImage[] = [];
      for (const generated of result.generatedImages || []) {
        images.push({
          imageBytes: (generated as any).imageBytes || '',
          revisedPrompt: (generated as any).revisedPrompt,
          finishReason: (generated as any).finishReason || 'STOP',
        });
      }

      // 记录日志
      const responseTime = Date.now() - startTime;
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiImageService',
        method: 'generateImage',
        model,
        requestParams: { promptLength: prompt.length, numberOfImages },
        responseTime,
        statusCode: 200,
        success: true,
      });

      return images;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.logApiCall({
        timestamp: new Date().toISOString(),
        service: 'GeminiImageService',
        method: 'generateImage',
        model,
        requestParams: { promptLength: prompt.length, numberOfImages },
        responseTime,
        statusCode: (error as any).status || 500,
        success: false,
        errorMessage: (error as any).message,
      });

      // 返回降级响应（占位符图像）
      this.logger.warn('图像生成失败，返回占位符图像', { error: (error as any).message });
      return this.getFallbackGeneratedImages(numberOfImages);
    }
  }

  /**
   * 优化产品图像
   * @param imageUrl - 产品图像 URL
   * @param productInfo - 产品信息
   * @returns 优化后的图像 URL
   */
  async optimizeProductImage(
    imageUrl: string,
    productInfo: ProductInfo
  ): Promise<string> {
    try {
      // 1. 分析原始图像
      const analysisPrompt = `分析这个产品图像，产品名称：${productInfo.title}。
请评估图像质量、构图、光线等方面，并提供优化建议。`;
      
      const analysis = await this.analyzeImage(imageUrl, analysisPrompt);

      // 2. 基于分析结果生成优化提示词
      const generationPrompt = this.buildOptimizationPrompt(productInfo, analysis);

      // 3. 生成优化后的图像
      const generatedImages = await this.generateImage(generationPrompt, {
        numberOfImages: 1,
      });

      if (generatedImages.length === 0) {
        throw new Error('未能生成优化图像');
      }

      // 4. 保存图像并返回 URL
      if (generatedImages[0]) {
        const savedImage = await this.saveImage(
          generatedImages[0].imageBytes,
          `optimized_${Date.now()}.png`
        );

        return savedImage.url || savedImage.savedPath || imageUrl;
      }
      
      return imageUrl;
    } catch (error) {
      this.logger.error('产品图像优化失败', { error: (error as any).message, imageUrl });
      // 返回原始图像 URL 作为降级
      return imageUrl;
    }
  }

  /**
   * 保存图像到本地文件系统
   * @param imageBytes - base64 编码的图像数据
   * @param filename - 文件名
   * @returns 保存的图像信息
   */
  async saveImage(
    imageBytes: string,
    filename: string
  ): Promise<GeneratedImage> {
    try {
      // 确保 uploads 目录存在
      await fs.mkdir(this.UPLOADS_DIR, { recursive: true });

      // 解码 base64 数据
      const buffer = Buffer.from(imageBytes, 'base64');

      // 保存文件
      const filePath = path.join(this.UPLOADS_DIR, filename);
      await fs.writeFile(filePath, buffer);

      // 生成可访问的 URL（假设服务器在 /uploads 路径提供静态文件）
      const url = `/uploads/${filename}`;

      this.logger.info('图像保存成功', { filename, size: buffer.length });

      return {
        imageBytes,
        finishReason: 'SAVED',
        savedPath: filePath,
        url,
      };
    } catch (error) {
      this.logger.error('图像保存失败', { error: (error as any).message, filename });
      throw new Error(`图像保存失败: ${(error as any).message}`);
    }
  }

  /**
   * 准备图像数据（下载或转换）
   * @param imageSource - 图像源（URL 或 Buffer）
   * @returns 图像数据对象
   */
  private async prepareImageData(
    imageSource: string | Buffer
  ): Promise<{ mimeType: string; data: string }> {
    if (typeof imageSource === 'string') {
      // URL 输入：下载图像
      return await this.downloadAndConvertImage(imageSource);
    } else {
      // Buffer 输入：直接转换
      return this.convertBufferToBase64(imageSource);
    }
  }

  /**
   * 下载图像并转换为 base64
   * @param url - 图像 URL
   * @returns 图像数据对象
   */
  private async downloadAndConvertImage(
    url: string
  ): Promise<{ mimeType: string; data: string }> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
      });

      const buffer = Buffer.from(response.data);
      const mimeType = response.headers['content-type'] || 'image/jpeg';

      // 验证 MIME 类型
      if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
        throw new Error(`不支持的图像类型: ${mimeType}`);
      }

      const base64Data = buffer.toString('base64');

      return {
        mimeType,
        data: base64Data,
      };
    } catch (error) {
      throw new Error(`图像下载失败: ${(error as any).message}`);
    }
  }

  /**
   * 将 Buffer 转换为 base64
   * @param buffer - 图像 Buffer
   * @returns 图像数据对象
   */
  private convertBufferToBase64(
    buffer: Buffer
  ): { mimeType: string; data: string } {
    // 尝试从 Buffer 检测 MIME 类型（简单实现）
    const mimeType = this.detectMimeType(buffer);
    const base64Data = buffer.toString('base64');

    return {
      mimeType,
      data: base64Data,
    };
  }

  /**
   * 检测图像 MIME 类型
   * @param buffer - 图像 Buffer
   * @returns MIME 类型
   */
  private detectMimeType(buffer: Buffer): string {
    // 简单的魔数检测
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      return 'image/jpeg';
    } else if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    } else if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46
    ) {
      return 'image/webp';
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'image/gif';
    }

    // 默认返回 JPEG
    return 'image/jpeg';
  }

  /**
   * 创建多模态 Content 对象
   * @param text - 文本提示
   * @param imageData - 图像数据
   * @returns Content 对象
   */
  private createMultimodalContent(
    text: string,
    imageData: { mimeType: string; data: string }
  ): Content {
    const parts: Part[] = [
      { text },
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data,
        },
      },
    ];

    return {
      role: 'user',
      parts,
    };
  }

  /**
   * 解析图像分析响应
   * @param responseText - API 响应文本
   * @returns 图像分析结果
   */
  private parseImageAnalysis(responseText: string): ImageAnalysis {
    // 简单的解析逻辑（实际应用中可能需要更复杂的解析）
    try {
      // 尝试从响应中提取结构化信息
      const lines = responseText.split('\n').filter(line => line.trim());
      
      return {
        description: lines[0] || '图像分析结果',
        objects: this.extractList(responseText, '物体|对象|包含'),
        colors: this.extractList(responseText, '颜色|色彩'),
        quality: {
          resolution: this.extractQuality(responseText, '分辨率|清晰度'),
          clarity: this.extractQuality(responseText, '清晰|模糊'),
          composition: this.extractQuality(responseText, '构图|布局'),
        },
        suggestions: this.extractList(responseText, '建议|优化|改进'),
      };
    } catch (error) {
      // 解析失败时返回基本结果
      return {
        description: responseText.substring(0, 200),
        objects: [],
        colors: [],
        quality: {
          resolution: '未知',
          clarity: '未知',
          composition: '未知',
        },
        suggestions: [],
      };
    }
  }

  /**
   * 从文本中提取列表
   */
  private extractList(text: string, keywords: string): string[] {
    const regex = new RegExp(`(${keywords})[：:](.*?)(?=\\n|$)`, 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0 && matches[0]) {
      const parts = matches[0].split(/[：:]/);
      if (parts[1]) {
        return parts[1]
          .split(/[,，、]/)
          .map(item => item.trim())
          .filter(item => item.length > 0);
      }
    }
    return [];
  }

  /**
   * 从文本中提取质量评估
   */
  private extractQuality(text: string, keywords: string): string {
    const regex = new RegExp(`(${keywords})[：:](.*?)(?=\\n|$)`, 'i');
    const match = text.match(regex);
    return match && match[2] ? match[2].trim() : '中等';
  }

  /**
   * 构建优化提示词
   */
  private buildOptimizationPrompt(
    productInfo: ProductInfo,
    analysis: ImageAnalysis
  ): string {
    let prompt = `为产品"${productInfo.title}"生成一张优化的产品图像。\n`;
    
    if (productInfo.description) {
      prompt += `产品描述：${productInfo.description}\n`;
    }
    
    if (productInfo.category) {
      prompt += `产品类目：${productInfo.category}\n`;
    }

    prompt += `\n优化要求：\n`;
    prompt += `- 使用纯色或简洁的背景\n`;
    prompt += `- 确保产品居中且清晰可见\n`;
    prompt += `- 光线充足，色彩真实\n`;
    prompt += `- 专业的电商产品图风格\n`;

    if (analysis.suggestions.length > 0) {
      prompt += `\n参考建议：\n`;
      analysis.suggestions.forEach(suggestion => {
        prompt += `- ${suggestion}\n`;
      });
    }

    return prompt;
  }

  /**
   * 获取模拟图像分析结果
   */
  private getMockImageAnalysis(): ImageAnalysis {
    return {
      description: '一个白色的充电器产品图',
      objects: ['充电器', 'USB接口', '电源线'],
      colors: ['白色', '灰色'],
      quality: {
        resolution: '高',
        clarity: '清晰',
        composition: '居中',
      },
      suggestions: ['建议使用纯色背景', '增加产品细节展示', '调整光线使产品更突出'],
    };
  }

  /**
   * 获取降级图像分析结果
   */
  private getFallbackImageAnalysis(): ImageAnalysis {
    return {
      description: '图像分析暂时不可用',
      objects: [],
      colors: [],
      quality: {
        resolution: '未知',
        clarity: '未知',
        composition: '未知',
      },
      suggestions: ['请稍后重试'],
    };
  }

  /**
   * 获取模拟生成图像
   */
  private getMockGeneratedImages(count: number): GeneratedImage[] {
    const images: GeneratedImage[] = [];
    for (let i = 0; i < count; i++) {
      images.push({
        imageBytes: 'base64_mock_image_data',
        revisedPrompt: '优化后的提示词',
        finishReason: 'STOP',
        url: `https://via.placeholder.com/800x800.png?text=Mock+Image+${i + 1}`,
      });
    }
    return images;
  }

  /**
   * 获取降级生成图像（占位符）
   */
  private getFallbackGeneratedImages(count: number): GeneratedImage[] {
    const images: GeneratedImage[] = [];
    for (let i = 0; i < count; i++) {
      images.push({
        imageBytes: '',
        finishReason: 'ERROR',
        url: `https://via.placeholder.com/800x800.png?text=Fallback+Image+${i + 1}`,
      });
    }
    return images;
  }
}

// 导出单例实例
export const geminiImageService = new GeminiImageService();
