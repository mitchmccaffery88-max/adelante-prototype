import { createHash } from "node:crypto";
import { withApprovedCredentialingOct27 } from "./credentialingOct27Approved";
// Mitch approved 30 Oct: only browser gate setup and projection counts.
const APPROVED = {
  "e2e/adelBrief.spec.ts": {
    "prior": "4cd82e19a3cc1f8976b1bb0f1c18d2bc9669ed176575467a2489948cf792f2d5",
    "updated": "f521359a87450deac7ab1a3d48f8aa7f8b41863d1b4526ede2685c50bf51df45",
    "pairs": [
      [
        "import { test, expect, type Page } from \"@playwright/test\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport { test, expect, type Page } from \"@playwright/test\";\n"
      ],
      [
        "  const btn = page.getByTestId(\"adel-brief-button\");",
        "  await openWithReason(page, \"covering_consult\");\n  const btn = page.getByTestId(\"adel-brief-button\");"
      ]
    ]
  },
  "e2e/adelHistory.spec.ts": {
    "prior": "bc7cbe4af742a91e0da0414c506917822a70a474490f2062d819e557786fa5f1",
    "updated": "ed4979019dfb8ca55f2f6f5cd2071567c48c7339876de5dde47380a0892219ce",
    "pairs": [
      [
        "import { expect, test, type Page } from \"@playwright/test\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport { expect, test, type Page } from \"@playwright/test\";\n"
      ],
      [
        "  await go(page, `/record/${luisId}?section=messages`);",
        "  await go(page, `/record/${luisId}?section=messages`);\n  await openWithReason(page, \"covering_consult\");"
      ]
    ]
  },
  "e2e/consentAuditB2.spec.ts": {
    "prior": "92636b0163ccb4da367bfcd6e37e7dd68a9a79e6e9aadbb466ca34951af24e5b",
    "updated": "186649034774d2cbf3aaf9c7daa2503b3eea2c5e31a9664dd1c232ad7b940b47",
    "pairs": [
      [
        "import AxeBuilder from \"@axe-core/playwright\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport AxeBuilder from \"@axe-core/playwright\";\n"
      ],
      [
        "  await go(page, `/record/${setup.pid}?section=consents`);",
        "  await go(page, `/record/${setup.pid}?section=consents`);\n  await openWithReason(page, \"scheduling_admin\");"
      ]
    ]
  },
  "e2e/consentCaptureB2.spec.ts": {
    "prior": "ad119e9f105f3320adc8db9b2ad64ac95f174965807e0be8c6ad0852e9af0fe2",
    "updated": "58aabc270df5af47e2d143ebc2f9761a4f05d2bdcefa8311b5321b8554c9c3ce",
    "pairs": [
      [
        "import AxeBuilder from \"@axe-core/playwright\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport AxeBuilder from \"@axe-core/playwright\";\n"
      ],
      [
        "  await go(page, `/record/${pid}?section=consents`);",
        "  await go(page, `/record/${pid}?section=consents`);\n  await openWithReason(page, \"scheduling_admin\");"
      ]
    ]
  },
  "e2e/consentLifecycleB2.spec.ts": {
    "prior": "d18893672e5f00e36a768bb690f023d3505de7d717b4c054e6d25ee6ae14f92f",
    "updated": "35c743c4a0ce649ab097e17c78e22b344c40ea456c47d7980143a058a7d17005",
    "pairs": [
      [
        "import AxeBuilder from \"@axe-core/playwright\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport AxeBuilder from \"@axe-core/playwright\";\n"
      ],
      [
        "  await go(page, `/record/${pid}?section=consents`);",
        "  await go(page, `/record/${pid}?section=consents`);\n  await openWithReason(page, \"scheduling_admin\");"
      ]
    ]
  },
  "e2e/crossRole.spec.ts": {
    "prior": "ed2fb32f5cd4f9cf960597d8f10a9269905959857efb49b67524ac3ad1b08a95",
    "updated": "1438bdfd509517c0bf5d23c08f1b1e29598fee67e8da0c809435e0871c7975f9",
    "pairs": [
      [
        "import { test, expect, type Page } from \"@playwright/test\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport { test, expect, type Page } from \"@playwright/test\";\n"
      ],
      [
        "  const t = page.getByRole(\"tab\", { name: tab }).first();",
        "  await openWithReason(page, \"covering_consult\");\n  const t = page.getByRole(\"tab\", { name: tab }).first();"
      ]
    ]
  },
  "e2e/group2Pathways.spec.ts": {
    "prior": "8a0350ae07865377ea991a23b8d2a85bd5658c3432741f38b66cd5d985e46ee6",
    "updated": "58306eb2034f58bbd5a65ca00c92913cd45bf0db50193f2a82ca8a97161a5d6f",
    "pairs": [
      [
        "import { expect, test, type Page } from \"@playwright/test\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport { expect, test, type Page } from \"@playwright/test\";\n"
      ],
      [
        "  await page.waitForURL((u) => u.pathname === to.split(\"?\")[0], { timeout: 15_000 });",
        "  await page.waitForURL((u) => u.pathname === to.split(\"?\")[0], { timeout: 15_000 });\n  if (to.startsWith(\"/record/\")) await openWithReason(page, \"covering_consult\");"
      ]
    ]
  },
  "e2e/quickActionsMenu.spec.ts": {
    "prior": "6e905efb1611853fffd413b5ad1d7f137652990b157906cf38f0962dab432c9d",
    "updated": "c98da2865d87177a10c4cafdeafb1c9cd07db85ad4545f8ba3e57cd3ba07d1a4",
    "pairs": [
      [
        "import AxeBuilder from \"@axe-core/playwright\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport AxeBuilder from \"@axe-core/playwright\";\n"
      ],
      [
        "  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), `/record/${patientId}`);",
        "  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), `/record/${patientId}`);\n  await openWithReason(page, \"scheduling_admin\");"
      ]
    ]
  },
  "e2e/staffShell8a1.spec.ts": {
    "prior": "65066739a0c9a3c19af9fc3ab6be6b27bf5b5b8fbd890cefd860e169db0f0749",
    "updated": "33e0ae03852b38430584b415ab94b24a11727b6635abfdd4965756d8f8511633",
    "pairs": [
      [
        "import { test, expect, type Page } from \"@playwright/test\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport { test, expect, type Page } from \"@playwright/test\";\n"
      ],
      [
        "    const slot = page.getByTestId(\"staff-new-slot\");",
        "    await openWithReason(page, \"scheduling_admin\");\n    const slot = page.getByTestId(\"staff-new-slot\");"
      ]
    ]
  },
  "e2e/access.spec.ts": {
    "prior": "b1a5cc7bd620bb9f7bfdecd6f3e6fff12582b36011c3c4ae6b66f61c49ca60c7",
    "updated": "fb840c26b552210f5f7fe34f8f06299d7b1b3883c2427b0437a2692636114d8c",
    "pairs": [
      [
        "import { expect, test, type Page } from \"@playwright/test\";\n",
        "import { openWithReason } from \"./helpers/openWithReason\";\nimport { expect, test, type Page } from \"@playwright/test\";\n"
      ],
      [
        "  await go(page, `/record/${ids.luis}`);",
        "  await go(page, `/record/${ids.luis}`);\n  await openWithReason(page, \"covering_consult\");"
      ]
    ]
  },
  "e2e/staffRosterCredentialTables8b2.spec.ts": {
    "prior": "b3180b36c3a2c1375de67f2dc27e98a2a2babd9456fadce945164b695a59e956",
    "updated": "1f3aaeb837ea5a1c04a2f64b974753171eefbdbba2adf5f97adf66a46160f379",
    "pairs": [
      [
        "  expect(ids).toHaveLength(23);",
        "  const rosterLength = await page.evaluate(async () => (await import(/* @vite-ignore */ \"/src/lib/roles.ts\")).STAFF_ROSTER.length);\n  expect(ids).toHaveLength(rosterLength);"
      ]
    ]
  },
  "e2e/staffTables8b1.spec.ts": {
    "prior": "344a66be4a89783a4e2e55eafd49cb6d740c5094e55605a7477303ef82321d10",
    "updated": "466378ea4343198be5824ea25e1a44fe9d5471b6fde9fe8c799b01684806c12f",
    "pairs": [
      [
        "    if (pilot.path === \"/notes-queue\") await expect(rows).toHaveCount(7);",
        "    if (pilot.path === \"/notes-queue\") {\n      const count = await page.evaluate(async () => {\n        const roles = await import(/* @vite-ignore */ \"/src/lib/roles.ts\");\n        const { listUnsignedWork } = await import(/* @vite-ignore */ \"/src/lib/unsignedWork.ts\");\n        return listUnsignedWork({ viewer: { role: roles.getActingRole(), staffId: roles.getActingStaff().id } }).length;\n      });\n      await expect(rows).toHaveCount(count);\n    }"
      ]
    ]
  }
};
export function withApprovedBrowserTriageOct30(path: string, priorSource: string): string {
 const source = withApprovedCredentialingOct27(path, priorSource);
 const pin = APPROVED[path as keyof typeof APPROVED];
 if (!pin) return source;
 const hash = (s: string) => createHash("sha256").update(s).digest("hex");
 if (hash(source) !== pin.prior) throw new Error(`Browser triage prior source changed: ${path}`);
 let updated = source;
 for (const [from, to] of pin.pairs) {
  if (updated.split(from).length !== 2) throw new Error(`Browser triage anchor not exactly once: ${path}`);
  updated = updated.replace(from, () => to);
 }
 if (hash(updated) !== pin.updated) throw new Error(`Browser triage replacement changed: ${path}`);
 return updated;
}
