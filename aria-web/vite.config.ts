import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// Supprimez l'import de @tailwindcss/vite
// import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react()], // Supprimez tailwindcss() de la liste
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})