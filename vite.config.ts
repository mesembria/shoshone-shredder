import { defineConfig } from 'vite';

// host: true lets the iPads reach the dev server over the home Wi-Fi.
export default defineConfig({
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  // Rapier ships its physics engine inside the bundle (~2 MB). Pages: the first prototype, the game (play), and lab.html,
  // which only redirects to the game now.
  build: { target: 'es2020', chunkSizeWarningLimit: 3000, rollupOptions: { input: { main: 'index.html', lab: 'lab.html', play: 'play.html' } } },
});
