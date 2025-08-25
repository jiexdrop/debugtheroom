import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:4315',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/v1/, '/v1')
      }
    }
  }
})
