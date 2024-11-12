// vite.config.mts
import { defineConfig } from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/@vitejs/plugin-react/dist/index.mjs";
import viteTsconfigPaths from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/vite-tsconfig-paths/dist/index.js";
import svgr from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/vite-plugin-svgr/dist/index.js";
import dotenv from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/dotenv/lib/main.js";
import { libInjectCss } from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/vite-plugin-lib-inject-css/dist/index.js";
import { resolve } from "path";
import autoprefixer from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/autoprefixer/lib/autoprefixer.js";
import tailwindcss from "file:///C:/Users/david/main/code/fos/fos-mono/node_modules/tailwindcss/lib/index.js";
var __vite_injected_original_dirname = "C:\\Users\\david\\main\\code\\fos\\fos-mono";
dotenv.config();
var vite_config_default = defineConfig(({ mode }) => {
  return {
    define: {
      ENV_TOKEN: `"${process?.env?.OPEN_AI_API_KEY}"`,
      __SYC_API_URL__: `"${process.env.SYC_API_URL}"`
      // wrapping in "" since it's a string
    },
    root: mode,
    build: {
      minify: false,
      copyPublicDir: false,
      lib: {
        entry: resolve(__vite_injected_original_dirname, "src/index.ts"),
        name: "Fosforescent React",
        // the proper extensions will be added
        fileName: "fosforescent-react"
        // formats: libFormats,
      },
      rollupOptions: {
        external: ["react", "react-dom", "react/jsx-runtime"],
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
            react: "React",
            "react-dom": "ReactDOM",
            "react/jsx-runtime": "jsxRuntime",
            tailwindcss: "tailwindcss"
          }
        },
        plugins: []
      }
    },
    plugins: [
      react(),
      viteTsconfigPaths(),
      svgr({ svgrOptions: { icon: true } }),
      libInjectCss()
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
          javascriptEnabled: true
        }
      },
      postcss: {
        plugins: [
          tailwindcss,
          autoprefixer
        ]
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcZGF2aWRcXFxcbWFpblxcXFxjb2RlXFxcXGZvc1xcXFxmb3MtbW9ub1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcZGF2aWRcXFxcbWFpblxcXFxjb2RlXFxcXGZvc1xcXFxmb3MtbW9ub1xcXFx2aXRlLmNvbmZpZy5tdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2RhdmlkL21haW4vY29kZS9mb3MvZm9zLW1vbm8vdml0ZS5jb25maWcubXRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB2aXRlVHNjb25maWdQYXRocyBmcm9tICd2aXRlLXRzY29uZmlnLXBhdGhzJztcclxuaW1wb3J0IHN2Z3IgZnJvbSAndml0ZS1wbHVnaW4tc3ZncidcclxuaW1wb3J0IGRvdGVudiBmcm9tICdkb3RlbnYnXHJcbmltcG9ydCB7IGxpYkluamVjdENzcyB9IGZyb20gJ3ZpdGUtcGx1Z2luLWxpYi1pbmplY3QtY3NzJ1xyXG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCdcclxuaW1wb3J0IGF1dG9wcmVmaXhlciBmcm9tIFwiYXV0b3ByZWZpeGVyXCI7XHJcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tIFwidGFpbHdpbmRjc3NcIjtcclxuXHJcbmRvdGVudi5jb25maWcoKSAvLyBsb2FkIGVudiB2YXJzIGZyb20gLmVudlxyXG5cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuXHJcblxyXG5cclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGRlZmluZToge1xyXG4gICAgICBFTlZfVE9LRU46IGBcIiR7cHJvY2Vzcz8uZW52Py5PUEVOX0FJX0FQSV9LRVl9XCJgLCBcclxuICAgICAgX19TWUNfQVBJX1VSTF9fOiBgXCIke3Byb2Nlc3MuZW52LlNZQ19BUElfVVJMfVwiYCAvLyB3cmFwcGluZyBpbiBcIlwiIHNpbmNlIGl0J3MgYSBzdHJpbmdcclxuICAgIH0sXHJcbiAgICByb290OiBtb2RlLFxyXG4gICAgYnVpbGQ6IHtcclxuICAgICAgbWluaWZ5OiBmYWxzZSxcclxuICAgICAgY29weVB1YmxpY0RpcjogZmFsc2UsXHJcbiAgICAgIGxpYjoge1xyXG4gICAgICAgIGVudHJ5OiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9pbmRleC50cycpLFxyXG4gICAgICAgIG5hbWU6ICdGb3Nmb3Jlc2NlbnQgUmVhY3QnLFxyXG4gICAgICAgIC8vIHRoZSBwcm9wZXIgZXh0ZW5zaW9ucyB3aWxsIGJlIGFkZGVkXHJcbiAgICAgICAgZmlsZU5hbWU6ICdmb3Nmb3Jlc2NlbnQtcmVhY3QnLFxyXG4gICAgICAgIC8vIGZvcm1hdHM6IGxpYkZvcm1hdHMsXHJcbiAgICAgIH0sXHJcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgICBleHRlcm5hbDogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3QvanN4LXJ1bnRpbWUnXSxcclxuICAgICAgICAvLyBpbnB1dDogT2JqZWN0LmZyb21FbnRyaWVzKFxyXG4gICAgICAgIC8vICAgZ2xvYi5zeW5jKCdzcmMvKiovKi57dHMsdHN4fScpLm1hcChmaWxlID0+IFtcclxuICAgICAgICAvLyAgICAgLy8gVGhlIG5hbWUgb2YgdGhlIGVudHJ5IHBvaW50XHJcbiAgICAgICAgLy8gICAgIC8vIGxpYi9uZXN0ZWQvZm9vLnRzIGJlY29tZXMgbmVzdGVkL2Zvb1xyXG4gICAgICAgIC8vICAgICByZWxhdGl2ZShcclxuICAgICAgICAvLyAgICAgICAnc3JjJyxcclxuICAgICAgICAvLyAgICAgICBmaWxlLnNsaWNlKDAsIGZpbGUubGVuZ3RoIC0gZXh0bmFtZShmaWxlKS5sZW5ndGgpXHJcbiAgICAgICAgLy8gICAgICksXHJcbiAgICAgICAgLy8gICAgIC8vIFRoZSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBlbnRyeSBmaWxlXHJcbiAgICAgICAgLy8gICAgIC8vIGxpYi9uZXN0ZWQvZm9vLnRzIGJlY29tZXMgL3Byb2plY3QvbGliL25lc3RlZC9mb28udHNcclxuICAgICAgICAvLyAgICAgZmlsZVVSTFRvUGF0aChuZXcgVVJMKGZpbGUsIGltcG9ydC5tZXRhLnVybCkpXHJcbiAgICAgICAgLy8gICBdKVxyXG4gICAgICAgIC8vICksXHJcbiAgXHJcbiAgICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgICAvLyBpbmxpbmVEeW5hbWljSW1wb3J0czogZmFsc2UsXHJcbiAgICAgICAgICAvLyBhc3NldEZpbGVOYW1lczogJ2Fzc2V0cy9bbmFtZV1bZXh0bmFtZV0nLFxyXG4gICAgICAgICAgLy8gZW50cnlGaWxlTmFtZXM6ICdbbmFtZV0uanMnLFxyXG4gICAgICAgICAgZ2xvYmFsczoge1xyXG4gICAgICAgICAgICByZWFjdDogJ1JlYWN0JyxcclxuICAgICAgICAgICAgJ3JlYWN0LWRvbSc6ICdSZWFjdERPTScsXHJcbiAgICAgICAgICAgICdyZWFjdC9qc3gtcnVudGltZSc6ICdqc3hSdW50aW1lJyxcclxuICAgICAgICAgICAgdGFpbHdpbmRjc3M6ICd0YWlsd2luZGNzcycsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcGx1Z2luczogW11cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIHBsdWdpbnM6IFtcclxuICAgICAgcmVhY3QoKSwgXHJcbiAgICAgIHZpdGVUc2NvbmZpZ1BhdGhzKCksIFxyXG4gICAgICBzdmdyKHsgc3Znck9wdGlvbnM6IHsgaWNvbjogdHJ1ZSB9IH0pLFxyXG4gICAgICBsaWJJbmplY3RDc3MoKSxcclxuICAgICAgLy8gcG9zdGNzcyh7XHJcbiAgICAgIC8vICAgcGx1Z2luczogW1xyXG4gICAgICAvLyAgICAgdGFpbHdpbmRjc3MsXHJcbiAgICAgIC8vICAgICBhdXRvcHJlZml4ZXIsXHJcbiAgICAgIC8vICAgXVxyXG4gICAgICAvLyB9KSxcclxuICAgIF0sXHJcbiAgICBjc3M6IHtcclxuICAgICAgcHJlcHJvY2Vzc29yT3B0aW9uczoge1xyXG4gICAgICAgIGNzczoge1xyXG4gICAgICAgICAgamF2YXNjcmlwdEVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgfVxyXG4gICAgICB9LFxyXG4gICAgICBwb3N0Y3NzOiB7XHJcbiAgICAgICAgcGx1Z2luczogW1xyXG4gICAgICAgICAgdGFpbHdpbmRjc3MsXHJcbiAgICAgICAgICBhdXRvcHJlZml4ZXIsXHJcbiAgICAgICAgXSxcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH07XHJcbn0pO1xyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWlULFNBQVMsb0JBQW9CO0FBQzlVLE9BQU8sV0FBVztBQUNsQixPQUFPLHVCQUF1QjtBQUM5QixPQUFPLFVBQVU7QUFDakIsT0FBTyxZQUFZO0FBQ25CLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBZTtBQUN4QixPQUFPLGtCQUFrQjtBQUN6QixPQUFPLGlCQUFpQjtBQVJ4QixJQUFNLG1DQUFtQztBQVV6QyxPQUFPLE9BQU87QUFHZCxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUt4QyxTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixXQUFXLElBQUksU0FBUyxLQUFLLGVBQWU7QUFBQSxNQUM1QyxpQkFBaUIsSUFBSSxRQUFRLElBQUksV0FBVztBQUFBO0FBQUEsSUFDOUM7QUFBQSxJQUNBLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxNQUNSLGVBQWU7QUFBQSxNQUNmLEtBQUs7QUFBQSxRQUNILE9BQU8sUUFBUSxrQ0FBVyxjQUFjO0FBQUEsUUFDeEMsTUFBTTtBQUFBO0FBQUEsUUFFTixVQUFVO0FBQUE7QUFBQSxNQUVaO0FBQUEsTUFDQSxlQUFlO0FBQUEsUUFDYixVQUFVLENBQUMsU0FBUyxhQUFhLG1CQUFtQjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFlcEQsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBLFVBSU4sU0FBUztBQUFBLFlBQ1AsT0FBTztBQUFBLFlBQ1AsYUFBYTtBQUFBLFlBQ2IscUJBQXFCO0FBQUEsWUFDckIsYUFBYTtBQUFBLFVBQ2Y7QUFBQSxRQUNGO0FBQUEsUUFDQSxTQUFTLENBQUM7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBLE1BQ04sa0JBQWtCO0FBQUEsTUFDbEIsS0FBSyxFQUFFLGFBQWEsRUFBRSxNQUFNLEtBQUssRUFBRSxDQUFDO0FBQUEsTUFDcEMsYUFBYTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBT2Y7QUFBQSxJQUNBLEtBQUs7QUFBQSxNQUNILHFCQUFxQjtBQUFBLFFBQ25CLEtBQUs7QUFBQSxVQUNILG1CQUFtQjtBQUFBLFFBQ3JCO0FBQUEsTUFDRjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsU0FBUztBQUFBLFVBQ1A7QUFBQSxVQUNBO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
