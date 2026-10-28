import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    // The dev server must not expose personal recordings beside the source tree.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/recordings/**', '**/*.{webm,mp4,mov,mkv,m4v,wav,mp3,m4a}'] },
  },
});
