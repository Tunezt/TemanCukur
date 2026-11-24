import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget =
    env.VITE_DEV_PROXY_TARGET?.replace(/\/$/, '') ||
    'http://127.0.0.1:8010'

  return {
    plugins: [react()],
    resolve: {
      dedupe: ['react', 'react-dom', 'react-router-dom'],
    },
    // Two HTML shells, same app: admin.html carries noindex and its own title (vercel.json routes /admin to it).
    build: {
      rollupOptions: {
        input: { main: 'index.html', admin: 'admin.html' },
      },
    },
    // Bind all interfaces so http://127.0.0.1:5173 works on Windows (not only [::1]).
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      // Must match the uvicorn port. Override with VITE_DEV_PROXY_TARGET in .env.development.
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
