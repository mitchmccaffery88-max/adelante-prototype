import { it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
it("dump", () => {
  const cl = (AdelanteEHRExt as any).listClaims?.() ?? [];
  for (const c of cl) { const p = AdelanteEHR.getPatient(c.patientId); if (c.program === "dmc_ods" || c.serviceCode==="H0001") console.log(p?.name, c.id, c.encounterId, c.program, c.serviceCode, c.state, c.rateStatus, c.serviceDate); }
  console.log("total", cl.length);
});
