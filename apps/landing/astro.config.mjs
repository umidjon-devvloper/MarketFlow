import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Landing zonasi — MarketFlow microfrontend'ining public marketing qismi.
// Interaktiv qismlar (demo, theme toggle) React island sifatida ishlaydi.
export default defineConfig({
  integrations: [react()],
  // Multi-Zones: bu zona keyinchalik web zonasi bilan bitta domenga ulanadi.
  // Hozircha lokal dev 3001-portda.
  server: { port: 3001 },
  vite: {
    server: {
      // Sahifa 3000-port (Next proxy) orqali ochilganda ham HMR websocket
      // to'g'ridan-to'g'ri Astro dev-server'iga (3001) ulanishi kerak —
      // Next rewrites websocket'larni proxy qilmaydi.
      hmr: { clientPort: 3001 },
    },
  },
});
