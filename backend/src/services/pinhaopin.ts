import axios from 'axios';
import { CONFIG } from '../config';

interface LoginResponse {
    token: string;
    merchantParams: any;
    shopId?: string;
}

interface ProductListResponse {
    content: any[];
    totalElements: number;
}

class PinhaopinService {
    private client = axios.create({
        baseURL: CONFIG.PINHAOPIN_API_BASE,
        timeout: 10000,
    });

    private accessToken: string = '';
    private shopId: string = '332';
    private cookie: string[] = [];
    private isLoggedIn: boolean = false;

    // 获取用于 API 调用的认证头
    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.cookie && this.cookie.length > 0) {
            headers['Cookie'] = this.cookie.join('; ');
        }
        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        return headers;
    }

    // 检查是否已认证
    private checkAuth(): void {
        if (!this.isLoggedIn && !this.accessToken && this.cookie.length === 0) {
            throw new Error('No access token available. Please login first.');
        }
    }

    async sendSms(phone: string): Promise<boolean> {
        if (CONFIG.MOCK_MODE) {
            console.log(`[Mock] SMS sent to ${phone}`);
            return true;
        }
        try {
            const res = await this.client.get(`${CONFIG.GATEWAY_BASE}/session/send-sms`, {
                params: { areaCode: '86', phone: phone }  // 发送验证码使用 phone 字段
            });

            if (res.headers['set-cookie']) {
                this.cookie = res.headers['set-cookie'];
            }

            return true;
        } catch (error) {
            console.error('Send SMS failed:', error);
            throw new Error('Failed to send SMS');
        }
    }

    async loginBySms(phone: string, code: string): Promise<LoginResponse> {
        if (CONFIG.MOCK_MODE && code === '8888') {
            const mockRes = {
                token: 'mock-sms-token-' + Date.now(),
                merchantParams: { name: 'Mock Merchant (SMS)' },
                shopId: '332'
            };
            this.accessToken = mockRes.token;
            this.isLoggedIn = true;
            return mockRes;
        }

        try {
            const headers: any = {};
            if (this.cookie && this.cookie.length > 0) {
                headers['Cookie'] = this.cookie.join('; ');
            }

            // 调用登录接口: /gateway/session/login-by-mobile
            const res = await this.client.post(`${CONFIG.GATEWAY_BASE}/session/login-by-mobile`, {
                areaCode: '86',
                mobile: phone,      // 使用 mobile 字段
                verifyCode: code    // 使用 verifyCode 字段
            }, { headers });

            // 从 Set-Cookie 中提取 token
            // 格式: token=1fd8b833c81d4f6ea02f09526c463002; Max-Age=86400; Expires=...; Path=/; HttpOnly
            if (res.headers['set-cookie']) {
                this.cookie = res.headers['set-cookie'];
                console.log('Received Set-Cookie headers:', this.cookie.length, 'cookies');

                // 解析 Set-Cookie 获取 token 值
                for (const cookieStr of this.cookie) {
                    const tokenMatch = cookieStr.match(/^token=([^;]+)/);
                    if (tokenMatch && tokenMatch[1]) {
                        this.accessToken = tokenMatch[1];
                        console.log('Token extracted from Set-Cookie:', this.accessToken.substring(0, 10) + '...');
                        break;
                    }
                }
            }

            // 检查是否成功提取 token
            if (!this.accessToken) {
                console.error('Failed to extract token from Set-Cookie');
                throw new Error('Login failed: No token received');
            }

            // 设置登录状态
            this.isLoggedIn = true;
            
            // 从响应体中获取其他信息
            const responseData = res.data || {};
            if (responseData.shopId) {
                this.shopId = responseData.shopId;
            }

            console.log('Login successful. ShopId:', this.shopId);

            // 返回数据，包含从 Set-Cookie 中提取的 token
            return {
                token: this.accessToken,  // 明确返回提取到的 token
                merchantParams: responseData.merchantParams || responseData,
                shopId: this.shopId
            };
        } catch (error: any) {
            console.error('SMS Login failed:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            throw new Error('Login failed: ' + (error.response?.data?.message || error.message));
        }
    }

    async getRecommendKeywords(type: string = 'recommendReason'): Promise<any> {
        if (CONFIG.MOCK_MODE) {
            return ['High Quality', 'Fast Shipping', 'Best Seller'];
        }
        try {
            const res = await this.client.get(`${CONFIG.GATEWAY_BASE}/product/getRecommendKeywords`, {
                headers: this.getAuthHeaders(),
                params: { type }
            });
            return res.data;
        } catch (error) {
            console.error('Get Keywords failed:', error);
            return [];
        }
    }

    async getCategories(): Promise<any[]> {
        if (CONFIG.MOCK_MODE) {
            return [
                { id: 1001, name: 'Clothing' },
                { id: 1002, name: 'Shoes' }
            ];
        }
        try {
            const res = await this.client.get(`${CONFIG.GATEWAY_BASE}/product/getLevel1ProductCategories`, {
                headers: this.getAuthHeaders(),
                params: { shopId: this.shopId }
            });
            return res.data;
        } catch (error) {
            console.error('Get Categories failed:', error);
            return [];
        }
    }

    async getProductList(pageNumber: number = 0, pageSize: number = 20): Promise<ProductListResponse> {
        if (CONFIG.MOCK_MODE) {
            return this.generateMockGoods(pageNumber, pageSize);
        }

        this.checkAuth();

        try {
            console.log('Fetching product list with auth headers:', Object.keys(this.getAuthHeaders()));
            const res = await this.client.get(`${CONFIG.GATEWAY_BASE}/product/getProductList`, {
                headers: this.getAuthHeaders(),
                params: {
                    pageNumber,
                    pageSize,
                    shopId: this.shopId
                }
            });
            return res.data;
        } catch (error) {
            console.error('Get Product List failed:', error);
            throw error;
        }
    }

    async updateGoods(goodsId: string, data: any): Promise<void> {
        if (CONFIG.MOCK_MODE) {
            console.log(`[Mock] Updated goods ${goodsId}`, data);
            return;
        }

        this.checkAuth();

        await this.client.post('/api/goods/update', { id: goodsId, ...data }, {
            headers: this.getAuthHeaders()
        });
    }

    private generateMockGoods(page: number, pageSize: number): ProductListResponse {
        const list = Array.from({ length: pageSize }, (_, i) => ({
            id: `goods-${page}-${i}`,
            title: `Mock Product ${page}-${i}`,
            categoryId: 1001,
            categoryName: 'Clothing',
            mainImage: 'https://via.placeholder.com/800',
            status: 'ONLINE'
        }));

        return {
            content: list,
            totalElements: 100
        };
    }
}

export const pinhaopinService = new PinhaopinService();
