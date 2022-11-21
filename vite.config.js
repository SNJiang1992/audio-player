import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'audio-player',
      fileName: format => `audio-player.${format}.js`,
    },
  },
})
