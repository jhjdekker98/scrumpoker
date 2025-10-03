import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
    root: __dirname,
    build: {
        outDir: path.resolve(__dirname, "../dist/ws-server"),
        emptyOutDir: true,
        target: "node16",
        lib: {
            entry: path.resolve(__dirname, "index.ts"),
            formats: ["es"],
            fileName: () => "index.js"
        },
        rollupOptions: {
            external: ["ws", "http", "node:http", "url", "crypto", "buffer", "events", "stream"]
        }
    },
    resolve: {
        preserveSymlinks: true
    }
});
