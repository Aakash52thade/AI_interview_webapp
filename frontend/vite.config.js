import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Warn if any chunk exceeds 800kb
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split vendor libraries into separate chunks — faster repeat loads
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'redux-vendor':  ['@reduxjs/toolkit', 'react-redux'],
          'clerk-vendor':  ['@clerk/clerk-react'],
          'monaco-vendor': ['@monaco-editor/react'],
          'chart-vendor':  ['chart.js', 'react-chartjs-2'],
          'ui-vendor':     ['react-toastify', 'socket.io-client'],
        },
      },
    },
  },
})
