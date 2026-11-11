import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Port 5174 so Dakon can run beside the other projects' dev servers.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
})
