import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  // `--mode demo` builds the GitHub Pages demo (see .env.demo), served from /Item_Tracker/.
  base: mode === 'demo' ? '/Item_Tracker/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:4242' },
  },
}))
