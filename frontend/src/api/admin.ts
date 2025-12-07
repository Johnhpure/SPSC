/**
 * 管理后台 API 客户端
 * 自动附加 Authorization token
 */

import axios, { AxiosInstance } from 'axios';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: '/api/gemini-admin',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：自动添加 token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：处理认证错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 清除 token 并跳转到登录页
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// 配置管理 API
// ============================================================================

export interface GeminiConfig {
  baseUrl: string;
  model: string;
  apiVersion?: string;
}

export interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
  supportedGenerationMethods: string[];
}

/**
 * 获取当前配置
 */
export async function getConfig(): Promise<GeminiConfig> {
  const response = await apiClient.get('/config');
  return response.data.data;
}

/**
 * 更新配置
 */
export async function updateConfig(config: Partial<GeminiConfig>): Promise<void> {
  await apiClient.put('/config', config);
}

/**
 * 验证 Base URL 格式
 */
export async function validateUrl(url: string): Promise<void> {
  await apiClient.post('/config/validate-url', { url });
}

/**
 * 获取可用模型列表
 */
export async function getModels(): Promise<ModelInfo[]> {
  const response = await apiClient.get('/models');
  return response.data.data;
}

/**
 * 导出配置
 */
export async function exportConfig(): Promise<Blob> {
  const response = await apiClient.post('/config/export', {}, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * 导入配置
 */
export async function importConfig(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('config', file);
  await apiClient.post('/config/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

// ============================================================================
// 密钥管理 API
// ============================================================================

export interface ApiKey {
  id: number;
  key_name: string;
  key_value: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 获取密钥列表
 */
export async function getKeys(): Promise<ApiKey[]> {
  const response = await apiClient.get('/keys');
  return response.data.data;
}

/**
 * 添加密钥
 */
export async function addKey(keyName: string, keyValue: string): Promise<void> {
  await apiClient.post('/keys', { keyName, keyValue });
}

/**
 * 批量添加密钥
 */
export async function addKeysBatch(keys: Array<{ keyName: string; keyValue: string }>): Promise<void> {
  await apiClient.post('/keys/batch', { keys });
}

/**
 * 更新密钥
 */
export async function updateKey(id: number, keyName: string, keyValue: string): Promise<void> {
  await apiClient.put(`/keys/${id}`, { keyName, keyValue });
}

/**
 * 删除密钥
 */
export async function deleteKey(id: number): Promise<void> {
  await apiClient.delete(`/keys/${id}`);
}

/**
 * 切换密钥启用状态
 */
export async function toggleKey(id: number): Promise<void> {
  await apiClient.patch(`/keys/${id}/toggle`);
}

export default apiClient;
