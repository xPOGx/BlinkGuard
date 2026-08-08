import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		electron({
			main: {
				// Shortcut of `build.lib.entry`.
				entry: "electron/main.ts",
				vite: {
					build: {
						rollupOptions: {
							// Keep updater out of the bundle (native/optional deps).
							external: ["electron-updater"],
						},
						rolldownOptions: {
							external: ["electron-updater"],
						},
					},
				},
			},
			preload: {
				// Shortcut of `build.rollupOptions.input`.
				// Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
				input: path.join(import.meta.dirname, "electron/preload.ts"),
			},
			// Renderer uses contextBridge preload only — no Node/Electron imports in `src/`.
			renderer: undefined,
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	build: {
		// Desktop settings shell: one chunk is fine; keep advisory noise down.
		chunkSizeWarningLimit: 800,
		rolldownOptions: {
			external: ["electron"],
		},
	},
});
