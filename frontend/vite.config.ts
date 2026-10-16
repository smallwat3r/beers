import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import preact from '@preact/preset-vite'

// the .env file lives at the repository root, not next to this config
const envDir = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig(({ mode }) => {
  // index.html interpolates this into the preconnect and preload tags; left
  // unset, Vite fails on the raw %VITE_...% placeholder with an opaque
  // "URI malformed", so check it here and say what is actually wrong
  if (!loadEnv(mode, envDir, 'R2_PUBLIC_URL').R2_PUBLIC_URL) {
    throw new Error('R2_PUBLIC_URL is not set, see .env.example')
  }

  return {
    envDir,
    // R2_PUBLIC_URL is public, so it is exposed alongside the VITE_ default.
    // Prefixes are matched exactly as written, so the bucket credentials in the
    // same .env stay out of the bundle.
    envPrefix: ['VITE_', 'R2_PUBLIC_URL'],
    plugins: [preact()],
    // same origin as the dev server, so the bucket CORS policy only needs to
    // allow one local port; dev and preview cannot run at the same time
    preview: { port: 5173, strictPort: true },
    build: {
      sourcemap: mode !== 'production',
      // maplibre is a 1 MB chunk by itself, loaded only when the map opens
      chunkSizeWarningLimit: 1100,
    },
  }
})