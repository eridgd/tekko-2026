import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' (not autoUpdate): a new deploy waits for the user to tap
      // "Refresh" (see src/components/UpdatePrompt.tsx) instead of silently
      // swapping — so an open app doesn't keep showing stale schedule data, but
      // also isn't reloaded out from under someone mid-scroll.
      registerType: 'prompt',
      // We register the SW ourselves via the useRegisterSW hook.
      injectRegister: false,
      // Icons live in public/ and are already swept up by globPatterns below;
      // listing them again here just produced duplicate precache entries.
      workbox: {
        // Precache the app shell + all static assets (map images, guest photos)
        // so it works offline. NOT the data JSON — that's handled network-first
        // below so the schedule is always current when online (it's auto-
        // refreshed every 30 min; a precached copy would go stale until the
        // whole service worker updated).
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        globIgnores: ['**/data/**'],
        // floor.webp is ~490KB; the default 2MB limit would silently skip it.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/data\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Schedule / maps / guests JSON: fetch fresh when online (so a
            // reload shows the latest data), fall back to the last-seen copy
            // when offline or on dead con wifi.
            urlPattern: ({ url }) => url.pathname.startsWith('/data/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'tekko-schedule-data',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 12 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Tekko 2026 Schedule',
        short_name: 'Tekko 26',
        description: 'Unofficial Tekko 2026 schedule, map and personal planner. Works offline.',
        theme_color: '#0F1621',
        background_color: '#0F1621',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    // One vendor chunk keeps the critical path small without over-splitting a
    // handful of modules.
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
});
