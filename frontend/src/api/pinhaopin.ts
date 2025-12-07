/**
 * 拼好拼平台 API 客户端
 * 前端直接调用第三方接口
 */
import axios from 'axios';

// 创建专门用于调用拼好拼平台的 axios 实例
const pinhaopinClient = axios.create({
    // 开发环境使用 Vite 代理，生产环境直接调用
    baseURL: import.meta.env.DEV ? '/gateway' : 'https://shop.pinhaopin.com/gateway',
    timeout: 10000,
    withCredentials: true  // 允许携带 Cookie
});

// 响应拦截器：统一处理错误
pinhaopinClient.interceptors.response.use(
    (response) => {
        // 检查响应数据中的 success 字段
        if (response.data && response.data.success === false) {
            // 将业务错误转换为异常
            const error: any = new Error(response.data.msg || response.data.message || '请求失败');
            error.code = response.data.code;
            error.response = response;
            return Promise.reject(error);
        }
        return response;
    },
    (error) => {
        // 网络错误或 HTTP 错误
        console.error('API Error:', error);
        return Promise.reject(error);
    }
);

/**
 * 发送短信验证码
 */
export async function sendSmsCode(phone: string): Promise<void> {
    await pinhaopinClient.get('/session/send-sms', {
        params: {
            areaCode: '86',
            phone: phone  // 发送验证码使用 phone 字段
        }
    });
    // 拦截器已经处理了 success: false 的情况
}

/**
 * 使用短信验证码登录
 * 登录成功后，浏览器会自动保存 Set-Cookie: token=xxx
 */
export async function loginBySms(phone: string, code: string): Promise<any> {
    const response = await pinhaopinClient.post('/session/login-by-mobile', {
        areaCode: '86',
        mobile: phone,      // 使用 mobile 字段
        verifyCode: code    // 使用 verifyCode 字段
    });
    
    // 拦截器已经处理了 success: false 的情况
    // 这里只返回成功的数据
    return response.data;
}

/**
 * 获取商品列表
 * 浏览器会自动携带 Cookie
 */
export async function getProductList(pageNumber: number = 0, pageSize: number = 20, shopId: string = '332'): Promise<any> {
    const response = await pinhaopinClient.get('/product/getProductList', {
        params: {
            pageNumber,
            pageSize,
            shopId
        }
    });
    
    return response.data.data;  // 返回实际的数据对象（包含 content 等字段）
}

/**
 * 获取一级分类列表
 */
export async function getCategories(shopId: string = '332'): Promise<any> {
    const response = await pinhaopinClient.get('/product/getLevel1ProductCategories', {
        params: { shopId }
    });
    
    return response.data.data;  // 返回实际的分类数据
}

/**
 * 获取二级分类列表
 * @param shopId 店铺ID
 * @param parentId 父级分类ID
 */
export async function getLevel2Categories(shopId: string = '332', parentId: string): Promise<any> {
    const response = await pinhaopinClient.get('/product/getLevel2ProductCategories', {
        params: {
            shopId,
            parentId
        }
    });
    
    return response.data.data;  // 返回二级分类数据
}

/**
 * 获取推荐关键词
 */
export async function getRecommendKeywords(type: string = 'recommendReason'): Promise<any> {
    const response = await pinhaopinClient.get('/product/getRecommendKeywords', {
        params: { type }
    });
    
    return response.data.data;  // 返回实际的关键词数据
}

/**
 * 获取我的店铺列表
 */
export async function getMyShopList(): Promise<any> {
    const response = await pinhaopinClient.get('/shop/getMyShopList');
    return response.data.data;  // 返回实际的店铺数组
}

/**
 * 获取官方商品分类
 */
export async function getOfficialCategories(): Promise<any> {
    const response = await pinhaopinClient.get('/product-mount/list-official-cat');
    return response.data.data;  // 返回官方分类数据
}

/**
 * 获取商家商品分类
 * @param shopId 店铺ID
 * @param level 分类级别：1-一级分类，2-二级分类
 */
export async function getMerchantCategories(shopId: string = '332', level: number = 1): Promise<any> {
    const response = await pinhaopinClient.get('/product/getCategoryList', {
        params: {
            shopId,
            level
        }
    });
    return response.data.data;  // 返回商家分类数据
}

/**
 * 创建新商品
 * @param productData 商品数据
 */
export async function createProduct(productData: any): Promise<any> {
    const response = await pinhaopinClient.post('/product/createProduct', productData);
    return response.data.data;
}

/**
 * 获取仓库列表
 */
export async function getRepoList(_shopId: string = '332'): Promise<any> {
    const response = await pinhaopinClient.get('/repo/list');
    return response.data.data;
}

/**
 * 商品上架
 * @param productId 商品ID
 */
export async function publishProduct(productId: number | string): Promise<any> {
    const response = await pinhaopinClient.post('/product/publish', {
        id: productId.toString()
    });
    return response.data;
}

/**
 * 撤回审核
 * @param productId 商品ID
 */
export async function revertAudit(productId: number | string): Promise<any> {
    const response = await pinhaopinClient.post('/product/revertAudit', {
        id: productId.toString()
    });
    return response.data;
}

/**
 * 上传图片
 * @param file 图片文件
 * @param onProgress 上传进度回调
 * @returns 返回图片URL
 */
export async function uploadImage(file: File, onProgress?: (progress: number) => void): Promise<string> {
    // 获取文件扩展名
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    
    // 第一步：获取上传URL
    const urlResponse = await pinhaopinClient.get('/shop/upload-url', {
        params: {
            fileType: fileExtension
        }
    });
    
    console.log('Upload URL Response:', urlResponse.data);
    
    const responseData = urlResponse.data.data;
    
    // 尝试多种可能的字段名
    let uploadUrl: string = '';
    let imageUrl: string = '';
    
    if (typeof responseData === 'string') {
        // 如果data直接是字符串
        uploadUrl = responseData;
        imageUrl = responseData;
    } else if (typeof responseData === 'object' && responseData !== null) {
        // 如果data是对象，尝试各种可能的字段名
        uploadUrl = responseData.uploadUrl || responseData.putUrl || responseData.signedUrl || '';
        imageUrl = responseData.url || responseData.imageUrl || responseData.accessUrl || responseData.cdnUrl || '';
    }
    
    console.log('Parsed uploadUrl:', uploadUrl);
    console.log('Parsed imageUrl:', imageUrl);
    
    if (!uploadUrl || typeof uploadUrl !== 'string') {
        console.error('Invalid upload URL:', uploadUrl);
        throw new Error('获取上传URL失败，返回的URL格式不正确');
    }
    
    // 第二步：上传文件到获取的URL
    try {
        await axios.put(uploadUrl, file, {
            headers: {
                'Content-Type': file.type
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(progress);
                }
            }
        });
    } catch (error) {
        console.error('Upload failed:', error);
        throw new Error('文件上传失败');
    }
    
    // 返回图片URL
    const finalUrl = imageUrl || uploadUrl.split('?')[0];
    console.log('Final image URL:', finalUrl);
    
    if (!finalUrl || typeof finalUrl !== 'string') {
        throw new Error('获取图片URL失败');
    }
    
    return finalUrl;
}
