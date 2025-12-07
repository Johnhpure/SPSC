/**
 * GeminiTextService - 文本服务适配器
 * 
 * 此文件保持向后兼容性，内部使用新的 GeminiTextService 实现
 */

import { GeminiTextService as NewGeminiTextService } from './gemini/text-service';

/**
 * GeminiTextService 类（向后兼容）
 */
export class GeminiTextService {
    private textService: NewGeminiTextService;

    constructor() {
        this.textService = new NewGeminiTextService();
    }

    /**
     * 推荐产品类目
     * @param title - 产品标题
     * @param description - 产品描述
     * @returns 推荐的类目列表
     */
    async recommendCategory(title: string, description: string = ''): Promise<string[]> {
        try {
            // 使用新的 GeminiTextService 实现
            return await this.textService.recommendCategories(title, description);
        } catch (error) {
            console.error('Gemini Text Error:', error);
            // 降级响应
            return ['Error fetching category'];
        }
    }
}

// 导出单例实例（保持向后兼容）
export const geminiTextService = new GeminiTextService();
