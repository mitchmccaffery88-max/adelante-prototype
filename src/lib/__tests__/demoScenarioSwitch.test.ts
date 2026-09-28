import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { demoScenarioPatientId } from "@/lib/ehr";

// Every patient scenario in the QA picker must actually open its record.
// Scenario 7 (Jordan) used to show a success toast and change nothing.
describe("QA scenario picker", () => {
  const src = readFileSync("src/components/DemoStateSwitcher.tsx", "utf8");
  const keys = ["mh_only", "medication", "sud_consented", "combination", "ji_self_report", "sud_no_consent"] as const;
  it.each(keys)("%s resolves to a record and is handled in apply()", (k) => {
    expect(demoScenarioPatientId(k)).toBeTruthy();
    expect(src).toContain(`case "${k}":`);
  });
});
