/// <reference types="vitest/config" />
import { configDefaults } from 'vitest/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/PageToPlate/',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'PageToPlate', short_name: 'PageToPlate',
      description: 'Actually use your cookbooks.',
      theme_color: '#F6F4EC', background_color: '#F6F4EC', display: 'standalone',
      icons: [
        { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: { globPatterns: ['**/*.{js,css,html,woff2,png,svg}'] },
  })],
  // e2e/ is Playwright's (playwright.config.ts), not vitest's — its default
  // include pattern would otherwise try to collect core-loop.spec.ts.
  test: { environment: 'node', exclude: [...configDefaults.exclude, 'e2e/**'] },
});
