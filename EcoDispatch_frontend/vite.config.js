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
    },
  },
})
