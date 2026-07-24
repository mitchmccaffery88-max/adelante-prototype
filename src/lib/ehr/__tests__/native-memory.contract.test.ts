import { vi } from "vitest";
import { runEhrAdapterContract } from "./adapter.contract";
import type { EhrAdapter } from "../adapter";

// Re-import the adapter module in isolation for each test so the in-memory
// seed data resets between cases. `vi.resetModules()` clears the ESM cache
// so the module-scoped arrays inside `@/lib/ehr` are re-created.
runEhrAdapterContract("native-memory", async (): Promise<EhrAdapter> => {
  vi.resetModules();
  const mod = await import("../adapters/native-memory");
  return mod.nativeMemoryEhrAdapter;
});