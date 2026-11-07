import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Relative base: the artifact serves the page and its assets side by side.
export default defineConfig({
    base: "./",
    plugins: [svelte()],
    build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0, cssCodeSplit: false },
});
