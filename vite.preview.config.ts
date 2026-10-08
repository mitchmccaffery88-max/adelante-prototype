// Preview serves an already-built Nitro artifact; never starts the development compiler.
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
export default defineConfig({ plugins: [nitro()], preview: { host: "0.0.0.0", port: 4173, strictPort: true } });
