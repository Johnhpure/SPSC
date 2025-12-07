<template>
    <div class="flex items-center justify-between">
        <!-- 左侧：总数信息 -->
        <div class="text-sm text-slate-400">
            显示 <span class="text-white font-medium">{{ startItem }}</span> 到 
            <span class="text-white font-medium">{{ endItem }}</span>，
            共 <span class="text-white font-medium">{{ total }}</span> 条
        </div>

        <!-- 右侧：分页控件 -->
        <div class="flex items-center gap-2">
            <!-- 上一页 -->
            <button
                @click="goToPage(currentPage - 1)"
                :disabled="currentPage === 1"
                class="px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm font-medium"
                :class="currentPage === 1 
                    ? 'bg-white/5 text-slate-600 cursor-not-allowed' 
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'"
            >
                <ChevronLeft class="w-4 h-4" />
                <span>上一页</span>
            </button>

            <!-- 页码 -->
            <div class="flex items-center gap-1">
                <button
                    v-for="page in visiblePages"
                    :key="page"
                    @click="page !== '...' && goToPage(page as number)"
                    class="w-10 h-10 rounded-lg transition text-sm font-medium"
                    :class="page === currentPage
                        ? 'bg-indigo-500 text-white'
                        : page === '...'
                        ? 'bg-transparent text-slate-500 cursor-default'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'"
                    :disabled="page === '...'"
                >
                    {{ page }}
                </button>
            </div>

            <!-- 下一页 -->
            <button
                @click="goToPage(currentPage + 1)"
                :disabled="currentPage === totalPages"
                class="px-3 py-2 rounded-lg transition flex items-center gap-1 text-sm font-medium"
                :class="currentPage === totalPages
                    ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'"
            >
                <span>下一页</span>
                <ChevronRight class="w-4 h-4" />
            </button>

            <!-- 每页条数选择 -->
            <select
                v-if="showPageSizeSelector"
                :value="pageSize"
                @change="handlePageSizeChange"
                class="ml-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option v-for="size in pageSizeOptions" :key="size" :value="size">
                    {{ size }} 条/页
                </option>
            </select>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

interface Props {
    currentPage: number;
    pageSize: number;
    total: number;
    showPageSizeSelector?: boolean;
    pageSizeOptions?: number[];
}

const props = withDefaults(defineProps<Props>(), {
    showPageSizeSelector: true,
    pageSizeOptions: () => [10, 20, 50, 100]
});

const emit = defineEmits<{
    (e: 'update:currentPage', value: number): void;
    (e: 'update:pageSize', value: number): void;
    (e: 'change', page: number, pageSize: number): void;
}>();

const totalPages = computed(() => {
    return Math.ceil(props.total / props.pageSize);
});

const startItem = computed(() => {
    return props.total === 0 ? 0 : (props.currentPage - 1) * props.pageSize + 1;
});

const endItem = computed(() => {
    return Math.min(props.currentPage * props.pageSize, props.total);
});

const visiblePages = computed(() => {
    const pages: (number | string)[] = [];
    const total = totalPages.value;
    const current = props.currentPage;

    if (total <= 7) {
        // 如果总页数小于等于7，显示所有页码
        for (let i = 1; i <= total; i++) {
            pages.push(i);
        }
    } else {
        // 总是显示第一页
        pages.push(1);

        if (current <= 3) {
            // 当前页在前面
            pages.push(2, 3, 4, '...', total);
        } else if (current >= total - 2) {
            // 当前页在后面
            pages.push('...', total - 3, total - 2, total - 1, total);
        } else {
            // 当前页在中间
            pages.push('...', current - 1, current, current + 1, '...', total);
        }
    }

    return pages;
});

const goToPage = (page: number) => {
    if (page < 1 || page > totalPages.value || page === props.currentPage) {
        return;
    }
    emit('update:currentPage', page);
    emit('change', page, props.pageSize);
};

const handlePageSizeChange = (event: Event) => {
    const newSize = parseInt((event.target as HTMLSelectElement).value);
    emit('update:pageSize', newSize);
    // 重置到第一页
    emit('update:currentPage', 1);
    emit('change', 1, newSize);
};
</script>
