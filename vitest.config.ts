import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone Vitest config — kept separate from the app's Vite config, which
// uses the Lovable TanStack preset (adds SSR/router plugins we don't want in
// unit tests). The `@` alias mirrors tsconfig paths so contract tests can
// import `@/lib/ehr/...` the same way runtime code does.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});