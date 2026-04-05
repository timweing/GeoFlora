import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@geoflora/audio": fileURLToPath(new URL("../../packages/audio/src/index.ts", import.meta.url)),
      "@geoflora/config": fileURLToPath(new URL("../../packages/config/src/index.ts", import.meta.url)),
      "@geoflora/rendering": fileURLToPath(new URL("../../packages/rendering/src/index.ts", import.meta.url)),
      "@geoflora/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
      "@geoflora/worldgen": fileURLToPath(new URL("../../packages/worldgen/src/index.ts", import.meta.url))
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true
      }
    }
  }
});

