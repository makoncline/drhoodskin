# Napkin — drhoodskin

## CSS Layer Ordering (Tailwind v4)
- `@import "tailwindcss"` sets up `@layer theme, base, components, utilities`.
- **Unlayered CSS always beats layered CSS**, regardless of specificity.
- Base element styles (`a { color: inherit }`) MUST go in `@layer base` so Tailwind utilities can override them. Previously the `a` rule was unlayered, which broke `text-[var(--ink)]` on `<a>` buttons inside parents with `text-white`.
- The `.eyebrow` class uses `color: var(--accent)` and is currently unlayered — override with `!text-*` when placing eyebrows on colored backgrounds.

## Global Hover Rules
- Do NOT add global `a:hover { color: ... }` — it silently breaks all button-styled `<a>` elements since it overrides Tailwind hover utilities on teal-bg/white-bg buttons.
- Every link that needs a hover color should use explicit Tailwind `hover:text-*` utilities.

## Build / Dev
- Dev server: `npx vite dev --port 3000` (from `app/` dir, after `npm install`).
- Build: `npm run build` from `app/`.
- Stack: TanStack Start (React 19, Vite 7, Nitro SSR), Tailwind CSS v4, file-based routing.
- `app/server.ts` is active in the Nitro production server, but the plain Vite dev server does not fully exercise those server-entry routes. For `/.well-known/*`, `Link` headers, and markdown negotiation, verify with `npm run build` + `npm start`.
- Nitro route matching here should use `new URL(event.req.url, siteCanonical).pathname` instead of `event.path` when query params matter, because `event.path` includes the query string.
