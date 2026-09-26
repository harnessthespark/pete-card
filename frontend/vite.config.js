import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/messages': 'http://127.0.0.1:8001',
      '/upload': 'http://127.0.0.1:8001',
      '/media': 'http://127.0.0.1:8001',
    },
  },
})
