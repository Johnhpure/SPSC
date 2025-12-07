<template>
    <!-- Modal Backdrop -->
    <Transition name="fade">
        <div
            v-if="isOpen"
            class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            @click.self="closeModal"
        >
            <!-- Modal Content -->
            <div class="glass rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <h2 class="text-xl font-bold text-white">新增商品</h2>
                    <button
                        @click="closeModal"
                        class="p-2 hover:bg-white/10 rounded-lg transition"
                    >
                        <X class="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <!-- Form -->
                <form @submit.prevent="handleSubmit" class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <div class="space-y-5">
                        <!-- Product Name -->
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">
                                商品名称 <span class="text-red-400">*</span>
                            </label>
                            <input
                                v-model="formData.name"
                                type="text"
                                required
                                class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                placeholder="请输入商品名称"
                            />
                        </div>

                        <!-- Category Selection (Cascading) -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    一级分类 <span class="text-red-400">*</span>
                                </label>
                                <select
                                    v-model="formData.level1CategoryId"
                                    @change="onLevel1Change"
                                    required
                                    class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                                >
                                    <option value="" disabled>请选择一级分类</option>
                                    <option
                                        v-for="category in level1Categories"
                                        :key="category.id"
                                        :value="category.id"
                                        class="bg-slate-800"
                                    >
                                        {{ category.name }}
                                    </option>
                                </select>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    二级分类 <span class="text-red-400">*</span>
                                </label>
                                <select
                                    v-model="formData.categoryId"
                                    required
                                    :disabled="!formData.level1CategoryId || loadingLevel2"
                                    class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="" disabled>
                                        {{ loadingLevel2 ? '加载中...' : '请选择二级分类' }}
                                    </option>
                                    <option
                                        v-for="category in level2Categories"
                                        :key="category.id"
                                        :value="category.id"
                                        class="bg-slate-800"
                                    >
                                        {{ category.name }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <!-- Price and Original Price -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    售价 (元) <span class="text-red-400">*</span>
                                </label>
                                <input
                                    v-model.number="formData.price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    原价 (元) <span class="text-red-400">*</span>
                                </label>
                                <input
                                    v-model.number="formData.originalPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <!-- Stock Settings -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    库存设置
                                </label>
                                <div class="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                                    <input
                                        v-model="formData.unlimitedStock"
                                        type="checkbox"
                                        id="unlimitedStock"
                                        class="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500"
                                    />
                                    <label for="unlimitedStock" class="text-white text-sm cursor-pointer">
                                        无限库存
                                    </label>
                                </div>
                            </div>

                            <div v-if="!formData.unlimitedStock">
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    库存数量 <span class="text-red-400">*</span>
                                </label>
                                <input
                                    v-model.number="formData.stock"
                                    type="number"
                                    min="0"
                                    :required="!formData.unlimitedStock"
                                    class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <!-- Weight and Repo -->
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    重量 (kg)
                                </label>
                                <input
                                    v-model.number="formData.weight"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="1.00"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-slate-300 mb-2">
                                    仓库 <span class="text-red-400">*</span>
                                </label>
                                <select
                                    v-model="formData.repoId"
                                    required
                                    class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                                >
                                    <option value="" disabled>请选择仓库</option>
                                    <option
                                        v-for="repo in repos"
                                        :key="repo.id"
                                        :value="repo.id"
                                        class="bg-slate-800"
                                    >
                                        {{ repo.name }}
                                    </option>
                                </select>
                            </div>
                        </div>

                        <!-- Main Image URL -->
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">
                                商品主图 <span class="text-red-400">*</span>
                            </label>
                            <input
                                v-model="formData.mainImage"
                                type="url"
                                required
                                class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                                placeholder="https://example.com/image.jpg"
                            />
                            
                            <!-- Upload Section -->
                            <div class="mt-3">
                                <div class="flex items-center gap-2 mb-2">
                                    <div class="h-px flex-1 bg-white/10"></div>
                                    <span class="text-xs text-slate-500">或上传本地图片</span>
                                    <div class="h-px flex-1 bg-white/10"></div>
                                </div>
                                
                                <!-- Upload Area -->
                                <div
                                    @click="triggerFileInput"
                                    @dragover.prevent="isDragging = true"
                                    @dragleave.prevent="isDragging = false"
                                    @drop.prevent="handleDrop"
                                    class="relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition"
                                    :class="isDragging 
                                        ? 'border-indigo-500 bg-indigo-500/10' 
                                        : 'border-white/10 hover:border-indigo-500/50 hover:bg-white/5'"
                                >
                                    <input
                                        ref="fileInput"
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                                        @change="handleFileSelect"
                                        class="hidden"
                                    />
                                    
                                    <div v-if="!uploading">
                                        <Upload class="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                        <p class="text-sm text-slate-300 mb-1">点击或拖拽图片到此处上传</p>
                                        <p class="text-xs text-slate-500">支持 JPG、PNG、GIF、WebP，最大 5MB</p>
                                    </div>
                                    
                                    <div v-else class="py-2">
                                        <div class="w-12 h-12 mx-auto mb-2 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                        <p class="text-sm text-slate-300 mb-2">上传中... {{ uploadProgress }}%</p>
                                        <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                                            <div
                                                class="bg-indigo-500 h-full transition-all duration-300"
                                                :style="{ width: uploadProgress + '%' }"
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Image Preview -->
                            <div v-if="formData.mainImage" class="mt-3">
                                <p class="text-xs text-slate-400 mb-2">图片预览：</p>
                                <div class="relative inline-block">
                                    <img
                                        :src="formData.mainImage"
                                        alt="预览"
                                        class="w-32 h-32 object-cover rounded-lg border border-white/10"
                                        @error="imageError = true"
                                    />
                                    <button
                                        type="button"
                                        @click="formData.mainImage = ''"
                                        class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition"
                                    >
                                        <X class="w-4 h-4 text-white" />
                                    </button>
                                </div>
                                <p v-if="imageError" class="text-xs text-red-400 mt-1">图片加载失败</p>
                            </div>
                        </div>

                        <!-- Description -->
                        <div>
                            <label class="block text-sm font-medium text-slate-300 mb-2">
                                商品描述
                            </label>
                            <textarea
                                v-model="formData.description"
                                rows="3"
                                class="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none"
                                placeholder="请输入商品描述"
                            ></textarea>
                        </div>

                        <!-- Additional Settings (Collapsible) -->
                        <div class="border-t border-white/10 pt-4">
                            <button
                                type="button"
                                @click="showAdvanced = !showAdvanced"
                                class="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
                            >
                                <ChevronDown
                                    class="w-4 h-4 transition-transform"
                                    :class="{ 'rotate-180': showAdvanced }"
                                />
                                <span>高级设置</span>
                            </button>

                            <div v-if="showAdvanced" class="mt-4 space-y-4">
                                <div class="grid grid-cols-3 gap-4">
                                    <div>
                                        <label class="block text-xs text-slate-400 mb-1">利润分成比例 (%)</label>
                                        <input
                                            v-model.number="formData.profitSharingRatio"
                                            type="number"
                                            min="0"
                                            class="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-xs text-slate-400 mb-1">消费者分成比例 (%)</label>
                                        <input
                                            v-model.number="formData.consumerSharingRatio"
                                            type="number"
                                            min="0"
                                            class="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label class="block text-xs text-slate-400 mb-1">商家分成比例 (%)</label>
                                        <input
                                            v-model.number="formData.merchantSharingRatio"
                                            type="number"
                                            min="0"
                                            class="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                </div>

                                <div class="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg">
                                    <input
                                        v-model="formData.noReasonRefund"
                                        type="checkbox"
                                        id="noReasonRefund"
                                        class="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500"
                                    />
                                    <label for="noReasonRefund" class="text-white text-sm cursor-pointer">
                                        支持7天无理由退款
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Error Message -->
                    <div v-if="error" class="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p class="text-sm text-red-400">{{ error }}</p>
                    </div>

                    <!-- Footer Buttons -->
                    <div class="flex gap-3 mt-6">
                        <button
                            type="button"
                            @click="closeModal"
                            class="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg transition"
                            :disabled="loading"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            class="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            :disabled="loading"
                        >
                            <div v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>{{ loading ? '提交中...' : '创建商品' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { X, ChevronDown, Upload } from 'lucide-vue-next';
import { getCategories, getLevel2Categories, createProduct, getRepoList, uploadImage } from '../api/pinhaopin';

interface Props {
    isOpen: boolean;
}

interface Emits {
    (e: 'close'): void;
    (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const level1Categories = ref<any[]>([]);
const level2Categories = ref<any[]>([]);
const repos = ref<any[]>([]);
const loading = ref(false);
const loadingLevel2 = ref(false);
const error = ref('');
const imageError = ref(false);
const showAdvanced = ref(false);
const uploading = ref(false);
const uploadProgress = ref(0);
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const formData = ref({
    name: '',
    level1CategoryId: '',
    categoryId: '',
    price: 0,
    originalPrice: 0,
    weight: 1,
    unlimitedStock: true,
    stock: null as number | null,
    mainImage: '',
    images: '',
    description: '',
    repoId: '',
    noReasonRefund: false,
    profitSharingRatio: 3,
    consumerSharingRatio: 1,
    goodPointRatio: 0,
    merchantSharingRatio: 5
});

// Reset image error when URL changes
watch(() => formData.value.mainImage, () => {
    imageError.value = false;
});

// Trigger file input click
const triggerFileInput = () => {
    if (!uploading.value) {
        fileInput.value?.click();
    }
};

// Handle file selection
const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        await uploadFile(file);
    }
};

// Handle drag and drop
const handleDrop = async (event: DragEvent) => {
    isDragging.value = false;
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
        await uploadFile(file);
    } else {
        error.value = '请上传图片文件';
    }
};

// Upload file
const uploadFile = async (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        error.value = '不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式';
        return;
    }
    
    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        error.value = '图片大小不能超过 5MB';
        return;
    }
    
    uploading.value = true;
    uploadProgress.value = 0;
    error.value = '';
    
    try {
        const imageUrl = await uploadImage(file, (progress) => {
            uploadProgress.value = progress;
        });
        
        formData.value.mainImage = imageUrl;
        
        // Reset file input
        if (fileInput.value) {
            fileInput.value.value = '';
        }
    } catch (err: any) {
        console.error('Failed to upload image:', err);
        error.value = err.message || '图片上传失败，请重试';
    } finally {
        uploading.value = false;
        uploadProgress.value = 0;
    }
};

