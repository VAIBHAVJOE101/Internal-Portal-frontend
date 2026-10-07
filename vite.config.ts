import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the Vite server proxies /devopsportal to the Spring Boot backend so the browser sees a
// single origin (same as the frontend nginx in Kubernetes).
const backend = process.env.PORTAL_BACKEND_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/devopsportal': { target: backend, changeOrigin: false, xfwd: true },
    },
  },
})
