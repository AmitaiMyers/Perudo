import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any GitHub Pages sub-path (e.g. /Perudo/).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
