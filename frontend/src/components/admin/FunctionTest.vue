<template>
  <div class="function-test">
    <!-- 测试配置区域 -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">功能测试配置</h2>
      
      <!-- 模型选择 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          选择模型
        </label>
        <select
          v-model="selectedModel"
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">请选择模型</option>
          <option v-for="model in models" :key="model.name" :value="model.name">
            {{ model.displayName }}
          </option>
        </select>
      </div>

      <!-- 测试类型选择 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          测试类型
        </label>
        <div class="flex space-x-4">
          <label class="flex items-center">
            <input
              type="radio"
              value="text"
              v-model="testType"
              class="mr-2"
            />
            <span>文本生成</span>
          </label>
          <label class="flex items-center">
            <input
              type="radio"
              value="vision"
              v-model="testType"
              class="mr-2"
            />
            <span>图像分析</span>
          </label>
          <label class="flex items-center">
            <input
              type="radio"
              value="image-gen"
              v-model="testType"
              class="mr-2"
            />
            <span>图像生成</span>
          </label>
        </div>
      </div>

      <!-- 提示词输入 -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          测试提示词
        </label>
        <textarea
          v-model="prompt"
          rows="4"
          placeholder="输入测试提示词..."
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        ></textarea>
      </div>

      <!-- 图像上传（仅图像分析时显示） -->
      <div v-if="testType === 'vision'" class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          上传测试图像
        </label>
        <input
          type="file"
          accept="image/*"
          @change="handleImageUpload"
          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div v-if="uploadedImage" class="mt-4">
          <img :src="uploadedImage" alt="上传的图像" class="max-w-md rounded shadow" />
        </div>
      </div>

      <!-- 开始测试按钮 -->
      <button
        @click="runTest"
        :disabled="!canRunTest || testing"
        class="w-full px-4 py-3 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {{ testing ? '测试中...' : '开始测试' }}
      </button>
    </div>

    <!-- 测试结果 -->
    <div v-if="testResult" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">测试结果</h2>
      
      <!-- 成功结果 -->
      <div v-if="testResult.success">
        <!-- 文本生成结果 -->
        <div v-if="testType === 'text'" class="space-y-4">
          <div>
            <h3 class="text-md font-medium mb-2">生成的文本</h3>
            <div class="p-4 bg-gray-50 rounded border whitespace-pre-wrap">
              {{ testResult.text }}
            </div>
          </div>
          <div v-if="testResult.metadata" class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-sm text-gray-600">响应时间:</span>
              <span class="ml-2 font-medium">{{ testResult.metadata.responseTime }} ms</span>
            </div>
            <div v-if="testResult.metadata.tokenCount">
              <span class="text-sm text-gray-600">Token 数量:</span>
              <span class="ml-2 font-medium">{{ testResult.metadata.tokenCount }}</span>
            </div>
          </div>
        </div>

        <!-- 图像分析结果 -->
        <div v-else-if="testType === 'vision'" class="space-y-4">
          <div>
            <h3 class="text-md font-medium mb-2">分析结果</h3>
            <div class="p-4 bg-gray-50 rounded border whitespace-pre-wrap">
              {{ testResult.text }}
            </div>
          </div>
          <div v-if="testResult.metadata" class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-sm text-gray-600">响应时间:</span>
              <span class="ml-2 font-medium">{{ testResult.metadata.responseTime }} ms</span>
            </div>
          </div>
        </div>

        <!-- 图像生成结果 -->
        <div v-else-if="testType === 'image-gen'" class="space-y-4">
          <div>
            <h3 class="text-md font-medium mb-2">生成的图像</h3>
            <div v-if="testResult.imageUrl" class="mt-4">
              <img :src="testResult.imageUrl" alt="生成的图像" class="max-w-2xl rounded shadow" />
            </div>
            <div v-else class="p-4 bg-gray-50 rounded border">
              <p class="text-gray-600">图像数据: {{ testResult.imageData ? '已生成' : '无' }}</p>
            </div>
          </div>
          <div v-if="testResult.metadata" class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-sm text-gray-600">响应时间:</span>
              <span class="ml-2 font-medium">{{ testResult.metadata.responseTime }} ms</span>
            </div>
            <div v-if="testResult.metadata.imageSize">
              <span class="text-sm text-gray-600">图像尺寸:</span>
              <span class="ml-2 font-medium">{{ testResult.metadata.imageSize }}</span>
            </div>
          </div>
        </div>

        <!-- 完整元数据 -->
        <div v-if="testResult.metadata" class="mt-6">
          <h3 class="text-md font-medium mb-2">完整元数据</h3>
          <pre class="p-4 bg-gray-50 rounded border text-xs overflow-x-auto">{{ JSON.stringify(testResult.metadata, null, 2) }}</pre>
        </div>
      </div>

      <!-- 失败结果 -->
      <div v-else class="space-y-4">
        <div class="p-4 bg-red-50 border border-red-200 rounded">
          <h3 class="text-md font-medium text-red-800 mb-2">测试失败</h3>
          <p class="text-red-700">{{ testResult.error }}</p>
        </div>
        <div v-if="testResult.details">
          <h3 class="text-md font-medium mb-2">错误详情</h3>
          <pre class="p-4 bg-gray-50 rounded border text-xs overflow-x-auto">{{ JSON.stringify(testResult.details, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  getModelList,
  testModel,
  type ModelInfo
} from '../../api/gemini-admin';

// 状态
const models = ref<ModelInfo[]>([]);
const selectedModel = ref('');
const testType = ref<'text' | 'vision' | 'image-gen'>('text');
const prompt = ref('');
const uploadedImage = ref<string | null>(null);
const uploadedImageFile = ref<File | null>(null);
const testing = ref(false);
const testResult = ref<any>(null);

// 是否可以运行测试
const canRunTest = computed(() => {
  if (!selectedModel.value || !prompt.value.trim()) {
    return false;
  }
  if (testType.value === 'vision' && !uploadedImage.value) {
    return false;
  }
  return true;
});

// 加载模型列表
async function loadModels() {
  try {
    models.value = await getModelList();
  } catch (error: any) {
    console.error('加载模型列表失败:', error);
    alert('加载模型列表失败: ' + (error.message || '未知错误'));
  }
}

// 处理图像上传
function handleImageUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    uploadedImageFile.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImage.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

// 运行测试
async function runTest() {
  if (!canRunTest.value) return;

  testing.value = true;
  testResult.value = null;

  try {
    const options: any = {
      type: testType.value
    };

    // 如果是图像分析，需要上传图像
    if (testType.value === 'vision' && uploadedImageFile.value) {
      // 将图像转换为 base64
      const base64 = uploadedImage.value?.split(',')[1];
      options.image = base64;
    }

    const result = await testModel(selectedModel.value, prompt.value, options);
    
    testResult.value = {
      success: true,
      ...result
    };
  } catch (error: any) {
    console.error('测试失败:', error);
    testResult.value = {
      success: false,
      error: error.message || '测试失败',
      details: error.details || error
    };
  } finally {
    testing.value = false;
  }
}

// 组件挂载时加载模型列表
onMounted(() => {
  loadModels();
});
</script>

<style scoped>
.function-test {
  /* 样式已通过 Tailwind CSS 处理 */
}
</style>
