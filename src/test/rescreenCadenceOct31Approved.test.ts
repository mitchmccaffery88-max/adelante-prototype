import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { describe, it, expect } from "vitest";
import fixture from "./rescreenCadenceOct31.fixture.json";
import { withApprovedRescreenCadenceOct31 } from "./rescreenCadenceOct31Approved";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
import { withApprovedConsentB2 } from "./consentB2Approved";
describe("R53 exact-once chained source approval", () => {
  it.each(Object.keys(fixture))("%s matches approved final source and refuses drift/reapplication", path => {
    const approval = fixture[path as keyof typeof fixture];
    const current=readFileSync(path,"utf8");
    let prior=current;
    for(const [anchor,replacement] of [...approval.edits].reverse()) prior=prior.replace(replacement,()=>anchor);
    expect(createHash("sha256").update(prior).digest("hex")).toBe(approval.priorHash);
    expect(withApprovedRescreenCadenceOct31(path,prior)).toBe(current);
    expect(()=>withApprovedRescreenCadenceOct31(path,prior+"\n")).toThrow("R53 prior source changed");
    expect(()=>withApprovedRescreenCadenceOct31(path,current)).toThrow("R53 prior source changed");
  });
  it("ehr rollback goes through the final credentialing approval chain", () => {
    const path="src/lib/ehr.ts";
    const rollback=execFileSync("git",["show",`b1d3c414:${path}`],{encoding:"utf8",maxBuffer:64*1024*1024});
    expect(withApprovedCredentialingOct27(path,withApprovedConsentB2(path,rollback))).toBe(readFileSync(path,"utf8"));
  });
});