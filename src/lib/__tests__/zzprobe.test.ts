import { it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
import { isMatOrder, refillRunway } from "@/lib/medAdherence";
it("probe", () => {
  for (const p of AdelanteEHR.listPatients()) {
    const mat = AdelanteEHR.listOrders(p.id).filter(isMatOrder);
    const eps = AdelanteEHR.listPreReleaseEpisodes(p.id);
    if (mat.length || eps.length)
      console.log(p.id, p.firstName, p.lastName, p.caseManagerId, p.prescriberStaffId, "mat:", mat.map((o) => `${o.id}/${o.status}/${o.startDate}/${o.daysSupply}/${refillRunway(o)?.daysLeft}`).join(","), "eps:", eps.map((e) => `${e.id}/${e.status}/${e.actualReleaseDate}/${e.cfCareManagerStaffId}`).join(","));
  }
});
