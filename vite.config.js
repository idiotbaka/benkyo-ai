import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tauri expects a fixed port and no auto-open
  server: {
    port: 5173,
    strictPort: true,
  },
  // Tauri uses relative paths
  base: './',
})
