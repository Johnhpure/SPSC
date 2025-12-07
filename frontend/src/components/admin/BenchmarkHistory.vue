<template>
  <div class="benchmark-history">
    <!-- 筛选区域 -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">筛选条件</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            模型名称
          </label>
          <select
            v-model="filterModel"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部模型</option>
            <option v-for="model in availableModels" :key="model" :value="model">
              {{ model }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            显示数量
          </label>
          <select
            v-model="limit"
            class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option :value="10">最近 10 条</option>
            <option :value="20">最近 20 条</option>
            <option :value="50">最近 50 条</option>
            <option :value="100">最近 100 条</option>
          </select>
        </div>

        <div class="flex items-end">
          <button
            @click="loadHistory"
            class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            查询
          </button>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <p class="mt-2 text-gray-600">加载历史记录...</p>
    </div>

    <!-- 历史记录表格 -->
    <div v-else-if="history.length > 0" class="bg-white rounded-lg shadow p-6 mb-6">
      <h2 class="text-lg font-semibold mb-4">历史记录</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                时间
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                模型名称
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                总响应时间 (ms)
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                首 Token 时间 (ms)
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Token/秒
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="record in history" :key="record.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(record.timestamp) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ record.modelName }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ record.totalResponseTime }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ record.firstTokenTime || 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ record.tokensPerSecond ? record.tokensPerSecond.toFixed(2) : 'N/A' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span v-if="record.success" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                  成功
                </span>
                <span v-else class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800"
                      :title="record.errorMessage || ''">
                  失败
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 无数据提示 -->
    <div v-else class="bg-white rounded-lg shadow p-6 text-center text-gray-500">
      <p>暂无历史记录</p>
    </div>

    <!-- 趋势图 -->
    <div v-if="history.length > 0" class="bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold mb-4">性能趋势</h2>
      <div class="h-80">
        <Line :data="trendChartData" :options="trendChartOptions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement
} from 'chart.js';
import {
  getBenchmarkHistory,
  type BenchmarkResult
} from '../../api/gemini-admin';

// 注册 Chart.js 组件
ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement);

// 状态
const loading = ref(false);
const history = ref<BenchmarkResult[]>([]);
const filterModel = ref('');
const limit = ref(20);
const availableModels = ref<string[]>([]);

// 加载历史记录
async function loadHistory() {
  loading.value = true;
  try {
    const modelName = filterModel.value || undefined;
    history.value = await getBenchmarkHistory(modelName, limit.value);
    
    // 提取可用的模型名称
    const modelSet = new Set<string>();
    history.value.forEach(record => {
      modelSet.add(record.modelName);
    });
    availableModels.value = Array.from(modelSet).sort();
  } catch (error: any) {
    console.error('加载历史记录失败:', error);
    alert('加载历史记录失败: ' + (error.message || '未知错误'));
  } finally {
    loading.value = false;
  }
}

// 格式化日期
function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 趋势图数据
const trendChartData = computed(() => {
  // 按模型分组
  const groupedByModel: Record<string, BenchmarkResult[]> = {};
  history.value.forEach(record => {
    if (record.success) {
      if (!groupedByModel[record.modelName]) {
        groupedByModel[record.modelName] = [];
      }
      groupedByModel[record.modelName]!.push(record);
    }
  });

  // 生成数据集
  const datasets = Object.entries(groupedByModel).map(([modelName, records], index) => {
    const colors = [
      'rgb(59, 130, 246)',   // blue
      'rgb(16, 185, 129)',   // green
      'rgb(245, 158, 11)',   // yellow
      'rgb(239, 68, 68)',    // red
      'rgb(139, 92, 246)',   // purple
      'rgb(236, 72, 153)',   // pink
    ];
    const color = colors[index % colors.length] || 'rgb(59, 130, 246)';

    return {
      label: modelName,
      data: records.map(r => r.totalResponseTime),
      borderColor: color,
      backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
      tension: 0.1
    };
  });

  // 使用时间戳作为标签
  const labels = history.value
    .filter(r => r.success)
    .map(r => formatDate(r.timestamp));

  return {
    labels,
    datasets
  };
});

// 趋势图选项
const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
    },
    title: {
      display: true,
      text: '响应时间趋势'
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      title: {
        display: true,
        text: '响应时间 (ms)'
      }
    },
    x: {
      title: {
        display: true,
        text: '测试时间'
      }
    }
  }
};

// 组件挂载时加载历史记录
onMounted(() => {
  loadHistory();
});
</script>

<style scoped>
.benchmark-history {
  /* 样式已通过 Tailwind CSS 处理 */
}
</style>
