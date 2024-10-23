import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgr from 'vite-plugin-svgr'
import dotenv from 'dotenv'
import { libInjectCss } from 'vite-plugin-lib-inject-css'
import { resolve } from 'path'
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

dotenv.config() // load env vars from .env


export default defineConfig(({ mode }) => {




  return {
    define: {
      ENV_TOKEN: `"${process?.env?.OPEN_AI_API_KEY}"`, 
      __SYC_API_URL__: `"${process.env.SYC_API_URL}"` // wrapping in "" since it's a string
    },
    root: mode,
    build: {
      minify: false,
      copyPublicDir: false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'Fosforescent React',
        // the proper extensions will be added
        fileName: 'fosforescent-react',
        // formats: libFormats,
      },
      rollupOptions: {
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        // input: Object.fromEntries(
        //   glob.sync('src/**/*.{ts,tsx}').map(file => [
        //     // The name of the entry point
        //     // lib/nested/foo.ts becomes nested/foo
        //     relative(
        //       'src',
        //       file.slice(0, file.length - extname(file).length)
        //     ),
        //     // The absolute path to the entry file
        //     // lib/nested/foo.ts becomes /project/lib/nested/foo.ts
        //     fileURLToPath(new URL(file, import.meta.url))
        //   ])
        // ),
  
        output: {
          // inlineDynamicImports: false,
          // assetFileNames: 'assets/[name][extname]',
          // entryFileNames: '[name].js',
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            'react/jsx-runtime': 'jsxRuntime',
            tailwindcss: 'tailwindcss',
          },
        },
        plugins: []
      }
    },
    plugins: [
      react(), 
      viteTsconfigPaths(), 
      svgr({ svgrOptions: { icon: true } }),
      libInjectCss(),
      // postcss({
      //   plugins: [
      //     tailwindcss,
      //     autoprefixer,
      //   ]
      // }),
    ],
    css: {
      preprocessorOptions: {
        css: {
          javascriptEnabled: true,
        }
      },
      postcss: {
        plugins: [
          tailwindcss,
          autoprefixer,
        ],
      }
    }
  };
});
