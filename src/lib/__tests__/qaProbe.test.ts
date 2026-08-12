import { describe, it } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";

describe("qa probe", () => {
  it("dumps", () => {
    for (const p of AdelanteEHR.listPatients()) {
      console.log(p.id, p.firstName, JSON.stringify({
        releaseDate: p.releaseDate, coverage: p.coverage, frontDoor: p.frontDoor,
        referralId: p.referralId, missed: p.missedPreReleaseCoordination,
        eps: AdelanteEHR.listPreReleaseEpisodes(p.id).map(e=>({s:e.status,m:e.missedHandoff})),
      }));
    }
  });
});
