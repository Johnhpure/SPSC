<template>
    <div class="p-8">
        <!-- 页面标题 -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-white mb-2">商品分类管理</h1>
            <p class="text-slate-400">管理官方分类和商家自定义分类</p>
        </div>

        <!-- 标签页切换 -->
        <div class="flex gap-4 mb-6">
            <button
                @click="activeTab = 'official'"
                class="px-6 py-3 rounded-lg font-medium transition"
                :class="activeTab === 'official' 
                    ? 'bg-indigo-500 text-white' 
                    : 'glass text-slate-400 hover:text-white'"
            >
                官方分类
            </button>
            <button
                @click="activeTab = 'merchant'"
                class="px-6 py-3 rounded-lg font-medium transition"
                :class="activeTab === 'merchant' 
                    ? 'bg-indigo-500 text-white' 
                    : 'glass text-slate-400 hover:text-white'"
            >
                商家分类
            </button>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="flex items-center justify-center py-20">
            <div class="flex flex-col items-center gap-4">
                <div class="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <p class="text-slate-400">加载中...</p>
            </div>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="glass rounded-xl p-8 text-center">
            <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle class="w-8 h-8 text-red-400" />
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">加载失败</h3>
            <p class="text-slate-400 mb-4">{{ error }}</p>
            <button
                @click="loadCategories"
                class="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition"
            >
                重试
            </button>
        </div>

        <!-- 官方分类内容 -->
        <div v-else-if="activeTab === 'official'" class="space-y-4">
            <div v-if="officialCategories.length === 0" class="glass rounded-xl p-8 text-center">
                <p class="text-slate-400">暂无官方分类</p>
            </div>
            <div
                v-for="category in officialCategories"
                :key="category.id || category.catId"
                class="glass rounded-xl overflow-hidden"
            >
                <button
                    @click="toggleCategory(category.id || category.catId)"
                    class="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
                >
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                            <FolderTree class="w-5 h-5 text-white" />
                        </div>
                        <div class="text-left">
                            <h3 class="text-white font-medium">{{ category.name || category.catName }}</h3>
                            <p class="text-sm text-slate-400">ID: {{ category.id || category.catId }}</p>
                        </div>
                    </div>
                    <ChevronDown
                        class="w-5 h-5 text-slate-400 transition-transform"
                        :class="{ 'rotate-180': expandedCategories.has(category.id || category.catId) }"
                    />
                </button>

                <!-- 二级分类 -->
                <div
                    v-if="expandedCategories.has(category.id || category.catId)"
                    class="border-t border-white/5 bg-white/5 p-4"
                >
                    <div v-if="category.children && category.children.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div
                            v-for="child in category.children"
                            :key="child.id || child.catId"
                            class="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition"
                        >
                            <p class="text-white text-sm font-medium">{{ child.name || child.catName }}</p>
                            <p class="text-xs text-slate-400 mt-1">ID: {{ child.id || child.catId }}</p>
                        </div>
                    </div>
                    <div v-else class="text-center py-4 text-slate-400 text-sm">
                        暂无二级分类
                    </div>
                </div>
            </div>
        </div>

        <!-- 商家分类内容 -->
        <div v-else-if="activeTab === 'merchant'" class="space-y-4">
            <div v-if="merchantCategories.length === 0" class="glass rounded-xl p-8 text-center">
                <p class="text-slate-400">暂无商家分类</p>
            </div>
            <div
                v-for="category in merchantCategories"
                :key="category.id || category.catId"
                class="glass rounded-xl overflow-hidden"
            >
                <button
                    @click="toggleCategory(category.id || category.catId)"
                    class="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition"
                >
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <Layers class="w-5 h-5 text-white" />
                        </div>
                        <div class="text-left">
                            <h3 class="text-white font-medium">{{ category.name || category.catName }}</h3>
                            <p class="text-sm text-slate-400">ID: {{ category.id || category.catId }}</p>
                        </div>
                    </div>
                    <ChevronDown
                        class="w-5 h-5 text-slate-400 transition-transform"
                        :class="{ 'rotate-180': expandedCategories.has(category.id || category.catId) }"
                    />
                </button>

                <!-- 二级分类 -->
                <div
                    v-if="expandedCategories.has(category.id || category.catId)"
                    class="border-t border-white/5 bg-white/5 p-4"
                >
                    <div v-if="category.children && category.children.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div
                            v-for="child in category.children"
                            :key="child.id || child.catId"
                            class="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition"
                        >
                            <p class="text-white text-sm font-medium">{{ child.name || child.catName }}</p>
                            <p class="text-xs text-slate-400 mt-1">ID: {{ child.id || child.catId }}</p>
                        </div>
                    </div>
                    <div v-else class="text-center py-4 text-slate-400 text-sm">
                        暂无二级分类
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { FolderTree, Layers, ChevronDown, AlertCircle } from 'lucide-vue-next';
import { getOfficialCategories, getMerchantCategories } from '../api/pinhaopin';

const activeTab = ref<'official' | 'merchant'>('official');
const loading = ref(false);
const error = ref('');
const officialCategories = ref<any[]>([]);
const merchantCategories = ref<any[]>([]);
const expandedCategories = ref<Set<string | number>>(new Set());

const shopId = computed(() => localStorage.getItem('shopId') || '332');

// 切换分类展开/收起
const toggleCategory = (id: string | number) => {
    if (expandedCategories.value.has(id)) {
        expandedCategories.value.delete(id);
    } else {
        expandedCategories.value.add(id);
    }
};

// 加载分类数据
const loadCategories = async () => {
    loading.value = true;
    error.value = '';
    
    try {
        // 并行加载官方分类和商家分类
        const [official, merchantLevel1] = await Promise.all([
            getOfficialCategories(),
            getMerchantCategories(shopId.value, 1)
        ]);
        
        officialCategories.value = official || [];
        merchantCategories.value = merchantLevel1 || [];
        
    } catch (err: any) {
        console.error('加载分类失败:', err);
        error.value = err.message || '加载分类数据失败，请稍后重试';
    } finally {
        loading.value = false;
    }
};

onMounted(() => {
    loadCategories();
});
</script>
