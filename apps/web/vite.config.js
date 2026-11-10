import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Installable app (PWA): manifest + a service worker that
// - precaches the app itself, so it opens without a connection
// - keeps the last copy of the rider's data (GET /api/…) for offline viewing: network first,
//   the saved copy only when the network fails. Cleared on logout (src/lib/offline.js).
const API_CACHE = 'ftr-api';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // a new version waits until the rider taps "Reload" (never mid-ride)
      injectRegister: false, // registered in src/lib/pwa.js
      includeAssets: ['favicon.svg', 'favicon-48.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Fuel the Ride',
        short_name: 'Fuel the Ride',
        description: 'How much to eat and drink for your ride, using the foods you already eat.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#10275a', // splash screen: the icon's navy, so the icon blends in
        theme_color: '#10275a',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              request.method === 'GET' &&
              url.pathname.startsWith('/api/') &&
              // Never keep: the data export (a one-off download), health checks, or config
              !/^\/api\/(users\/me\/export|health|client-config)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: {
              cacheName: API_CACHE,
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 14 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // Same-origin API calls in development, so the auth cookies just work
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
