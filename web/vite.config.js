import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5028',
        changeOrigin: true,
        secure: false,
      },
      '/hubs': {
        target: 'http://localhost:5028',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
