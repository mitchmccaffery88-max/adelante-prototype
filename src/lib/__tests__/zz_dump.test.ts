import { it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { AdelanteEHRExt } from "@/lib/ehr-ext";
import { medicalNecessityGate, calomsWorklist, dmcOdsExportRows } from "@/lib/dmcOdsReadiness";
it("dump", () => {
  for (const c of AdelanteEHRExt.listClaims()) { const p = AdelanteEHR.getPatient(c.patientId); console.log(p?.firstName, c.encounterId, c.program, c.serviceCode, c.state, c.rateStatus, JSON.stringify(medicalNecessityGate(c))); }
  console.log(JSON.stringify(calomsWorklist("therapist")), dmcOdsExportRows("therapist")?.length);
});
