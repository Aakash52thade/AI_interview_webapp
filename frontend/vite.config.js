import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@monaco-editor') || id.includes('monaco-editor')) return 'monaco-vendor'
            if (id.includes('@clerk'))           return 'clerk-vendor'
            if (id.includes('chart.js') || id.includes('react-chartjs')) return 'chart-vendor'
            if (id.includes('@reduxjs') || id.includes('react-redux'))   return 'redux-vendor'
            if (id.includes('react-dom') || id.includes('react-router')) return 'react-vendor'
            if (id.includes('socket.io') || id.includes('react-toastify')) return 'ui-vendor'
          }
        },
      },
    },
  },
})
