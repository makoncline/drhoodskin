import { defineConfig, lazyPlugins } from 'vite-plus'
import { nitro } from 'nitro/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  fmt: { semi: false, singleQuote: true },
  preview: { host: '127.0.0.1' },
  plugins: lazyPlugins(() => [
    nitro({ preset: 'node-server', rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    react(),
  ]),
})
