import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig(({ mode }) => ({
  plugins: [preact()],
  build: {
    sourcemap: mode !== 'production',
  },
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
}))