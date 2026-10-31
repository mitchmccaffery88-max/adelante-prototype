import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
const path = "src/lib/__tests__/reassessment.test.ts";
const from = '    expect(() => AdelanteEHR.completeRescreen(p.id, "phq-9", [0, 1], { actorId: p.id, actorRole: "patient" })).toThrow();';
describe("Mitch approved R5 reassessment assertion, exact-once", () => {
  it("changes only the approved assertion through the existing chain", () => {
    const current = readFileSync(path, "utf8");
    const start = current.indexOf('    return import("@/lib/actions/runAction").then(() => {');
    const end = current.indexOf("\n  });", start);
    expect(start).toBeGreaterThan(0);
    const prior = current.slice(0, start) + from + current.slice(end);
    expect(withApprovedCredentialingOct27(path, prior)).toBe(current);
    expect(() => withApprovedCredentialingOct27(path, current)).toThrow("R5 reassessment prior source changed");
    expect(() => withApprovedCredentialingOct27(path, prior + "\n")).toThrow("R5 reassessment prior source changed");
  });
});
