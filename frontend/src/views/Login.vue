<template>
    <div class="h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
        <!-- Background Gradients -->
        <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 blur-[100px] rounded-full"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[100px] rounded-full"></div>

        <div class="glass-card w-full max-w-md relative z-10 flex flex-col gap-6">
            <div class="text-center">
                <h1 class="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">AI 商家助手</h1>
                <p class="text-slate-400 mt-2">手机号验证码登录</p>
            </div>

            <div class="flex flex-col gap-4">
                <div>
                    <label class="block text-sm text-slate-400 mb-1">手机号码</label>
                    <input v-model="phone" type="text" class="input-field" placeholder="请输入手机号">
                </div>
                
                <div class="relative">
                    <label class="block text-sm text-slate-400 mb-1">验证码</label>
                    <div class="flex gap-2">
                         <input v-model="code" type="text" class="input-field flex-1" placeholder="短信验证码">
                         <button @click="sendSms" :disabled="countdown > 0 || !phone" 
                            class="px-4 rounded-lg bg-white/10 hover:bg-white/20 text-sm whitespace-nowrap min-w-[100px] disabled:opacity-50 disabled:cursor-not-allowed transition">
                            {{ countdown > 0 ? `${countdown}s 后重试` : '获取验证码' }}
                         </button>
                    </div>
                </div>

                <button @click="handleLogin" :disabled="loading || !phone || !code" class="btn-primary w-full flex justify-center mt-2">
                    <span v-if="loading">登录中...</span>
                    <span v-else>立即登录</span>
                </button>
            </div>
            
            <p v-if="message" :class="{'text-red-400': isError, 'text-green-400': !isError}" class="text-center text-sm">
                {{ message }}
            </p>
            
            <p class="text-center text-xs text-slate-600">
                Mock Mode: Try code 8888 for testing
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { sendSmsCode, loginBySms } from '../api/pinhaopin';

const router = useRouter();
const phone = ref('');
const code = ref('');
const loading = ref(false);
const message = ref('');
const isError = ref(false);
const countdown = ref(0);

const sendSms = async () => {
    if (!phone.value) {
        message.value = '请输入手机号';
        isError.value = true;
        return;
    }
    
    try {
        message.value = '';
        // 直接调用拼好拼平台接口
        await sendSmsCode(phone.value);
        message.value = '验证码已发送';
        isError.value = false;
        
        countdown.value = 60;
        const timer = setInterval(() => {
            countdown.value--;
            if (countdown.value <= 0) clearInterval(timer);
        }, 1000);
        
    } catch (e: any) {
        console.error('Send SMS error:', e);
        // 优先使用错误消息，然后是响应数据中的消息
        message.value = e.message || e.response?.data?.msg || e.response?.data?.message || '发送失败';
        isError.value = true;
    }
};

const handleLogin = async () => {
    // 验证输入
    if (!phone.value || !code.value) {
        message.value = '请输入手机号和验证码';
        isError.value = true;
        return;
    }
    
    loading.value = true;
    message.value = '';
    
    try {
        // 直接调用拼好拼平台登录接口
        // 登录成功后，浏览器会自动保存 Set-Cookie: token=xxx; HttpOnly
        const result = await loginBySms(phone.value, code.value);
        
        console.log('Login successful:', result);
        
        // 标记已登录（用于路由守卫）
        localStorage.setItem('isLoggedIn', 'true');
        
        // 保存用户信息
        if (result.shopId) {
            localStorage.setItem('shopId', result.shopId);
        }
        if (result.data?.shopId) {
            localStorage.setItem('shopId', result.data.shopId);
        }
        
        message.value = '登录成功';
        isError.value = false;
        
        // 跳转到首页
        setTimeout(() => {
            router.push('/');
        }, 500);
        
    } catch (e: any) {
        console.error('Login error:', e);
        // 优先使用错误消息，然后是响应数据中的消息
        message.value = e.message || e.response?.data?.msg || e.response?.data?.message || '登录失败，请检查验证码';
        isError.value = true;
    } finally {
        loading.value = false;
    }
};
</script>
