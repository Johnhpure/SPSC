<template>
    <div 
        v-if="visible"
        class="rounded-lg border p-4 mb-4 transition-all"
        :class="alertClasses"
        role="alert"
    >
        <div class="flex items-start gap-3">
            <!-- 图标 -->
            <div class="flex-shrink-0 mt-0.5">
                <AlertCircle v-if="type === 'error'" class="w-5 h-5" />
                <AlertTriangle v-else-if="type === 'warning'" class="w-5 h-5" />
                <Info v-else-if="type === 'info'" class="w-5 h-5" />
                <CheckCircle v-else class="w-5 h-5" />
            </div>

            <!-- 内容 -->
            <div class="flex-1 min-w-0">
                <h3 v-if="title" class="font-semibold mb-1">{{ title }}</h3>
                <p class="text-sm">{{ message }}</p>
                <div v-if="details" class="mt-2 text-xs opacity-75">
                    <pre class="whitespace-pre-wrap font-mono">{{ details }}</pre>
                </div>
            </div>

            <!-- 关闭按钮 -->
            <button 
                v-if="closable"
                @click="close"
                class="flex-shrink-0 p-1 rounded hover:bg-white/10 transition"
                aria-label="关闭"
            >
                <X class="w-4 h-4" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-vue-next';

interface Props {
    type?: 'error' | 'warning' | 'info' | 'success';
    title?: string;
    message: string;
    details?: string;
    closable?: boolean;
    modelValue?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    type: 'error',
    title: '',
    details: '',
    closable: true,
    modelValue: true
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: boolean): void;
    (e: 'close'): void;
}>();

const visible = ref(props.modelValue);

const alertClasses = computed(() => {
    const classes = {
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        success: 'bg-green-500/10 border-green-500/20 text-green-400'
    };
    return classes[props.type];
});

const close = () => {
    visible.value = false;
    emit('update:modelValue', false);
    emit('close');
};
</script>
