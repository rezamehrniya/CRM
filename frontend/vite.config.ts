/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

async function resolveProxyTarget() {
  const explicitTarget = process.env.VITE_API_PROXY_TARGET?.trim();
  return explicitTarget || 'http://localhost:3000';
}

export default defineConfig(async () => {
  const proxyTarget = await resolveProxyTarget();
  console.log(`[vite] API proxy target: ${proxyTarget}`);

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) return undefined;

            if (normalizedId.includes('/node_modules/recharts/') || normalizedId.includes('/node_modules/d3-')) {
              return 'charts-vendor';
            }
            if (normalizedId.includes('/node_modules/@dnd-kit/')) {
              return 'dnd-vendor';
            }
            if (normalizedId.includes('/node_modules/date-fns-jalali/')) {
              return 'date-vendor';
            }
            if (normalizedId.includes('/node_modules/react-router-dom/')) {
              return 'router-vendor';
            }
            if (
              normalizedId.includes('/node_modules/react/') ||
              normalizedId.includes('/node_modules/react-dom/') ||
              normalizedId.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
            if (normalizedId.includes('/node_modules/lucide-react/')) {
              return 'icons-vendor';
            }
            return undefined;
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
