import { createHash } from "node:crypto";
import { withApprovedBrowserTriageOct30 } from "./browserTriageOct30Approved";
// Mitch approved 31 Oct: viewer-scoped IDs, Intake pool actor, named checkbox only.
const APPROVED = {
  "e2e/remainingQueueTables8b2.spec.ts": {
    "prior": "bedff39e3a16e135dbc921b8dd38c9e6679fd3c4fa2b0d676ad3df684634e0b2",
    "updated": "b538c9b6e1c1a033d775ed10a86976cfdb0c7a775d051a1b3a7daf48fb013a76",
    "pairs": [
      [
        "listUnsignedWork({ authorId: 'c1' })",
        "listUnsignedWork({ authorId: 'c1', viewer: { role: 'therapist', staffId: 's-th1' } })"
      ]
    ]
  },
  "e2e/consentWorkflow.spec.ts": {
    "prior": "26de2c5a9df27650e9096ee908f7d183de2208ad1a77523e946eae3ee076d24a",
    "updated": "489e3711ab2e241640956bf7110c3a95d074be6c2d5538731430d8e27c9c4345",
    "pairs": [
      [
        "\"Sharing substance-use information (Part 2)\"",
        "\"Sharing substance-use information for your care (Part 2)\""
      ]
    ]
  },
  "e2e/crossRoleJourneys.spec.ts": {
    "prior": "1cbae761cbb6494e6b44ab4914f2f4aebba1669639744af85adf9cd50a7dc50d",
    "updated": "facb44305f3fcf88ccbd3c18fe5132cba0f4e8e6c79ecb35f0671b6605a30f99",
    "pairs": [
      [
        "  const r = await page.evaluate((lastName) => {",
        "  const intake = await page.evaluate(async () => {\n    const roles = await import(/* @vite-ignore */ \"/src/lib/roles.ts\");\n    const member = roles.staffForRole(\"intake_coordinator\")[0];\n    if (!member) throw new Error(\"No assigned Intake Coordinator in roster\");\n    return { staffId: member.id, name: member.name, role: \"intake_coordinator\" };\n  });\n  await as(page, intake.staffId, intake.role);\n  const r = await page.evaluate(({ lastName, intake }) => {"
      ],
      [
        "    const coord = { role: \"clinical_coordinator\", staffId: \"s-cc1\", name: \"Priya Raman\" };\n    const inPool = (j.chaseRowsFor(coord)",
        "    const inPool = (j.chaseRowsFor(intake)"
      ],
      [
        "  }, last);\n  expect(r.open).toBe(\"open\");\n  expect(r.inPool).toBe(true);",
        "  }, { lastName: last, intake });\n  expect(r.open).toBe(\"open\");\n  expect(r.inPool).toBe(true);\n  await as(page, \"s-cc1\", \"clinical_coordinator\");\n  const coordinatorOversight = await page.evaluate((id) => {\n    const { AdelanteEHR } = (window as unknown as W).__adelante;\n    return (AdelanteEHR.listReferrals() as { id: string }[]).some((ref) => ref.id === id);\n  }, r.id);\n  expect(coordinatorOversight).toBe(true);"
      ]
    ]
  }
};
export function withApprovedBrowserTriagePart3Oct31(path: string, priorSource: string): string {
  const source = withApprovedBrowserTriageOct30(path, priorSource);
  const pin = APPROVED[path as keyof typeof APPROVED];
  if (!pin) return source;
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  if (hash(source) !== pin.prior) throw new Error(`Browser triage Part 3 prior source changed: ${path}`);
  let updated = source;
  for (const [from, to] of pin.pairs) {
    if (updated.split(from).length !== 2) throw new Error(`Browser triage Part 3 anchor not exactly once: ${path}`);
    updated = updated.replace(from, () => to);
  }
  if (hash(updated) !== pin.updated) throw new Error(`Browser triage Part 3 replacement changed: ${path}`);
  return updated;
}
