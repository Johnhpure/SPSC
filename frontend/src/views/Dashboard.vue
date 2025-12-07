<template>
    <div class="h-screen flex flex-col overflow-hidden bg-slate-950">
        <!-- Main Content -->
        <main class="flex-1 overflow-auto p-6 relative">

            <!-- Stats Row -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 relative z-10">
                <div class="glass-card">
                    <p class="text-slate-400 text-sm">存量商品</p>
                    <p class="text-3xl font-bold text-white mt-1">{{ stats.total }}</p>
                </div>
                <div class="glass-card">
                    <p class="text-slate-400 text-sm">待优化</p>
                    <p class="text-3xl font-bold text-amber-400 mt-1">{{ stats.pending }}</p>
                </div>
                <div class="glass-card">
                    <p class="text-slate-400 text-sm">已优化</p>
                    <p class="text-3xl font-bold text-emerald-400 mt-1">{{ stats.optimized }}</p>
                </div>
                <div class="glass-card cursor-pointer hover:bg-white/5 transition border-indigo-500/30" @click="handleBatchOptimize">
                    <p class="text-indigo-400 text-sm font-medium">一键优化全店</p>
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-xs text-slate-400">自动美图 + 分类纠错</span>
                        <ArrowRight class="w-5 h-5 text-indigo-400" />
                    </div>
                </div>
            </div>

            <!-- Product List -->
            <div class="glass-card overflow-hidden p-0 relative z-10">
                <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 class="font-semibold text-lg">商品列表</h2>
                    <div class="flex gap-2">
                        <button
                            @click="showAddModal = true"
                            class="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition flex items-center gap-2"
                        >
                            <Plus class="w-4 h-4" />
                            <span>新增商品</span>
                        </button>
                        <button @click="refreshList" class="p-2 hover:bg-white/10 rounded-full transition" title="刷新">
                            <span v-if="loading">...</span>
                            <RefreshCw v-else class="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="text-slate-400 text-sm border-b border-white/5">
                                <th class="p-4 pl-6 font-medium">主图</th>
                                <th class="p-4 font-medium">商品标题</th>
                                <th class="p-4 font-medium">当前分类</th>
                                <th class="p-4 font-medium">状态</th>
                                <th class="p-4 font-medium text-right pr-6">操作</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5 text-sm md:text-base">
                            <tr v-if="loading && products.length === 0">
                                <td colspan="5" class="p-8 text-center text-slate-500">加载中...</td>
                            </tr>
                            <tr v-for="p in products" :key="p.id" class="group hover:bg-white/5 transition-colors">
                                <td class="p-4 pl-6">
                                    <div class="w-16 h-16 rounded-lg overflow-hidden bg-slate-800 border border-white/10 relative group-hover:border-indigo-500/50 transition">
                                        <img :src="p.image_url" class="w-full h-full object-cover">
                                    </div>
                                </td>
                                <td class="p-4 max-w-xs">
                                    <div class="truncate font-medium text-slate-200">{{ p.title }}</div>
                                    <div class="text-xs text-slate-500 mt-1">ID: {{ p.platform_id }}</div>
                                </td>
                                <td class="p-4 text-slate-300">{{ p.category_name }}</td>
                                <td class="p-4">
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                        :class="{
                                            'bg-amber-500/10 text-amber-400 border border-amber-500/20': p.status === 'pending',
                                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20': p.status === 'synced',
                                            'bg-blue-500/10 text-blue-400 border border-blue-500/20': p.status === 'processing' || p.status === 'auditing',
                                            'bg-purple-500/10 text-purple-400 border border-purple-500/20': p.status === 'ONLINE'
                                        }">
                                        {{ getStatusText(p.status) }}
                                    </span>
                                </td>
                                <td class="p-4 text-right pr-6">
                                    <div class="flex items-center justify-end gap-2">
                                        <!-- 审核中状态：显示撤回审核 -->
                                        <button 
                                            v-if="p.status === 'auditing' || p.status === '审核中' || p.status === 'AUDITING' || p.status === 'AUDIT' || p.status === 'PENDING_AUDIT'"
                                            @click="handleRevertAudit(p)"
                                            class="text-amber-400 hover:text-amber-300 text-sm font-medium transition"
                                        >
                                            撤回审核
                                        </button>
                                        <!-- 未上架/已下架状态：显示上架 -->
                                        <button 
                                            v-if="p.status === 'pending' || p.status === '未上架' || p.status === '已下架' || p.status === 'OFFLINE' || p.status === 'DRAFT'"
                                            @click="handlePublish(p)"
                                            class="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition"
                                        >
                                            上架
                                        </button>
                                        <!-- 所有状态都显示优化 -->
                                        <button 
                                            @click="optimizeSingle(p)"
                                            class="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition"
                                        >
                                            优化
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <!-- Pagination Placeholder -->
                <div class="px-6 py-4 border-t border-white/5 flex justify-end">
                    <span class="text-xs text-slate-500">Showing top 20 items</span>
                </div>
            </div>
        </main>

        <!-- Add Product Modal -->
        <AddProductModal
            :is-open="showAddModal"
            @close="showAddModal = false"
            @success="handleProductCreated"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getProductList, getCategories, getRecommendKeywords, publishProduct, revertAudit } from '../api/pinhaopin';
import axios from 'axios';
import { RefreshCw, ArrowRight, Plus } from 'lucide-vue-next';
import AddProductModal from '../components/AddProductModal.vue';

const router = useRouter();
const products = ref<any[]>([]);
const loading = ref(false);
const showAddModal = ref(false);

const stats = computed(() => {
    const total = products.value.length;
    const pending = products.value.filter(p => p.status === 'pending').length;
    const optimized = products.value.filter(p => !['pending', 'processing'].includes(p.status)).length; 
    return { total, pending, optimized };
});

