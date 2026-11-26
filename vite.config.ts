import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [tailwindcss()],
  build: {
    rollupOptions: { input: { city: 'index.html', ecosystem: 'ecosystem.html' } },
  },
})
