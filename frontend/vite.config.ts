import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      // 后端 API 代理（用于 AI 优化等功能）
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // 拼好拼平台 API 代理（解决 CORS 问题）
      '/gateway': {
        target: 'https://shop.pinhaopin.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      }
    }
  }
})
