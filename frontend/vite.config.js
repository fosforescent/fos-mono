import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
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
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})