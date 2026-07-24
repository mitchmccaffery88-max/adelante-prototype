// Public entry for the native EHR adapter layer.
//
// Importing this module registers the default in-memory adapter as a side
// effect. To swap backends, register a different adapter here (or from
// `src/start.ts`) before any consumer calls `getEhrAdapter()`.

import { registerEhrAdapter } from "./adapter";
import { nativeMemoryEhrAdapter } from "./adapters/native-memory";

registerEhrAdapter(nativeMemoryEhrAdapter);

export { getEhrAdapter, registerEhrAdapter } from "./adapter";
export type {
  EhrAdapter,
  PatientAdapter,
  AppointmentAdapter,
  ClinicianAdapter,
} from "./adapter";
export { nativeMemoryEhrAdapter } from "./adapters/native-memory";

// Re-export the existing store + reactive hook so callers can migrate
// incrementally without changing import paths later.
export { AdelanteEHR, useEhr } from "@/lib/ehr";