// Load level 2 categories when level 1 changes
const onLevel1Change = async () => {
    formData.value.categoryId = '';
    level2Categories.value = [];
    
    if (!formData.value.level1CategoryId) return;
    
    loadingLevel2.value = true;
    try {
        const shopId = localStorage.getItem('shopId') || '332';
        const result = await getLevel2Categories(shopId, formData.value.level1CategoryId);
        level2Categories.value = result || [];
    } catch (err) {
        console.error('Failed to load level 2 categories:', err);
        error.value = '加载二级分类失败';
    } finally {
        loadingLevel2.value = false;
    }
};

// Load initial data
const loadInitialData = async () => {
    try {
        const shopId = localStorage.getItem('shopId') || '332';
        const [categoriesResult, reposResult] = await Promise.all([
            getCategories(shopId),
            getRepoList(shopId).catch(() => []) // 如果仓库接口不存在，返回空数组
        ]);
        
        level1Categories.value = categoriesResult || [];
        repos.value = reposResult || [];
        
        // 如果只有一个仓库，自动选择
        if (repos.value.length === 1) {
            formData.value.repoId = repos.value[0].id;
        }
    } catch (err) {
        console.error('Failed to load initial data:', err);
    }
};

// Close modal
const closeModal = () => {
    if (!loading.value) {
        emit('close');
        resetForm();
    }
};

