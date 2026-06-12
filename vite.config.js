import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/scrape': {
        target: 'https://api.allorigins.win',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/scrape', '/get'),
      },
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => '/v1/messages',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const apiKey = req.headers['x-api-key-forward']
            if (apiKey) {
              proxyReq.setHeader('x-api-key', apiKey)
              proxyReq.removeHeader('x-api-key-forward')
            }
            proxyReq.setHeader('anthropic-version', '2023-06-01')
          })
        }
      }
    }
  }
})
