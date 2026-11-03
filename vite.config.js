import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3002',
      '/out': 'http://localhost:3002',
    },
    watch: {
      ignored: ['**/reports/**', '**/articles/**', '**/topics/**', '**/timelines/**', '**/out/**'],
    },
  },
});
