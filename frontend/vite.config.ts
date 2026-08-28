import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    headers: {
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  },
  plugins: [
    react(),
    // Substitute %VITE_SITE_URL% in index.html with the configured origin,
    // falling back to the production origin so staging/preview builds never
    // emit a broken literal placeholder or advertise the wrong host.
    {
      name: "inject-site-url",
      enforce: "pre" as const,
      transformIndexHtml(html: string) {
        const siteUrl = process.env.VITE_SITE_URL || "https://cashus.online";
        return html.replaceAll("%VITE_SITE_URL%", siteUrl);
      },
    },
    mode === "development" &&
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
