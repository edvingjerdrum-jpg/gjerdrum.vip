import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Only GitHub Pages uses static SPA output; Lovable retains its Worker build.
const githubPages = process.env['GITHUB_PAGES'] === "true";
export default defineConfig({
  ...(githubPages ? { nitro: false as const } : {}),
  tanstackStart: {
    server: { entry: "server" },
    ...(githubPages ? {
      spa: { enabled: true, prerender: { outputPath: "/index.html", autoSubfolderIndex: false } },
      prerender: { autoStaticPathsDiscovery: false },
      sitemap: { enabled: false },
    } : {}),
  },
});