// 获取状态显示文本
const getStatusText = (status: string): string => {
    const statusTextMap: Record<string, string> = {
        'pending': '未上架',
        'synced': '已上架',
        'auditing': '审核中',
        'processing': '处理中',
        'ONLINE': '已上架',
        'OFFLINE': '已下架',
        'AUDITING': '审核中',
        'AUDIT': '审核中',
        'PENDING_AUDIT': '审核中',
        'DRAFT': '草稿'
    };
    return statusTextMap[status] || status;
};

const refreshList = async () => {
    loading.value = true;
    try {
        // 直接调用拼好拼平台接口获取商品列表
        // 浏览器会自动携带登录时保存的 Cookie
        const shopId = localStorage.getItem('shopId') || '332';
        const result = await getProductList(0, 50, shopId);
        
        // 处理返回的数据
        if (result.content && Array.isArray(result.content)) {
            products.value = result.content.map((item: any) => {
                // 保留原始状态，不做转换
                let displayStatus = item.status || 'pending';
                
                // 状态映射（如果需要）
                const statusMap: Record<string, string> = {
                    'ONLINE': 'synced',
                    'OFFLINE': 'pending',
                    'AUDITING': 'auditing',
                    'AUDIT': 'auditing',
                    'PENDING_AUDIT': 'auditing',
                    'DRAFT': 'pending',
                    'PENDING': 'pending'
                };
                
                // 如果状态在映射表中，使用映射后的值，否则使用原始值
                if (statusMap[item.status]) {
                    displayStatus = statusMap[item.status];
                } else {
                    displayStatus = item.status || 'pending';
                }
                
                return {
                    id: item.id,
                    platform_id: item.id,
                    title: item.title || item.name || '未命名商品',
                    category_name: item.categoryName || '未分类',
                    image_url: item.mainImage || item.imageUrl || 'https://via.placeholder.com/150',
                    status: displayStatus,
                    raw_status: item.status // 保留原始状态用于调试
                };
            });
        } else {
            products.value = [];
        }
        
        console.log('Loaded products:', products.value.length);
        console.log('Product statuses:', products.value.map(p => ({ id: p.id, status: p.status, raw: p.raw_status })));
    } catch (e: any) {
        console.error("Failed to load products:", e);
        
        // 如果是认证错误，跳转到登录页
        if (e.response?.status === 401 || e.response?.status === 403) {
            localStorage.removeItem('isLoggedIn');
            router.push('/login');
        } else {
            // 使用 Mock 数据
            products.value = [
                { id: 1, platform_id: '1001', title: '示例商品 - 纯棉T恤', category_name: '服装', image_url: 'https://via.placeholder.com/150', status: 'pending', raw_status: 'DRAFT' },
                { id: 2, platform_id: '1002', title: '示例商品 - 运动鞋', category_name: '鞋靴', image_url: 'https://via.placeholder.com/150', status: 'synced', raw_status: 'ONLINE' }
            ];
        }
    } finally {
        loading.value = false;
    }
};

const handleBatchOptimize = async () => {
    // 调用后端 API 进行批量优化
    try {
        await axios.post('/api/batch/optimize-image', {
            productIds: products.value.map(p => p.platform_id),
            prompt: '优化商品主图，使其更加美观专业'
        });
        alert("批量优化任务已提交");
    } catch (e) {
        console.error("Batch optimize failed:", e);
        alert("批量优化失败");
    }
};

const optimizeSingle = async (p: any) => {
    console.log("Optimize", p.id);
    // 调用后端 API 进行单个商品优化
    try {
        await axios.post('/api/batch/optimize-image', {
            productIds: [p.platform_id],
            prompt: '优化商品主图'
        });
        alert(`商品 ${p.title} 优化任务已提交`);
    } catch (e) {
        console.error("Optimize failed:", e);
    }
};

const categories = ref<any[]>([]);
const keywords = ref<any[]>([]);

const loadMetaData = async () => {
    try {
        // 直接调用拼好拼平台接口
        const shopId = localStorage.getItem('shopId') || '332';
        const [catResult, kwResult] = await Promise.all([
            getCategories(shopId),
            getRecommendKeywords()
        ]);
        
        categories.value = catResult;
        keywords.value = kwResult;
        console.log('Loaded Meta:', categories.value.length, 'categories,', keywords.value.length, 'keywords');
    } catch (e) {
        console.error("Failed to load metadata", e);
    }
}

// Handle successful product creation
const handleProductCreated = () => {
    showAddModal.value = false;
    refreshList();
};

// Handle publish product
const handlePublish = async (product: any) => {
    if (!confirm(`确定要上架商品"${product.title}"吗？`)) {
        return;
    }
    
    try {
        await publishProduct(product.platform_id);
        alert('商品上架成功！');
        
        // 延迟刷新，给服务器时间更新状态
        setTimeout(() => {
            refreshList();
        }, 500);
    } catch (err: any) {
        console.error('Failed to publish product:', err);
        alert(err.message || '商品上架失败，请稍后重试');
    }
};

// Handle revert audit
const handleRevertAudit = async (product: any) => {
    if (!confirm(`确定要撤回商品"${product.title}"的审核吗？`)) {
        return;
    }
    
    try {
        await revertAudit(product.platform_id);
        alert('撤回审核成功！');
        
        // 延迟刷新，给服务器时间更新状态
        setTimeout(() => {
            refreshList();
        }, 500);
    } catch (err: any) {
        console.error('Failed to revert audit:', err);
        alert(err.message || '撤回审核失败，请稍后重试');
    }
};

onMounted(() => {
    refreshList();
    loadMetaData();
});
</script>
