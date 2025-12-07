/**
 * GeminiImageService - 图像服务适配器
 * 
 * 此文件保持向后兼容性，内部使用新的 GeminiImageService 实现
 */

import { GeminiImageService as NewGeminiImageService } from './gemini/image-service';

/**
 * GeminiImageService 类（向后兼容）
 */
export class GeminiImageService {
    private imageService: NewGeminiImageService;

    constructor() {
        this.imageService = new NewGeminiImageService();
    }

    /**
     * 优化产品图像
     * @param imageUrl - 产品图像 URL
     * @param prompt - 优化提示词
     * @returns 优化后的图像 URL
     */
    async optimizeImage(imageUrl: string, prompt: string): Promise<string> {
        try {
            // 使用新的 GeminiImageService 实现
            const productInfo = {
                title: prompt || '产品',
                description: '需要优化的产品图像',
            };
            
            return await this.imageService.optimizeProductImage(imageUrl, productInfo);
        } catch (error) {
            console.error('Gemini Image Optimization Error:', error);
            // 降级：返回占位符图像
            return 'https://via.placeholder.com/800x800.png?text=Optimized+Image';
        }
    }

    /**
     * 生成产品图像
     * @param title - 产品标题
     * @param userPrompt - 用户提示词
     * @returns 生成的图像 URL
     */
    async generateImage(title: string, userPrompt: string): Promise<string> {
        try {
            console.log(`[Gemini] Generating image for "${title}" with prompt: ${userPrompt}`);
            
            // 构建完整的生成提示词
            const fullPrompt = `${title}: ${userPrompt}`;
            
            // 使用新的 GeminiImageService 实现
            const generatedImages = await this.imageService.generateImage(fullPrompt, {
                numberOfImages: 1,
            });

            if (generatedImages.length === 0) {
                throw new Error('未能生成图像');
            }

            // 保存生成的图像
            if (generatedImages[0]) {
                const savedImage = await this.imageService.saveImage(
                    generatedImages[0].imageBytes,
                    `generated_${Date.now()}.png`
                );

                // 返回可访问的 URL
                return savedImage.url || savedImage.savedPath || 'https://via.placeholder.com/800x800.png?text=Gemini+Gen';
            }
            
            return 'https://via.placeholder.com/800x800.png?text=Gemini+Gen';
        } catch (error) {
            console.error('Gemini Image Gen Error:', error);
            // 降级：返回占位符图像
            return `https://via.placeholder.com/800x800.png?text=${encodeURIComponent(title.slice(0, 10))}`;
        }
    }
}

// 导出单例实例（保持向后兼容）
export const geminiImageService = new GeminiImageService();
