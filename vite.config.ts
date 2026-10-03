import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the Vite server proxies API and auth routes to the Spring Boot backend so the
// browser sees a single origin (same as the Kubernetes ingress in production).
const backend = process.env.PORTAL_BACKEND_URL ?? 'http://localhost:8080'
const proxied = ['/api', '/oauth2', '/login/oauth2', '/swagger-ui', '/v3/api-docs']

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      proxied.map((p) => [p, { target: backend, changeOrigin: false, xfwd: true }]),
    ),
  },
})
