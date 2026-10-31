import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/users': 'http://localhost:8080',
      '/api/ai': 'http://localhost:8000',
      '/api': 'http://localhost:8080',
      '/energy-charts': {
        target: 'https://api.energy-charts.info',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/energy-charts/, ''),
      },
    },
  },
})
