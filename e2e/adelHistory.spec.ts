// Adel persistence — as Luis: chat, leave, come back and continue; share one
// chat; the care team sees only the summary; delete history. One page load;
// the chat endpoint is stubbed (Simulated — no model call).
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 120_000 });

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 10_000 });
}
const sse = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;

test("Luis: chat → leave → continue → share summary → delete history", async ({ page }) => {
  await page.route("**/api/adel-chat", (r) =>
    r.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: sse("A bus pass can help. Ask the front desk about one.") }),
  );
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as W).__adelante?.AdelanteEHR, null, { timeout: 60_000 });
  const luisId = await page.evaluate(() => {
    const ehr = (window as unknown as W).__adelante.AdelanteEHR as unknown as {
      listPatients: () => { id: string; firstName: string; lastName: string }[];
      setCurrentPatientId: (id: string) => void;
    };
    const p = ehr.listPatients().find((x) => x.firstName === "Luis" && x.lastName === "Camacho")!;
    ehr.setCurrentPatientId(p.id);
    return p.id;
  });

  const typed = "I need a bus pass to get to my appointment";
  await go(page, "/adel");
  await page.getByLabel("Message Adel").fill(typed);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("A bus pass can help.")).toBeVisible();
  await expect(page.getByTestId("adel-privacy-note")).toContainText("Your chats with Adel are private.");

  // leave, come back via Messages → Adel, continue
  await go(page, "/home");
  await go(page, "/peer?tab=adel");
  await expect(page.getByTestId("adel-history-row")).toHaveCount(1);
  await expect(page.getByTestId("adel-history-row")).toContainText("Getting to appointments");
  await page.getByTestId("adel-continue").click();
  await expect(page).toHaveURL(/\/adel\?thread=/);
  await expect(page.getByText(typed)).toBeVisible();
  await expect(page.getByText("A bus pass can help.")).toBeVisible();

  // a brand-new chat remembers the topic
  await go(page, "/adel");
  await expect(page.getByText(/you mentioned the bus pass — did that work out\?/)).toBeVisible();

  // share
  await go(page, "/peer?tab=adel");
  await page.getByTestId("adel-share").first().click();
  await page.getByTestId("adel-confirm").click();
  await expect(page.getByText("Summary sent to your care team")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/adel-history-shared.png" });

  // care team (Luz, ECM) sees the summary only
  await page.evaluate(() => (window as unknown as W).__adelante.setActingStaff("s-cm1", "ecm_provider"));
  await go(page, `/record/${luisId}?section=messages`);
  await expect(page.getByText(/Shared from Adel \(summary, Simulated\)/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(typed)).toHaveCount(0);
  await expect(page.getByText("A bus pass can help.")).toHaveCount(0);
  await page.screenshot({ path: "e2e/screenshots/adel-history-staff.png" });

  // back as Luis: delete all
  await go(page, "/peer?tab=adel");
  await page.getByTestId("adel-clear-all").click();
  await page.getByTestId("adel-confirm").click();
  await expect(page.getByTestId("adel-history-row")).toHaveCount(0);
  const stubs = await page.evaluate(() => (window as unknown as W).__adelante.AdelanteEHR.listAuditEvents({}) as unknown as { action: string; detail?: unknown }[]);
  expect(stubs.some((e) => e.action === "adel_history_cleared")).toBe(true);
  expect(JSON.stringify(stubs.filter((e) => e.action.startsWith("adel_")))).not.toContain(typed);
});
