/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxying keeps the browser on one origin, so no CORS is involved and the app's
    // relative `/api` base URL works unchanged against the real backend.
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
      // Uploaded images when no bucket is configured. Without this the path falls through
      // to the SPA fallback, which answers 200 with index.html — so every product photo
      // is a broken image, and a status-code check says everything is fine.
      '/local-images': {
        target: process.env.VITE_BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  // Tests share this config rather than carrying a second build pipeline that has to be
  // kept in step with it.
  test: {
    environment: 'happy-dom',
    globals: true,
    // schedulerTransport first: it must run before anything imports react-dom.
    setupFiles: ['./src/test/schedulerTransport.ts', './src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/test/**'],
    },
  },
})
