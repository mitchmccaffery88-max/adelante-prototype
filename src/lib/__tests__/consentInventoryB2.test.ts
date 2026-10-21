// §B2-0 — consent inventory freeze. Pins every production file that reads the
// legacy consent flags or calls a consent-ledger / separate-store entry point,
// with its matching-line count, as recorded in docs/b2-consent-inventory.md.
// A new reader (or a removed one) fails here until the inventory is updated.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const LEGACY_FLAG = /sudCoordinationConsent|sudCounselingNotesRelease|consents\??\.(part2Sud|hipaa|signedAt)|consentState/;
const ENTRY_POINT =
  /isConsentCategoryAuthorized|activeConsentRecord|listConsentRecords|createConsentRecord|revokeConsentRecord|part2ConsentFor|getConsentState|\bsetConsent\(|staffSetConsent|patientWithdrawConsent|referrerAuthorizationFor|recordReferrerAuthorization|revokeReferrerAuthorization|groupConsentBlock|setGroupConsentGate|migrateLegacyConsents|signChecked|consentCovers/;

const LEGACY_FLAG_READERS: Record<string, number> = {
  "src/components/chart/CoordinatorSudPanel.tsx": 1,
  "src/components/clinical/recordSections.tsx": 1,
  "src/lib/adelBrief.ts": 1,
  "src/lib/asamReporting.ts": 1,
  "src/lib/consentForms.ts": 3,
  "src/lib/coordinatorSudAccess.ts": 2,
  "src/lib/ehr.ts": 16,
  "src/lib/onboarding.ts": 1,
  "src/routes/consent.tsx": 1,
  "src/routes/intake.tsx": 2,
};

const ENTRY_POINT_CALLERS: Record<string, number> = {
  "src/components/DemoStateSwitcher.tsx": 3,
  "src/components/PatientHome.tsx": 1,
  "src/components/PatientProfileDialog.tsx": 1,
  "src/components/chart/ChartTabView.tsx": 1,
  "src/components/consent/ConsentRecordsPanel.tsx": 3,
  "src/components/consent/FormsToSign.tsx": 2,
  "src/components/consent/PatientConsentStatusCard.tsx": 1,
  "src/components/consent/PoDisclosureCard.tsx": 1,
  "src/components/patient/ProfilePanels.tsx": 3,
  "src/components/reassessment/RescreenForm.tsx": 1,
  "src/components/referral/ReferrerAuthorizationCard.tsx": 4,
  "src/lib/ab133.ts": 2,
  "src/lib/adelBrief.ts": 2,
  "src/lib/adelBriefCheck.ts": 1,
  "src/lib/advocateInviteDelivery.ts": 2,
  "src/lib/billingLifecycleScenario.ts": 1,
  "src/lib/bookingFlow.ts": 3,
  "src/lib/carePartners.ts": 2,
  "src/lib/chartActions.ts": 4,
  "src/lib/chartOrders.ts": 1,
  "src/lib/consentAudit.ts": 1,
  "src/lib/consentForms.ts": 19,
  "src/lib/ehr.ts": 42,
  "src/lib/hie.ts": 4,
  "src/lib/identityDemoSeed.ts": 1,
  "src/lib/outpatientCare.ts": 4,
  "src/lib/part2Disclosure.ts": 6,
  "src/lib/patientBooking.ts": 1,
  "src/lib/poDisclosure.ts": 2,
  "src/lib/referrerAuthorizationStore.ts": 3,
  "src/lib/referrerUpdateGate.ts": 2,
  "src/lib/roles.ts": 1,
  "src/lib/scribe.ts": 5,
  "src/routes/consent.tsx": 1,
  "src/routes/intake.tsx": 1,
};

function productionFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || p === join("src", "test")) continue;
      productionFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith("routeTree.gen.ts")) {
      out.push(p.split("\\").join("/"));
    }
  }
  return out;
}

function countLines(re: RegExp): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of productionFiles("src")) {
    const n = readFileSync(f, "utf8").split("\n").filter((l) => re.test(l)).length;
    if (n) counts[f] = n;
  }
  return counts;
}

describe("B2-0 consent inventory freeze", () => {
  it("legacy consent flags are read only where the inventory lists them", () => {
    expect(countLines(LEGACY_FLAG)).toEqual(LEGACY_FLAG_READERS);
  });

  it("consent ledger and separate-store entry points are called only where the inventory lists them", () => {
    expect(countLines(ENTRY_POINT)).toEqual(ENTRY_POINT_CALLERS);
  });

  it("every pinned file appears in docs/b2-consent-inventory.md", () => {
    const doc = readFileSync("docs/b2-consent-inventory.md", "utf8");
    for (const f of new Set([...Object.keys(LEGACY_FLAG_READERS), ...Object.keys(ENTRY_POINT_CALLERS)])) {
      expect(doc.includes(f), f).toBe(true);
    }
  });
});
