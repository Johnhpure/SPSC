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
                        <Store class="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 class="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            拼好拼商家助手
                        </h1>
                        <p class="text-xs text-slate-500">AI 驱动的智能运营</p>
                    </div>
                </div>
            </div>

            <!-- 菜单项 -->
            <nav class="flex-1 p-4 space-y-2">
                <router-link 
                    to="/" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <Home class="w-5 h-5" />
                    <span class="font-medium">首页</span>
                </router-link>

                <router-link 
                    to="/products" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/products') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <Package class="w-5 h-5" />
                    <span class="font-medium">商品列表</span>
                </router-link>

                <router-link 
                    to="/categories" 
                    class="flex items-center gap-3 px-4 py-3 rounded-lg transition group"
                    :class="isActive('/categories') ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'"
                >
                    <FolderTree class="w-5 h-5" />
                    <span class="font-medium">商品分类</span>
                </router-link>
            </nav>

            <!-- 底部用户信息 -->
            <div class="p-4 border-t border-white/5">
                <div class="flex items-center justify-between px-4 py-3 rounded-lg bg-white/5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white">
                            {{ userName }}
                        </div>
                        <div>
                            <p class="text-sm text-white font-medium">商家用户</p>
                            <p class="text-xs text-slate-500">ID: {{ shopId }}</p>
                        </div>
                    </div>
                    <button @click="logout" class="p-2 hover:bg-white/5 rounded-lg transition" title="退出登录">
                        <LogOut class="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>
        </aside>

        <!-- 右侧主内容区 -->
        <main class="flex-1 overflow-auto relative z-10">
            <router-view />
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Store, Home, Package, FolderTree, LogOut } from 'lucide-vue-next';

const router = useRouter();
const route = useRoute();

const shopId = computed(() => localStorage.getItem('shopId') || '332');
const userName = computed(() => {
    const phone = localStorage.getItem('phone');
    return phone ? phone.slice(-4) : 'U';
});

const isActive = (path: string) => {
    return route.path === path;
};

const logout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('shopId');
    localStorage.removeItem('phone');
    router.push('/login');
};
</script>
