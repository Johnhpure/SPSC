<template>
    <div class="flex items-center justify-center" :class="containerClass">
        <div class="relative" :style="{ width: sizeValue, height: sizeValue }">
            <!-- 旋转的圆环 -->
            <div class="absolute inset-0 rounded-full border-4 border-slate-700"></div>
            <div 
                class="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"
                :style="{ borderTopColor: color }"
            ></div>
        </div>
        <span v-if="text" class="ml-3 text-slate-400" :class="textClass">{{ text }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    text?: string;
    color?: string;
    containerClass?: string;
    textClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
    size: 'md',
    text: '',
    color: '#6366f1',
    containerClass: '',
    textClass: ''
});

const sizeValue = computed(() => {
    const sizes = {
        sm: '16px',
        md: '24px',
        lg: '32px',
        xl: '48px'
    };
    return sizes[props.size];
});
</script>
