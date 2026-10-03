import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? '/BookClub/' : '/',
  server: { host: 'localhost', port: 5173, strictPort: true },
  build: { outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
}));
