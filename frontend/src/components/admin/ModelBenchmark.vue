<template>
  <div class="model-benchmark">
    <!-- 模型选择区域 -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">选择测试模型</h2>
      
      <!-- 加载模型列表 -->
      <div v-if="loadingModels" class="text-center py-4">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p class="mt-2 text-gray-600">加载模型列表...</p>
      </div>

      <!-- 模型列表 -->
      <div v-else-if="models.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
        <label
          v-for="model in models"
          :key="model.name"
          class="flex items-start p-3 border rounded hover:bg-gray-50 cursor-pointer"
        >
          <input
            type="checkbox"
            :value="model.name"
            v-model="selectedModels"
            class="mt-1 mr-3"
          />
          <div class="flex-1">
            <div class="font-medium">{{ model.displayName }}</div>
            <div class="text-sm text-gray-600">{{ model.description }}</div>
            <div class="text-xs text-gray-500 mt-1">
              支持: {{ model.supportedGenerationMethods.join(', ') }}
            </div>
          </div>
        </label>
      </div>

      <!-- 无模型提示 -->
      <div v-else class="text-center py-8 text-gray-500">
        <p>暂无可用模型</p>
        <button
          @click="loadModels"
          class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          重新加载
        </button>
      </div>

      <!-- 测速选项 -->
      <div v-if="models.length > 0" class="mt-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            测试提示词（可选）
          </label>
          <input
            v-model="testPrompt"
            type="text"
            placeholder="留空使用默认提示词"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div class="flex items-center space-x-4">
          <label class="flex items-center">
            <input
              v-model="warmup"
              type="checkbox"
              class="mr-2"
            />
            <span class="text-sm">预热模式</span>
          </label>
        </div>

        <!-- 开始测速按钮 -->
        <button
          @click="startBenchmark"
          :disabled="selectedModels.length === 0 || benchmarking"
          class="w-full px-4 py-3 bg-blue-500 text-white rounded font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {{ benchmarking ? '测速中...' : `开始测速 (${selectedModels.length} 个模型)` }}
        </button>
      </div>
    </div>

    <!-- 测速进度 -->
    <div v-if="benchmarking" class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">测速进度</h2>
      <div class="space-y-3">
        <div
          v-for="(progress, modelName) in benchmarkProgress"
          :key="modelName"
          class="flex items-center"
        >
          <div class="w-48 text-sm font-medium truncate">{{ modelName }}</div>
          <div class="flex-1 mx-4">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                :class="[
                  'h-2 rounded-full transition-all',
                  progress.status === 'completed' ? 'bg-green-500' :
                  progress.status === 'error' ? 'bg-red-500' :
                  'bg-blue-500'
                ]"
                :style="{ width: progress.progress + '%' }"
              ></div>
            </div>
          </div>
          <div class="w-20 text-sm text-right">
            <span v-if="progress.status === 'completed'" class="text-green-600">✓ 完成</span>
            <span v-else-if="progress.status === 'error'" class="text-red-600">✗ 失败</span>
            <span v-else class="text-blue-600">{{ progress.progress }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 测速结果 -->
    <div v-if="benchmarkResults.length > 0" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">测速结果</h2>
      
      <!-- 结果表格 -->
      <div class="overflow-x-auto mb-6">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  @click="sortResults('modelName')">
                模型名称 {{ sortKey === 'modelName' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  @click="sortResults('totalResponseTime')">
                总响应时间 (ms) {{ sortKey === 'totalResponseTime' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  @click="sortResults('firstTokenTime')">
                首 Token 时间 (ms) {{ sortKey === 'firstTokenTime' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  @click="sortResults('tokensPerSecond')">
                Token/秒 {{ sortKey === 'tokensPerSecond' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="result in sortedResults" :key="result.id">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ result.modelName }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ result.totalResponseTime }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ result.firstTokenTime || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ result.tokensPerSecond ? result.tokensPerSecond.toFixed(2) : 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span v-if="result.success" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  成功
                </span>
                <span v-else class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800"
                      :title="result.errorMessage || ''">
                  失败
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 图表可视化 -->
      <div class="mt-6">
        <h3 class="text-md font-semibold mb-4">性能对比图</h3>
        <div class="h-80">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js';
import {
  getModelList,
  benchmarkMultipleModels,
  type ModelInfo,
  type BenchmarkResult,
  type BenchmarkOptions
} from '../../api/gemini-admin';

// 注册 Chart.js 组件
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

// 状态
const models = ref<ModelInfo[]>([]);
const loadingModels = ref(false);
const selectedModels = ref<string[]>([]);
const testPrompt = ref('');
const warmup = ref(false);
const benchmarking = ref(false);
const benchmarkProgress = ref<Record<string, { progress: number; status: string }>>({});
const benchmarkResults = ref<BenchmarkResult[]>([]);
const sortKey = ref<string>('totalResponseTime');
const sortOrder = ref<'asc' | 'desc'>('asc');

// 加载模型列表
async function loadModels() {
  loadingModels.value = true;
  try {
    models.value = await getModelList();
  } catch (error: any) {
    console.error('加载模型列表失败:', error);
    alert('加载模型列表失败: ' + (error.message || '未知错误'));
  } finally {
    loadingModels.value = false;
  }
}

// 开始测速
async function startBenchmark() {
  if (selectedModels.value.length === 0) return;

  benchmarking.value = true;
  benchmarkResults.value = [];
  benchmarkProgress.value = {};

  // 初始化进度
  selectedModels.value.forEach(modelName => {
    benchmarkProgress.value[modelName] = { progress: 0, status: 'pending' };
  });

  const options: BenchmarkOptions = {
    warmup: warmup.value
  };
  if (testPrompt.value.trim()) {
    options.prompt = testPrompt.value.trim();
  }

  try {
    // 使用批量测速 API
    const results = await benchmarkMultipleModels(selectedModels.value, options);
    
    // 更新结果
    benchmarkResults.value = results;
    
    // 更新进度为完成
    results.forEach(result => {
      if (benchmarkProgress.value[result.modelName]) {
        benchmarkProgress.value[result.modelName] = {
          progress: 100,
          status: result.success ? 'completed' : 'error'
        };
      }
    });
  } catch (error: any) {
    console.error('测速失败:', error);
    alert('测速失败: ' + (error.message || '未知错误'));
    
    // 标记所有为错误
    Object.keys(benchmarkProgress.value).forEach(modelName => {
      benchmarkProgress.value[modelName] = { progress: 100, status: 'error' };
    });
  } finally {
    benchmarking.value = false;
  }
}

// 排序结果
function sortResults(key: string) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
}

// 排序后的结果
const sortedResults = computed(() => {
  const results = [...benchmarkResults.value];
  results.sort((a, b) => {
    let aVal: any = a[sortKey.value as keyof BenchmarkResult];
    let bVal: any = b[sortKey.value as keyof BenchmarkResult];
    
    // 处理 null 值
    if (aVal === null) aVal = sortOrder.value === 'asc' ? Infinity : -Infinity;
    if (bVal === null) bVal = sortOrder.value === 'asc' ? Infinity : -Infinity;
    
    if (sortOrder.value === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
  return results;
});

// 图表数据
const chartData = computed(() => {
  const successResults = benchmarkResults.value.filter(r => r.success);
  return {
    labels: successResults.map(r => r.modelName),
    datasets: [
      {
        label: '总响应时间 (ms)',
        data: successResults.map(r => r.totalResponseTime),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1
      },
      {
        label: '首 Token 时间 (ms)',
        data: successResults.map(r => r.firstTokenTime || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1
      }
    ]
  };
});

// 图表选项
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: true,
      text: '模型性能对比'
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: '时间 (ms)'
      }
    }
  }
};

// 组件挂载时加载模型列表
onMounted(() => {
  loadModels();
});
</script>

<style scoped>
.model-benchmark {
  /* 样式已通过 Tailwind CSS 处理 */
}
</style>
