/* eslint-disable @typescript-eslint/no-explicit-any */
// §C5 walkthrough — a content author creates a housing + first-30-days lesson
// with Spanish; it is clinical so it goes to review; Dr. Bagga approves.
// Marisol sees "Adel suggests" on Luis's care plan and assigns it. Luis sees
// it in My plan, in his housing need and in Adel chat (EN + ES), finishes it,
// and the assignment closes. Store calls are the real store functions.
import { expect, test, type Page } from "@playwright/test";

type W = Window & { __adelante: { AdelanteEHR: Record<string, (...a: unknown[]) => unknown>; setActingStaff: (id: string, r?: string) => void; go: (to: string) => void } };
test.describe.configure({ timeout: 150_000 });
const LESSON = "lib_e2e_housing_first_30";

async function go(page: Page, to: string) {
  await page.evaluate((t) => (window as unknown as W).__adelante.go(t), to);
  await page.waitForURL((u) => u.pathname === to.split("?")[0], { timeout: 15_000 });
}

test("published, tagged content flows into the care plan, needs and Adel chat", async ({ page }) => {
  await page.goto("/clinician");
  await page.waitForFunction(() => !!(window as unknown as { __adelante?: { content?: unknown } }).__adelante?.content, null, { timeout: 60_000 });

  const setup = await page.evaluate(async (id) => {
    const { cp, ct } = await (window as never as { __adelante: { content: () => Promise<never> } }).__adelante.content() as never as { cp: any; ct: any };
    const ehr = (window as unknown as W).__adelante.AdelanteEHR as never as {
      listPatients: () => { id: string; firstName: string; lastName: string }[];
      addSdohItem: (pid: string, i: unknown, a: unknown) => void;
    };
    const author = { staffId: "s-cc2", name: "Cathy", role: "clinical_coordinator" };
    const body = {
      ...ct.contentType("library_lesson").emptyBody(), id, categoryId: "back-on-feet", order: 99, minutes: 5,
      title: "Keeping Housing in the First 30 Days", problem: "Finding a steady place to stay.",
      learnTitle: "Three steps", learnBody: "Call the housing desk this week.", toolkitLabel: "Housing steps",
      es: { title: "Mantener vivienda los primeros 30 días" },
      meta: { sdoh: ["housing"], stages: ["first_30"], clinical: true, esStatus: "reviewed" },
    };
    const saved = cp.saveContentDraft({ typeId: "library_lesson", id, body, actor: author });
    const selfPublish = cp.publishContent({ typeId: "library_lesson", id, actor: author });
    const review = cp.submitContentForReview({ typeId: "library_lesson", id, actor: author });
    const approve = cp.publishContent({ typeId: "library_lesson", id, actor: { staffId: "s-np1", name: "Dr. M. Bagga", role: "physician" } });
    const luis = ehr.listPatients().find((p) => p.firstName === "Luis" && p.lastName === "Camacho")!;
    ehr.addSdohItem(luis.id, { need: "Housing", visibleToPatient: true }, { staffName: "Marisol Reyes", role: "therapist" });
    return { saved: saved.ok, selfPublish: selfPublish.ok, review: review.ok, approve: approve.ok, luisId: luis.id };
  }, LESSON);
  expect(setup).toMatchObject({ saved: true, selfPublish: false, review: true, approve: true });

  // Marisol: Luis's care plan shows "Adel suggests" with the lesson; she assigns it.
  await page.evaluate(() => (window as unknown as W).__adelante.setActingStaff("s-th1", "therapist"));
  await go(page, `/record/${setup.luisId}?section=care-plan`);
  const sugg = page.getByTestId("plan-suggestions");
  await expect(sugg).toContainText("Adel suggests");
  const row = sugg.locator(`[data-testid^="plan-suggestion-"]`).filter({ hasText: "Keeping Housing in the First 30 Days" }).first();
  await expect(row).toBeVisible();
  const goals = await page.locator('[data-testid^="plan-goal-"]').count();
  if (goals === 0) {
    await page.evaluate(async (pid) => {
      const { sc } = await (window as never as { __adelante: { content: () => Promise<any> } }).__adelante.content();
      sc.addStructuredGoal({ patientId: pid, clinicalText: "Stable housing", measure: "Housed 90 days", owner: "shared" as never, actor: { name: "Marisol Reyes", role: "therapist" } });
    }, setup.luisId);
  }
  await row.locator('[data-testid^="plan-suggestion-accept-"]').click();
  await page.screenshot({ path: "e2e/screenshots/content-careplan.png" });

  // Luis: My plan, his housing need, and Adel chat.
  await page.evaluate((id) => ((window as unknown as W).__adelante.AdelanteEHR as never as { setCurrentPatientId: (i: string) => void }).setCurrentPatientId(id), setup.luisId);
  await go(page, "/patient");
  await expect(page.getByTestId(`my-plan-activity-${LESSON}`)).toBeVisible({ timeout: 15_000 });
  await go(page, "/next-steps");
  await expect(page.getByTestId(`need-learn-more-${LESSON}`).first()).toBeVisible({ timeout: 15_000 });
  await go(page, "/adel");
  await expect(page.getByTestId("adel-content-suggestion")).toContainText("Keeping Housing in the First 30 Days");
  await page.getByRole("button", { name: "Cambiar idioma a español" }).click();
  await expect(page.getByTestId("adel-content-suggestion")).toContainText("Mantener vivienda los primeros 30 días");
  await page.screenshot({ path: "e2e/screenshots/content-adel-es.png" });
  await page.getByRole("button", { name: "Switch language to English" }).click();

  // Luis finishes the lesson → the assignment closes with a source.
  const closed = await page.evaluate(async ([pid, id]) => {
    const { eng, sc } = await (window as never as { __adelante: { content: () => Promise<any> } }).__adelante.content();
    eng.completeLibraryItem(pid, id);
    const a = sc.getStructuredPlan(pid).assignments.find((x: { activityId?: string }) => x.activityId === id);
    return { done: (a?.completions.length ?? 0) > 0, source: a?.completionSources?.[0]?.source };
  }, [setup.luisId, LESSON] as const);
  expect(closed).toEqual({ done: true, source: "lesson_finished" });
});
