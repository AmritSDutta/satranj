import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import faroUploader from '@grafana/faro-rollup-plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    faroUploader({
      appName: 'satranj.amritai.org',
      endpoint: 'https://faro-api-prod-ap-south-1.grafana.net/faro/api/v1',
      appId: '1960',
      stackId: '1619876',
      verbose: true,
      // Retrieve the API key from environment variables to avoid committing secrets
      apiKey: process.env.FARO_API_KEY || '$your-api-key',
      gzipContents: true,
    })
  ],
  server: {
    host: true,
  }
})

