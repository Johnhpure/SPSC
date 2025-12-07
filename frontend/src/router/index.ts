import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Layout from '../views/Layout.vue'
import Home from '../views/Home.vue'
import Dashboard from '../views/Dashboard.vue'
import CategoryManagement from '../views/CategoryManagement.vue'
import GeminiAdminLayout from '../views/GeminiAdminLayout.vue'
import AdminLogin from '../views/admin/AdminLogin.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        // 主前端登录（Pinhaopin 商户）
        { path: '/login', component: Login },
        
        // 管理后台登录（独立认证）
        { path: '/admin/login', component: AdminLogin },
        
        // 主前端路由
        {
            path: '/',
            component: Layout,
            meta: { requiresAuth: true },
            children: [
                { path: '', component: Home },
                { path: 'products', component: Dashboard },
                { path: 'categories', component: CategoryManagement }
            ]
        },
        
        // 管理后台路由
        {
            path: '/admin',
            component: GeminiAdminLayout,
            meta: { requiresAdminAuth: true },
            children: [
                {
                    path: '',
                    redirect: '/admin/gemini/config'
                },
                {
                    path: 'gemini/config',
                    name: 'GeminiConfig',
                    component: () => import('../views/admin/ConfigManagement.vue'),
                    meta: { title: '配置管理' }
                },
                {
                    path: 'gemini/keys',
                    name: 'GeminiKeys',
                    component: () => import('../views/admin/KeyManagement.vue'),
                    meta: { title: '密钥管理' }
                },
                {
                    path: 'gemini/logs',
                    name: 'GeminiLogs',
                    component: () => import('../views/admin/LogViewer.vue'),
                    meta: { title: '日志查看' }
                },
                {
                    path: 'gemini/benchmark',
                    name: 'GeminiBenchmark',
                    component: () => import('../views/admin/BenchmarkTool.vue'),
                    meta: { title: '模型测速' }
                },
                {
                    path: 'gemini/statistics',
                    name: 'GeminiStatistics',
                    component: () => import('../views/admin/StatisticsDashboard.vue'),
                    meta: { title: '统计面板' }
                }
            ]
        },
        
        // 兼容旧路由
        {
            path: '/config',
            redirect: '/admin/gemini/config'
        }
    ]
});

router.beforeEach((to, _from, next) => {
    // 管理后台认证检查
    if (to.meta.requiresAdminAuth) {
        const adminLoggedIn = localStorage.getItem('adminLoggedIn');
        if (!adminLoggedIn) {
            next('/admin/login');
            return;
        }
    }
    
    // 主前端认证检查（Cookie 自动管理）
    if (to.meta.requiresAuth) {
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        if (!isLoggedIn) {
            next('/login');
            return;
        }
    }
    
    // 如果已登录管理后台，访问登录页则跳转到管理首页
    if (to.path === '/admin/login' && localStorage.getItem('adminLoggedIn')) {
        next('/admin');
        return;
    }
    
    // 如果已登录主前端，访问登录页则跳转到首页
    if (to.path === '/login' && localStorage.getItem('isLoggedIn')) {
        next('/');
        return;
    }
    
    next();
});

export default router
