<template>
  <div class="config-management p-6">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">配置管理</h1>
    <p class="text-gray-600 mb-6">管理 Gemini API 配置、模型选择和配置备份</p>
    
    <!-- 配置表单 -->
    <div class="bg-white rounded-lg shadow p-6">
      <form @submit.prevent="handleSave" class="space-y-6">
        <!-- Base URL -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Base URL
          </label>
          <div class="flex gap-2">
            <input
              v-model="formData.baseUrl"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://generativelanguage.googleapis.com"
              required
            />
            <button
              type="button"
              @click="handleValidateUrl"
              :disabled="validating || !formData.baseUrl"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ validating ? '验证中...' : '验证' }}
            </button>
          </div>
          <p v-if="urlValidation.message" :class="urlValidation.isValid ? 'text-green-600' : 'text-red-600'" class="text-sm mt-1">
            {{ urlValidation.message }}
          </p>
        </div>

        <!-- 模型选择 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            模型
          </label>
          <div class="flex gap-2">
            <select
              v-model="formData.model"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">请选择模型</option>
              <option v-for="model in models" :key="model.name" :value="model.name">
                {{ model.displayName }} - {{ model.description }}
              </option>
            </select>
            <button
              type="button"
              @click="loadModels"
              :disabled="loadingModels"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loadingModels ? '加载中...' : '刷新' }}
            </button>
          </div>
        </div>

        <!-- API Version (可选) -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            API Version (可选)
          </label>
          <input
            v-model="formData.apiVersion"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="v1beta"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-3 pt-4">
          <button
            type="submit"
            :disabled="saving"
            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
          <button
            type="button"
            @click="handleExport"
            class="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            导出配置
          </button>
          <button
            type="button"
            @click="triggerImport"
            class="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            导入配置
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            @change="handleImport"
            class="hidden"
          />
        </div>
      </form>
    </div>

    <!-- 当前配置信息 -->
    <div v-if="currentConfig" class="mt-6 bg-gray-50 rounded-lg p-4">
      <h3 class="text-sm font-medium text-gray-700 mb-2">当前配置</h3>
      <pre class="text-xs text-gray-600 overflow-auto">{{ JSON.stringify(currentConfig, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getConfig, updateConfig, validateUrl, getModels, exportConfig, importConfig, type GeminiConfig, type ModelInfo } from '../../api/admin';

// 表单数据
const formData = ref<GeminiConfig>({
  baseUrl: '',
  model: '',
  apiVersion: '',
});

// 当前配置
const currentConfig = ref<GeminiConfig | null>(null);

// 模型列表
const models = ref<ModelInfo[]>([]);

// 加载状态
const saving = ref(false);
const validating = ref(false);
const loadingModels = ref(false);

// URL 验证结果
const urlValidation = ref<{ isValid: boolean; message: string }>({
  isValid: false,
  message: '',
});

// 文件输入引用
const fileInput = ref<HTMLInputElement | null>(null);

/**
 * 加载当前配置
 */
async function loadConfig() {
  try {
    const config = await getConfig();
    currentConfig.value = config;
    formData.value = { ...config };
  } catch (error: any) {
    alert('加载配置失败: ' + (error.response?.data?.error?.message || error.message));
  }
}

/**
 * 加载模型列表
 */
async function loadModels() {
  loadingModels.value = true;
  try {
    models.value = await getModels();
  } catch (error: any) {
    alert('加载模型列表失败: ' + (error.response?.data?.error?.message || error.message));
  } finally {
    loadingModels.value = false;
  }
}

/**
 * 验证 URL
 */
async function handleValidateUrl() {
  if (!formData.value.baseUrl) return;
  
  validating.value = true;
  urlValidation.value = { isValid: false, message: '' };
  
  try {
    await validateUrl(formData.value.baseUrl);
    urlValidation.value = { isValid: true, message: '✓ URL 格式有效' };
  } catch (error: any) {
    urlValidation.value = { 
      isValid: false, 
      message: '✗ ' + (error.response?.data?.error?.message || error.message) 
    };
  } finally {
    validating.value = false;
  }
}

/**
 * 保存配置
 */
async function handleSave() {
  saving.value = true;
  try {
    await updateConfig(formData.value);
    alert('配置保存成功');
    await loadConfig();
  } catch (error: any) {
    alert('保存配置失败: ' + (error.response?.data?.error?.message || error.message));
  } finally {
    saving.value = false;
  }
}

/**
 * 导出配置
 */
async function handleExport() {
  try {
    const blob = await exportConfig();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    alert('导出配置失败: ' + (error.response?.data?.error?.message || error.message));
  }
}

/**
 * 触发文件选择
 */
function triggerImport() {
  fileInput.value?.click();
}

/**
 * 导入配置
 */
async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (!file) return;
  
  try {
    await importConfig(file);
    alert('配置导入成功');
    await loadConfig();
    await loadModels();
  } catch (error: any) {
    alert('导入配置失败: ' + (error.response?.data?.error?.message || error.message));
  } finally {
    // 清空文件选择
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadConfig();
  loadModels();
});
</script>
