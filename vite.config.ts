import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview, mode }) => ({
  plugins: [react()],
  // Preview history must never follow a production API URL from a root env file.
  define: command === 'serve' && !isPreview && mode === 'import-preview'
    ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://localhost:8787') } : undefined,
  base: command === 'build' || isPreview ? '/BookClub/' : '/',
  server: { host: 'localhost', port: 5173, strictPort: true },
  build: { outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
}));
