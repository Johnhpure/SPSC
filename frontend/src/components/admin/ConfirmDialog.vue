<template>
    <!-- 遮罩层 -->
    <Transition name="fade">
        <div 
            v-if="visible"
            class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            @click.self="handleCancel"
        >
            <!-- 对话框 -->
            <Transition name="scale">
                <div 
                    v-if="visible"
                    class="glass border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6"
                    @click.stop
                >
                    <!-- 标题 -->
                    <div class="flex items-start gap-3 mb-4">
                        <div 
                            class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                            :class="iconBgClass"
                        >
                            <AlertCircle v-if="type === 'danger'" class="w-6 h-6" :class="iconColorClass" />
                            <AlertTriangle v-else-if="type === 'warning'" class="w-6 h-6" :class="iconColorClass" />
                            <Info v-else class="w-6 h-6" :class="iconColorClass" />
                        </div>
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-white">{{ title }}</h3>
                        </div>
                    </div>

                    <!-- 内容 -->
                    <div class="mb-6 text-slate-300 text-sm">
                        {{ message }}
                    </div>

                    <!-- 按钮 -->
                    <div class="flex items-center justify-end gap-3">
                        <button
                            @click="handleCancel"
                            class="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition font-medium"
                            :disabled="loading"
                        >
                            {{ cancelText }}
                        </button>
                        <button
                            @click="handleConfirm"
                            class="px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                            :class="confirmButtonClass"
                            :disabled="loading"
                        >
                            <LoadingSpinner v-if="loading" size="sm" />
                            <span>{{ confirmText }}</span>
                        </button>
                    </div>
                </div>
            </Transition>
        </div>
    </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AlertCircle, AlertTriangle, Info } from 'lucide-vue-next';
import LoadingSpinner from './LoadingSpinner.vue';

interface Props {
    modelValue: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'warning' | 'danger';
    confirmText?: string;
    cancelText?: string;
}

const props = withDefaults(defineProps<Props>(), {
    title: '确认操作',
    type: 'info',
    confirmText: '确认',
    cancelText: '取消'
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'confirm'): void | Promise<void>;
    (e: 'cancel'): void;
}>();

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
});

const loading = ref(false);

const iconBgClass = computed(() => {
    const classes = {
        info: 'bg-blue-500/10',
        warning: 'bg-yellow-500/10',
        danger: 'bg-red-500/10'
    };
    return classes[props.type];
});

const iconColorClass = computed(() => {
    const classes = {
        info: 'text-blue-400',
        warning: 'text-yellow-400',
        danger: 'text-red-400'
    };
    return classes[props.type];
});

const confirmButtonClass = computed(() => {
    const classes = {
        info: 'bg-blue-500 hover:bg-blue-600 text-white',
        warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        danger: 'bg-red-500 hover:bg-red-600 text-white'
    };
    return classes[props.type];
});

const handleConfirm = async () => {
    loading.value = true;
    try {
        await emit('confirm');
        visible.value = false;
    } finally {
        loading.value = false;
    }
};

const handleCancel = () => {
    if (!loading.value) {
        emit('cancel');
        visible.value = false;
    }
};
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

.scale-enter-active,
.scale-leave-active {
    transition: all 0.2s ease;
}

.scale-enter-from,
.scale-leave-to {
    opacity: 0;
    transform: scale(0.95);
}
</style>
