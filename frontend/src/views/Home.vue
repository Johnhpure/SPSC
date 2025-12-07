<template>
    <div class="min-h-screen bg-slate-950 overflow-hidden">
        <!-- 主内容区 -->
        <main class="max-w-7xl mx-auto px-6 py-8">
            <!-- 加载状态 -->
            <div v-if="loading" class="flex items-center justify-center py-20">
                <div class="text-center">
                    <div class="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p class="text-slate-400">加载中...</p>
                </div>
            </div>

            <!-- 店铺信息 -->
            <div v-else-if="currentShop" class="space-y-8">
                <!-- 店铺概览卡片 -->
                <div class="glass-card p-8">
                    <div class="flex items-start justify-between mb-6">
                        <div class="flex items-center gap-4">
                            <!-- 店铺图标 -->
                            <div v-if="currentShop.icon" class="w-20 h-20 rounded-2xl overflow-hidden shadow-lg shadow-indigo-500/20 flex-shrink-0">
                                <img :src="currentShop.icon" :alt="currentShop.name" class="w-full h-full object-cover" />
                            </div>
                            <div v-else class="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-indigo-500/20 flex-shrink-0">
                                {{ currentShop.name?.charAt(0) || 'S' }}
                            </div>
                            <div>
                                <h2 class="text-2xl font-bold text-white mb-1">{{ currentShop.name || '我的店铺' }}</h2>
                                <div class="flex items-center gap-3 flex-wrap">
                                    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                                        :class="getStatusClass(currentShop.status)">
                                        <span class="w-1.5 h-1.5 rounded-full mr-1.5" :class="getStatusDotClass(currentShop.status)"></span>
                                        {{ getStatusText(currentShop.status) }}
                                    </span>
                                    <span class="text-sm text-slate-400">ID: {{ currentShop.id }}</span>
                                    <span v-if="currentShop.shopType" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                        {{ getShopTypeText(currentShop.shopType) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <button class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition flex items-center gap-2">
                            <Settings class="w-4 h-4" />
                            店铺设置
                        </button>
                    </div>

                    <!-- 店铺详细信息 -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div v-if="currentShop.address" class="bg-white/5 rounded-lg p-4 border border-white/5">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-xs text-slate-500 mb-1">店铺地址</p>
                                    <p class="text-sm text-white break-words">{{ currentShop.address }}</p>
                                </div>
                            </div>
                        </div>

                        <div v-if="currentShop.contactMobile" class="bg-white/5 rounded-lg p-4 border border-white/5">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-slate-500 mb-1">联系电话</p>
                                    <p class="text-sm text-white">{{ currentShop.contactMobile }}</p>
                                </div>
                            </div>
                        </div>

                        <div v-if="currentShop.profitSharingRatio !== null && currentShop.profitSharingRatio !== undefined" class="bg-white/5 rounded-lg p-4 border border-white/5">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-slate-500 mb-1">分润比例</p>
                                    <p class="text-sm text-white">{{ currentShop.profitSharingRatio }}%</p>
                                </div>
                            </div>
                        </div>

                        <div v-if="currentShop.gmtCreate" class="bg-white/5 rounded-lg p-4 border border-white/5">
                            <div class="flex items-start gap-3">
                                <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                    <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-xs text-slate-500 mb-1">创建时间</p>
                                    <p class="text-sm text-white">{{ formatDate(currentShop.gmtCreate) }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 统计数据 -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-indigo-500/30 transition">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-slate-400 text-sm">商品总数</span>
                                <Package class="w-5 h-5 text-indigo-400" />
                            </div>
                            <p class="text-2xl font-bold text-white">{{ stats.totalProducts }}</p>
                        </div>
                        
                        <div class="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-emerald-500/30 transition">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-slate-400 text-sm">在售商品</span>
                                <TrendingUp class="w-5 h-5 text-emerald-400" />
                            </div>
                            <p class="text-2xl font-bold text-white">{{ stats.onlineProducts }}</p>
                        </div>
                        
                        <div class="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-amber-500/30 transition">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-slate-400 text-sm">待优化</span>
                                <AlertCircle class="w-5 h-5 text-amber-400" />
                            </div>
                            <p class="text-2xl font-bold text-white">{{ stats.pendingProducts }}</p>
                        </div>
                        
                        <div class="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-slate-400 text-sm">AI 优化</span>
                                <Sparkles class="w-5 h-5 text-purple-400" />
                            </div>
                            <p class="text-2xl font-bold text-white">{{ stats.optimizedProducts }}</p>
                        </div>
                    </div>
                </div>

                <!-- 快捷操作 -->
                <div>
                    <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Zap class="w-5 h-5 text-indigo-400" />
                        快捷操作
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button @click="goToProducts" class="glass-card p-6 text-left hover:bg-white/5 transition group">
                            <div class="flex items-start justify-between mb-3">
                                <div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition">
                                    <Package class="w-6 h-6 text-indigo-400" />
                                </div>
                                <ArrowRight class="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition" />
                            </div>
                            <h4 class="font-semibold text-white mb-1">商品管理</h4>
                            <p class="text-sm text-slate-400">查看和管理店铺商品</p>
                        </button>

                        <button @click="handleBatchOptimize" class="glass-card p-6 text-left hover:bg-white/5 transition group">
                            <div class="flex items-start justify-between mb-3">
                                <div class="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition">
                                    <Sparkles class="w-6 h-6 text-purple-400" />
                                </div>
                                <ArrowRight class="w-5 h-5 text-slate-600 group-hover:text-purple-400 transition" />
                            </div>
                            <h4 class="font-semibold text-white mb-1">AI 批量优化</h4>
                            <p class="text-sm text-slate-400">一键优化全店商品</p>
                        </button>

                        <button class="glass-card p-6 text-left hover:bg-white/5 transition group">
                            <div class="flex items-start justify-between mb-3">
                                <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition">
                                    <BarChart3 class="w-6 h-6 text-emerald-400" />
                                </div>
                                <ArrowRight class="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition" />
                            </div>
                            <h4 class="font-semibold text-white mb-1">数据分析</h4>
                            <p class="text-sm text-slate-400">查看店铺运营数据</p>
                        </button>
                    </div>
                </div>

                <!-- 最近活动 -->
                <div>
                    <h3 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity class="w-5 h-5 text-indigo-400" />
                        最近活动
                    </h3>
                    <div class="glass-card p-6">
                        <div class="space-y-4">
                            <div class="flex items-start gap-4 pb-4 border-b border-white/5 last:border-0 last:pb-0">
                                <div class="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle class="w-5 h-5 text-indigo-400" />
                                </div>
                                <div class="flex-1">
                                    <p class="text-white text-sm mb-1">店铺信息加载成功</p>
                                    <p class="text-slate-500 text-xs">刚刚</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start gap-4 pb-4 border-b border-white/5 last:border-0 last:pb-0">
                                <div class="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                    <UserCheck class="w-5 h-5 text-emerald-400" />
                                </div>
                                <div class="flex-1">
                                    <p class="text-white text-sm mb-1">登录成功</p>
                                    <p class="text-slate-500 text-xs">{{ loginTime }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 无店铺状态 -->
            <div v-else-if="!loading && !currentShop" class="flex items-center justify-center py-20">
                <div class="text-center glass-card p-12 max-w-md">
                    <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-6">
                        <Store class="w-10 h-10 text-indigo-400" />
                    </div>
                    <h3 class="text-xl font-semibold text-white mb-2">暂无店铺</h3>
                    <p class="text-slate-400 mb-6">您还没有创建店铺，请先创建店铺</p>
                    <button class="btn-primary">
                        创建店铺
                    </button>
                </div>
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getMyShopList, getProductList } from '../api/pinhaopin';
import { 
    Settings, Package, TrendingUp, 
    AlertCircle, Sparkles, Zap, ArrowRight, BarChart3, 
    Activity, CheckCircle, UserCheck
} from 'lucide-vue-next';

const router = useRouter();
const loading = ref(true);
const currentShop = ref<any>(null);
const stats = ref({
    totalProducts: 0,
    onlineProducts: 0,
    pendingProducts: 0,
    optimizedProducts: 0
});

const loginTime = computed(() => {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
});

const getStatusClass = (status: string) => {
    const statusMap: Record<string, string> = {
        'ONLINE': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        'OFFLINE': 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
        'PENDING': 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
    };
    return statusMap[status] || statusMap['OFFLINE'];
};

const getStatusDotClass = (status: string) => {
    const dotMap: Record<string, string> = {
        'ONLINE': 'bg-emerald-400',
        'OFFLINE': 'bg-slate-400',
        'PENDING': 'bg-amber-400'
    };
    return dotMap[status] || dotMap['OFFLINE'];
};

const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
        'ONLINE': '营业中',
        'OFFLINE': '已关闭',
        'PENDING': '审核中',
        'active': '营业中',
        'inactive': '已关闭'
    };
    return textMap[status] || '未知';
};

const getShopTypeText = (shopType: string) => {
    const typeMap: Record<string, string> = {
        'online': '线上店铺',
        'offline': '线下店铺',
        'both': '线上线下'
    };
    return typeMap[shopType] || shopType;
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const loadShopInfo = async () => {
    loading.value = true;
    try {
        // 获取店铺列表
        const shopList = await getMyShopList();
        console.log('Shop list:', shopList);
        
        if (shopList && shopList.length > 0) {
            currentShop.value = shopList[0];
            localStorage.setItem('shopId', currentShop.value.id);
            
            // 加载商品统计
            await loadProductStats();
        }
    } catch (error: any) {
        console.error('Failed to load shop info:', error);
        
        // 如果是认证错误，跳转到登录页
        if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('isLoggedIn');
            router.push('/login');
        }
    } finally {
        loading.value = false;
    }
};

const loadProductStats = async () => {
    try {
        const shopId = currentShop.value?.id || localStorage.getItem('shopId') || '332';
        const result = await getProductList(0, 1000, shopId);
        
        if (result.content && Array.isArray(result.content)) {
            stats.value.totalProducts = result.content.length;
            stats.value.onlineProducts = result.content.filter((p: any) => p.status === 'ONLINE').length;
            stats.value.pendingProducts = result.content.filter((p: any) => p.status === 'PENDING' || p.status === 'DRAFT').length;
            stats.value.optimizedProducts = Math.floor(stats.value.totalProducts * 0.3); // 模拟数据
        }
    } catch (error) {
        console.error('Failed to load product stats:', error);
    }
};

const goToProducts = () => {
    router.push('/products');
};

const handleBatchOptimize = () => {
    router.push('/products?action=optimize');
};

onMounted(() => {
    loadShopInfo();
});
</script>
