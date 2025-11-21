import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Huella Escolar',
        short_name: 'Huella',
        description: 'Gestión de Educación Física',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone', // Esto quita la barra de URL del navegador
        orientation: 'portrait', // Bloquea la rotación vertical
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any', // Truco para que el SVG sirva para todos los tamaños
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})