import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      workbox: {
        // Precache the entire app, not just the shell: the schedule JSON, all
        // three map images and every guest photo. Con wifi is unusable, so
        // anything not precached is effectively broken.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,json,woff2}'],
        // floor.webp is ~490KB; the default 2MB limit would silently skip it.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
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