// Reset form
const resetForm = () => {
    formData.value = {
        name: '',
        level1CategoryId: '',
        categoryId: '',
        price: 0,
        originalPrice: 0,
        weight: 1,
        unlimitedStock: true,
        stock: null,
        mainImage: '',
        images: '',
        description: '',
        repoId: repos.value.length === 1 ? repos.value[0].id : '',
        noReasonRefund: false,
        profitSharingRatio: 3,
        consumerSharingRatio: 1,
        goodPointRatio: 0,
        merchantSharingRatio: 5
    };
    level2Categories.value = [];
    error.value = '';
    imageError.value = false;
    showAdvanced.value = false;
};

// Handle form submission
const handleSubmit = async () => {
    loading.value = true;
    error.value = '';

    try {
        const shopId = localStorage.getItem('shopId') || '332';
        
        const productData = {
            shopId: parseInt(shopId),
            categoryId: formData.value.categoryId.toString(),
            name: formData.value.name,
            repoId: parseInt(formData.value.repoId),
            noReasonRefund: formData.value.noReasonRefund,
            price: formData.value.price,
            weight: formData.value.weight,
            unlimitedStock: formData.value.unlimitedStock,
            description: formData.value.description || '',
            profitSharingRatio: formData.value.profitSharingRatio,
            consumerSharingRatio: formData.value.consumerSharingRatio,
            goodPointRatio: formData.value.goodPointRatio,
            originalPrice: formData.value.originalPrice,
            stock: formData.value.unlimitedStock ? null : formData.value.stock,
            mainImage: formData.value.mainImage,
            images: formData.value.images || '',
            merchantSharingRatio: formData.value.merchantSharingRatio
        };

        console.log('Submitting product data:', productData);

        await createProduct(productData);
        
        emit('success');
        closeModal();
    } catch (err: any) {
        console.error('Failed to create product:', err);
        error.value = err.message || '创建商品失败，请稍后重试';
    } finally {
        loading.value = false;
    }
};

// Handle ESC key
const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.isOpen) {
        closeModal();
    }
};

onMounted(() => {
    loadInitialData();
    window.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleEscape);
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
