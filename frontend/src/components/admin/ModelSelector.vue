<template>
  <div class="model-selector bg-white shadow rounded-lg p-6">
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-lg font-semibold text-gray-900">模型选择</h2>
      <button
        @click="fetchModels"
        :disabled="loadingModels"
        class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
      >
        <RefreshCw :class="{ 'animate-spin': loadingModels }" class="w-4 h-4" />
        <span>{{ loadingModels ? '获取中...' : '获取模型列表' }}</span>
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loadingModels" class="text-center py-8">
      <LoadingSpinner message="正在获取模型列表..." />
    </div>

    <!-- 模型选择表单 -->
    <div v-else class="space-y-4">
      <!-- 文本生成模型 -->
      <div>
        <label for="textModel" class="block text-sm font-medium text-gray-700 mb-2">
          文本生成模型
        </label>
        <select
          id="textModel"
          :value="textModel"
          @change="updateTextModel"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">请选择模型</option>
          <option
            v-for="model in textModels"
            :key="model.name"
            :value="model.name"
          >
            {{ model.displayName }} - {{ model.description }}
          </option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          用于文本生成、对话和内容创作的模型
        </p>
      </div>

      <!-- 视觉分析模型 -->
      <div>
        <label for="visionModel" class="block text-sm font-medium text-gray-700 mb-2">
          视觉分析模型
        </label>
        <select
          id="visionModel"
          :value="visionModel"
          @change="updateVisionModel"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">请选择模型</option>
          <option
            v-for="model in visionModels"
            :key="model.name"
            :value="model.name"
          >
            {{ model.displayName }} - {{ model.description }}
          </option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          用于图像分析、识别和理解的模型
        </p>
      </div>

      <!-- 图像生成模型 -->
      <div>
        <label for="imageGenModel" class="block text-sm font-medium text-gray-700 mb-2">
          图像生成模型
        </label>
        <select
          id="imageGenModel"
          :value="imageGenModel"
          @change="updateImageGenModel"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">请选择模型</option>
          <option
            v-for="model in imageGenModels"
            :key="model.name"
            :value="model.name"
          >
            {{ model.displayName }} - {{ model.description }}
          </option>
        </select>
        <p class="mt-1 text-sm text-gray-500">
          用于根据文本描述生成图像的模型
        </p>
      </div>

      <!-- 模型列表展示 -->
      <div v-if="models.length > 0" class="mt-6">
        <h3 class="text-sm font-medium text-gray-700 mb-3">可用模型列表</h3>
        <div class="border border-gray-200 rounded-md overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  模型名称
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  显示名称
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  描述
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  支持的功能
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="model in models" :key="model.name" class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-mono text-gray-900">
                  {{ model.name }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-900">
                  {{ model.displayName }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  {{ model.description }}
                </td>
                <td class="px-4 py-3 text-sm text-gray-600">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="method in model.supportedGenerationMethods"
                      :key="method"
                      class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {{ method }}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="text-center py-8 text-gray-500">
        <p>点击"获取模型列表"按钮以加载可用模型</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import { getModelList, type ModelInfo } from '@/api/gemini-admin';
import { LoadingSpinner } from '@/components/admin';

// Props
interface Props {
  textModel?: string;
  visionModel?: string;
  imageGenModel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  textModel: '',
  visionModel: '',
  imageGenModel: ''
});

// Emits
const emit = defineEmits<{
  'update:textModel': [value: string];
  'update:visionModel': [value: string];
  'update:imageGenModel': [value: string];
  'error': [message: string];
}>();

// 状态管理
const loadingModels = ref(false);
const models = ref<ModelInfo[]>([]);

// 计算属性：按类型分类模型
const textModels = computed(() => {
  return models.value.filter((model: ModelInfo) => 
    model.supportedGenerationMethods.includes('generateContent') ||
    model.name.includes('gemini')
  );
});

const visionModels = computed(() => {
  return models.value.filter((model: ModelInfo) => 
    model.supportedGenerationMethods.includes('generateContent') &&
    (model.name.includes('vision') || model.name.includes('gemini'))
  );
});

const imageGenModels = computed(() => {
  return models.value.filter((model: ModelInfo) => 
    model.name.includes('imagen') ||
    model.supportedGenerationMethods.includes('generateImage')
  );
});

// 获取模型列表
async function fetchModels() {
  loadingModels.value = true;
  
  try {
    const data = await getModelList();
    models.value = data;
    
    // 如果当前选择的模型不在列表中，清空选择
    if (props.textModel && !textModels.value.find((m: ModelInfo) => m.name === props.textModel)) {
      emit('update:textModel', '');
    }
    if (props.visionModel && !visionModels.value.find((m: ModelInfo) => m.name === props.visionModel)) {
      emit('update:visionModel', '');
    }
    if (props.imageGenModel && !imageGenModels.value.find((m: ModelInfo) => m.name === props.imageGenModel)) {
      emit('update:imageGenModel', '');
    }
  } catch (err: any) {
    emit('error', err.message || '获取模型列表失败');
    console.error('获取模型列表失败:', err);
  } finally {
    loadingModels.value = false;
  }
}

// 更新模型选择
function updateTextModel(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:textModel', target.value);
}

function updateVisionModel(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:visionModel', target.value);
}

function updateImageGenModel(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:imageGenModel', target.value);
}
</script>

<style scoped>
.model-selector {
  /* 组件特定样式 */
}
</style>
