import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isTauriBuild = mode === 'tauri' || process.env.VITE_TAURI_BUILD === 'true'

  return {
    plugins: [react(), tailwindcss()],
    clearScreen: false,
    build: {
      chunkSizeWarningLimit: 700,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/mcp': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    base: isTauriBuild ? './' : '/',
  }
})
