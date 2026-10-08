import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview, mode }) => {
  // A production dashboard host must not turn a local Vite server into PROD.
  if (command === 'serve' && !isPreview) process.env.NODE_ENV = 'development';
  return ({
  plugins: [react()],
  // Development must never follow a production API URL from a root env file.
  define: command === 'serve' && !isPreview
    ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://localhost:8787') } : undefined,
  base: '/',
  publicDir: 'generated/public',
  server: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: mode === 'import-preview' ? undefined : { '/__dev': {target: 'http://127.0.0.1:8790', changeOrigin: false} } },
  build: { outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
});
});
