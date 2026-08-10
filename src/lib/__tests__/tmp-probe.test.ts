import { describe, it, expect } from "vitest";
import { AdelanteEHR } from "@/lib/ehr";
describe("x", () => { it("y", () => {
  const ps = AdelanteEHR.listPatients();
  console.log(ps.length, ps.map(p=>[p.id,(p.episodes??[]).map(e=>e.type+":"+e.state).join("/")]));
  expect(1).toBe(1);
});});
