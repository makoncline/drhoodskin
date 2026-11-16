import { defineConfig, lazyPlugins } from 'vite-plus'
import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  fmt: { semi: false, singleQuote: true },
  preview: { host: '127.0.0.1' },
  plugins: lazyPlugins(() => [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart({
      pages: [{ path: '/' }],
      prerender: {
        enabled: true,
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        filter: (page) => page.path === '/',
        failOnError: true,
      },
      sitemap: { enabled: false },
    }),
    react(),
  ]),
})
