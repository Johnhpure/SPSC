<template>
  <div class="statistics-dashboard p-6">
    <h1 class="text-2xl font-bold text-gray-900 mb-6">统计面板</h1>
    <p class="text-gray-600">查看 API 调用统计和性能指标</p>
    
    <!-- 统计图表将在这里实现 -->
    <div class="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-sm text-gray-600">总调用次数</p>
        <p class="text-3xl font-bold text-gray-900 mt-2">0</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-sm text-gray-600">成功率</p>
        <p class="text-3xl font-bold text-green-600 mt-2">0%</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-sm text-gray-600">平均响应时间</p>
        <p class="text-3xl font-bold text-purple-600 mt-2">0ms</p>
      </div>
      <div class="bg-white rounded-lg shadow p-6">
        <p class="text-sm text-gray-600">Token 使用量</p>
        <p class="text-3xl font-bold text-orange-600 mt-2">0</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 统计面板逻辑
</script>
