import { defineConfig, lazyPlugins } from 'vite-plus'
import cloudflare from '@alchemy.run/cloudflare-runtime/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  fmt: { semi: false, singleQuote: true },
  plugins: lazyPlugins(() => [
    ...(process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED
      ? []
      : [
          cloudflare({
            main: './src/worker.ts',
            compatibilityDate: '2026-11-03',
            compatibilityFlags: ['nodejs_compat'],
          }),
        ]),
    tailwindcss(),
    tanstackStart(),
    react(),
  ]),
})
