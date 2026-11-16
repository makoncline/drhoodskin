import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { useScrollMemory } from '../lib/useScrollMemory'
import { usePageActivity } from '../lib/usePageActivity'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Dr. Channing Hood | Dermatologist in Golden, CO',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  useScrollMemory()
  usePageActivity()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:break-word]">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
