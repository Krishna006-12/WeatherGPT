import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
        'sw-push-click.js',
        'llms.txt',
        'robots.txt',
        'openapi.json',
        'sih.html',
        'HONESTY.txt',
        'IMPACT_AND_SCALE.txt',
      ],
      manifest: {
        name: 'WeatherGPT',
        short_name: 'WeatherGPT',
        description: 'SIH AI weather intelligence — chat, alerts, climate, NWP, farm, travel, school, voice',
        theme_color: '#0B1F3A',
        background_color: '#06101f',
        display: 'standalone',
        start_url: '/',
        lang: 'en',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ['/sw-push-click.js'],
        // Smaller precache transfer on low bandwidth
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,txt,json}'],
        // Don't force-download charts/motion on first visit — runtime cache when opened
        globIgnores: ['**/charts-*.js', '**/motion-*.js', '**/workbox-*.js', '**/sw.js'],
        runtimeCaching: [
          {
            // Same-origin API: network first, short offline fallback for weather only
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith('/api/weather'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-weather-runtime',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/api/weather'),
            handler: 'NetworkOnly',
          },
          {
            // Open-Meteo forecast — NetworkFirst so airplane mode can reuse last pack
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo-forecast',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 6 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/geocoding-api\.open-meteo\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'open-meteo-geo',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      // Manual chunks: keep first paint small
      // (also configured in build.rollupOptions below)
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      // Local dev: mimic Vercel /api/* by proxying to Open-Meteo
      // Local: direct Open-Meteo (live_alerts only on Vercel api/weather.js)
      '/api/weather': {
        target: 'https://api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL(path, 'http://local')
          const lat = u.searchParams.get('lat')
          const lon = u.searchParams.get('lon')
          const tz = u.searchParams.get('tz') || 'auto'
          return (
            `/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility` +
            `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
            `&timezone=${encodeURIComponent(tz)}&forecast_days=7`
          )
        },
      },
      '/api/geocode': {
        target: 'https://geocoding-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL(path, 'http://local')
          const q = u.searchParams.get('q') || u.searchParams.get('name') || ''
          const count = u.searchParams.get('count') || '10'
          const language = u.searchParams.get('language') || 'en'
          return `/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=${language}&format=json`
        },
      },
      '/api/aqi': {
        target: 'https://air-quality-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL(path, 'http://local')
          const lat = u.searchParams.get('lat')
          const lon = u.searchParams.get('lon')
          return (
            `/v1/air-quality?latitude=${lat}&longitude=${lon}` +
            `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`
          )
        },
      },
      // Hybrid chat (Gemini when GEMINI_API_KEY set on local-api-server)
      '/api/chat': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/api/alerts': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/api/climate': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/api/models': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/api/public': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      // /api/alerts etc. also work via: node scripts/local-api-server.mjs
      // Production: Vercel serverless api/*.js
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    // Same API proxy as dev — local-api-server.mjs on :8787
    proxy: {
      '/api/chat': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/alerts': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/climate': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/models': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/public': { target: 'http://127.0.0.1:8787', changeOrigin: true },
      '/api/weather': {
        target: 'https://api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL(path, 'http://local')
          const lat = u.searchParams.get('lat')
          const lon = u.searchParams.get('lon')
          const tz = u.searchParams.get('tz') || 'auto'
          return (
            `/v1/forecast?latitude=${lat}&longitude=${lon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,visibility` +
            `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,visibility` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset` +
            `&timezone=${encodeURIComponent(tz)}&forecast_days=7`
          )
        },
      },
      '/api/geocode': {
        target: 'https://geocoding-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL(path, 'http://local')
          const q = u.searchParams.get('q') || u.searchParams.get('name') || ''
          const count = u.searchParams.get('count') || '10'
          const language = u.searchParams.get('language') || 'en'
          return `/v1/search?name=${encodeURIComponent(q)}&count=${count}&language=${language}&format=json`
        },
      },
      '/api/aqi': {
        target: 'https://air-quality-api.open-meteo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const u = new URL(path, 'http://local')
          const lat = u.searchParams.get('lat')
          const lon = u.searchParams.get('lon')
          return (
            `/v1/air-quality?latitude=${lat}&longitude=${lon}` +
            `&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`
          )
        },
      },
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/victory') || id.includes('d3-')) {
            return 'charts'
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion'
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons'
          }
        },
      },
    },
  },
})
