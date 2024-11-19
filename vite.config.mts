import { defineConfig, UserConfig, LibraryOptions, LibraryFormats } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr'
import dotenv from 'dotenv'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import { resolve } from 'path'
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { builtinModules } from 'module';

dotenv.config()

// List of all Node.js built-in modules and their prefixed versions
const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map(mod => `node:${mod}`),
  ...builtinModules.map(mod => `${mod}/`), // Include subpaths
];

// List of dependencies that should be external in backend
const backendExternals = [
  ...nodeBuiltins,
  'express',
  'express-slow-down',
  'express-rate-limit',
  'cors',
  // Add any other backend dependencies here
];

const getFrontendConfig = (): UserConfig => ({
  root: resolve(__dirname, 'frontend'),
  define: {
    ENV_TOKEN: `"${process?.env?.OPEN_AI_API_KEY}"`,
    __FOS_API_URL__: `"${process.env.FOS_API_URL}"`,
  },
  build: {
    outDir: resolve(__dirname, 'dist/frontend'),
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      external: backendExternals,
      output: {
        format: 'es',
        dir: resolve(__dirname, 'dist/frontend'),
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      }
    }
  },
  optimizeDeps: {
    exclude: backendExternals
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    alias: {
      '@': resolve(__dirname, './')
    }
  },
  plugins: [
    react(),
    viteTsconfigPaths({
      root: resolve(__dirname, 'frontend')
    }),
    svgr({ svgrOptions: { icon: true } }),
    libInjectCss(),
    {
      name: 'exclude-files',
      resolveId(source) {
        if (source.includes('backend/') || source.match(/\/backend\//)) {
          return { id: source, external: true };
        }
        return null;
      }
    }
  ],
  css: {
    preprocessorOptions: {
      css: { javascriptEnabled: true }
    },
    postcss: {
      plugins: [tailwindcss(), autoprefixer()]
    }
  }
});

const getBackendConfig = (): UserConfig => ({
  root: resolve(__dirname, 'backend'),

  build: {
    outDir: resolve(__dirname, 'dist/backend'),
    emptyOutDir: true,
    ssr: true,
    target: 'node16',
    lib: {
      entry: resolve(__dirname, 'backend/index.ts'),
      formats: ['cjs'] as LibraryFormats[],
      fileName: () => 'index.js'
    } as LibraryOptions,
    rollupOptions: {
      external: backendExternals,
      output: {
        format: 'cjs',
        dir: resolve(__dirname, 'dist/backend'),
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        preserveModules: true,
        preserveModulesRoot: 'src',
        exports: 'named'
      },
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false
      }
    },

  },
  optimizeDeps: {
    disabled: true // Disable dependency pre-bundling for backend
  },
  resolve: {
    
    mainFields: ['module', 'main'],
    alias: {
      '@': resolve(__dirname, './')
    },
    preserveSymlinks: true
  },

  plugins: [
    viteTsconfigPaths({
      root: resolve(__dirname, 'backend')
    }),
    {
      name: 'exclude-frontend-files',
      resolveId(source) {
        if (
          source.includes('frontend/') ||
          source.match(/\/frontend\//) ||
          source.endsWith('.tsx') ||
          source.includes('/components/') ||
          source.includes('/pages/')
        ) {
          return { id: source, external: true };
        }
        return null;
      }
    }
  ]
});

export default defineConfig(({ command, mode }): UserConfig => {


  const target = mode;
  
  if (target === 'frontend') {
    return getFrontendConfig();
  } else if (target === 'backend') {
    return getBackendConfig();
  } else {
    throw new Error(`Invalid build target: ${target}`);
  }
  
  throw new Error(`Invalid build target: ${target}`);
});