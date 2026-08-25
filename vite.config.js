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
        // Never cache API — live weather/AQI must stay fresh
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ['/sw-push-click.js'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
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
            `&timezone=${encodeURIComponent(tz)}&forecast_days=5`
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
      // /api/alerts, /api/climate, /api/models, /api/public are Vercel serverless.
      // Local full stack: `npx vercel dev`. Client has direct Open-Meteo fallbacks.
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
})
