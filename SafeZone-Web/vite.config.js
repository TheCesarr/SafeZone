import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react()
  ],
  base: './', // CRITICAL: Enables file:// protocol usage in Electron
  server: {
    host: true
  }
})
