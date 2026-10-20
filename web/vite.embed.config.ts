// The embed script: one self-contained classic script (`dist/embed.js`) next to the web app on Cloudflare Pages.
// It runs after the app build and leaves the rest of dist/ alone. VITE_API_URL is inlined as the default server.
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: 'src/embed.ts', name: 'FosEmbed', formats: ['iife'], fileName: () => 'embed.js' }
  }
})
