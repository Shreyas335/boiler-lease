import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: (process.env.PROXY_TARGET || 'http://localhost:8000').replace(/^http/, 'ws'),
        changeOrigin: true,
        ws: true,
      },
    },
  },
})