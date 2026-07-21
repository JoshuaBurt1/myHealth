import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  root: __dirname,
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
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'], 
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    // --- ADDED THIS SECTION ---
    // This ensures Vite prefers the .web.ts version of shared files
    extensions: ['.web.tsx', '.web.ts', '.tsx', '.ts', '.jsx', '.js'],
    alias: {
      'react': path.resolve(__dirname, 'node_modules/react'),
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true, 
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    fs: {
      allow: ['../..'] 
    }
  }
});