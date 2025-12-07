<template>
  <div class="min-h-screen bg-gray-100">
    <!-- 顶部导航栏 -->
    <nav class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center">
              <h1 class="text-xl font-bold text-gray-900">Gemini 管理后台</h1>
            </div>
            <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <router-link
                v-for="item in navigation"
                :key="item.path"
                :to="item.path"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="isActive(item.path) 
                  ? 'border-indigo-500 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
              >
                {{ item.name }}
              </router-link>
            </div>
          </div>
          <div class="flex items-center">
            <span class="text-sm text-gray-700 mr-4">{{ adminUser?.username }}</span>
            <button
              @click="handleLogout"
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主内容区域 -->
    <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const navigation = [
  { name: '配置管理', path: '/admin/gemini/config' },
  { name: '密钥管理', path: '/admin/gemini/keys' },
  { name: '日志查看', path: '/admin/gemini/logs' },
  { name: '模型测速', path: '/admin/gemini/benchmark' },
  { name: '统计面板', path: '/admin/gemini/statistics' }
]

const adminUser = ref<any>(null)

onMounted(() => {
  const userStr = localStorage.getItem('adminUser')
  if (userStr) {
    adminUser.value = JSON.parse(userStr)
  }
})

const isActive = (path: string) => {
  return route.path === path
}

const handleLogout = () => {
  localStorage.removeItem('adminLoggedIn')
  localStorage.removeItem('adminUser')
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}
</script>
