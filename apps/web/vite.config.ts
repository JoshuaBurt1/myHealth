import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  // 1. Set the root of the web project to this folder
  root: __dirname,
  
  // 2. Point to the .env file at the absolute root of MY-HEALTH
  envDir: '../../',
  
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png'],
      manifest: {
        name: 'myHealth Tracking',
        short_name: 'myHealth',
        description: 'AI-powered health metric tracking and graph analysis',
        theme_color: '#2563eb',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' 
          }
        ]
      },
      workbox: {
        // Caches your charts and health data logic for offline use on your Pixel 10
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], 
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      // Force all imports to use the React version in apps/web
      'react': path.resolve(__dirname, 'node_modules/react'),
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Prevents Vite from trying other ports if 5173 is busy
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    fs: {
      allow: ['../..'] // Allows Vite to reach up to the root node_modules and shared package
    }
  }
});