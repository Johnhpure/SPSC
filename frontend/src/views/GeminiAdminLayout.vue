<template>
    <div class="min-h-screen bg-slate-950 flex overflow-hidden">
        <!-- 背景装饰 -->
        <div class="fixed inset-0 pointer-events-none">
            <div class="absolute top-[10%] right-[15%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
            <div class="absolute bottom-[15%] left-[10%] w-[35%] h-[35%] bg-purple-500/10 blur-[120px] rounded-full"></div>
        </div>

        <!-- 左侧菜单 -->
        <aside class="w-64 glass border-r border-white/5 flex flex-col relative z-10">
            <!-- Logo -->
            <div class="p-6 border-b border-white/5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <Settings class="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 class="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            Gemini 管理后台
                        </h1>
                        <p class="text-xs text-slate-500">API 配置与监控</p>
                    </div>
                </div>
            </div>

            <!-- 菜单项 -->
            <nav class="flex-1 p-4 space-y-2">
                <router-link 
                    to="/admin/gemini/config" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/admin/gemini/config') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <Settings class="w-5 h-5" />
                    <span class="font-medium">配置管理</span>
                </router-link>

                <router-link 
                    to="/admin/gemini/keys" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/admin/gemini/keys') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <Key class="w-5 h-5" />
                    <span class="font-medium">密钥管理</span>
                </router-link>

                <router-link 
                    to="/admin/gemini/logs" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/admin/gemini/logs') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <FileText class="w-5 h-5" />
                    <span class="font-medium">日志查看</span>
                </router-link>

                <router-link 
                    to="/admin/gemini/benchmark" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/admin/gemini/benchmark') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <Zap class="w-5 h-5" />
                    <span class="font-medium">模型测速</span>
                </router-link>

                <router-link 
                    to="/admin/gemini/statistics" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/admin/gemini/statistics') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <BarChart3 class="w-5 h-5" />
                    <span class="font-medium">统计面板</span>
                </router-link>
            </nav>

            <!-- 底部返回按钮 -->
            <div class="p-4 border-t border-white/5">
                <router-link 
                    to="/" 
                    class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-400 hover:text-white"
                >
                    <ArrowLeft class="w-4 h-4" />
                    <span class="text-sm font-medium">返回主页</span>
                </router-link>
            </div>
        </aside>

        <!-- 右侧主内容区 -->
        <main class="flex-1 overflow-auto relative z-10">
            <!-- 顶部面包屑 -->
            <div class="glass border-b border-white/5 px-8 py-4">
                <div class="flex items-center gap-2 text-sm">
                    <router-link to="/" class="text-slate-500 hover:text-slate-300 transition">
                        首页
                    </router-link>
                    <ChevronRight class="w-4 h-4 text-slate-600" />
                    <span class="text-slate-500">Gemini 管理后台</span>
                    <ChevronRight class="w-4 h-4 text-slate-600" />
                    <span class="text-white font-medium">{{ currentPageTitle }}</span>
                </div>
            </div>

            <!-- 页面内容 -->
            <div class="p-8">
                <router-view />
            </div>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Settings, Key, FileText, Zap, BarChart3, ArrowLeft, ChevronRight } from 'lucide-vue-next';

const route = useRoute();

const isActive = (path: string) => {
    return route.path === path;
};

const currentPageTitle = computed(() => {
    return route.meta.title as string || '管理后台';
});
</script>
