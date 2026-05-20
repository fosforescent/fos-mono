import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [],
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@fosforescent/shared': resolve(__dirname, '../shared'),
      '@fosforescent/prisma': resolve(__dirname, '../prisma')
    }
  },
  define: {
    __FOS_API_URL__: JSON.stringify(process.env.VITE_FOS_API_URL || 'http://localhost:4000')
  },
  // Configure server for Tauri compatibility
  server: {
    port: 5173,
    strictPort: true,
    // Configure HMR for Tauri WebView
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'ws'
    },
    watch: {
      usePolling: true
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})