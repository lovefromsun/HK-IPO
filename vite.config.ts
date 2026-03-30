import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 与博客同域子路径部署时：VITE_BASE_PATH=/hk-ipo/ npm run build
const base = process.env.VITE_BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    // 避免部分环境下 localhost 解析到 ::1 导致连不上，可直接用 http://127.0.0.1:5173/
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api/hk-ipo': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/hk-ipo/, '/api'),
      },
    },
  },
})
