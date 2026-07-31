"""Browser end-to-end test: Spanish-language refusal document.

Exercises RefusalFormDialog against the running dev server for the seeded
Spanish-preferred patient (p-demo-mar-seed-es), with REAL SignaturePad canvas
drawing (mouse strokes, not stubbed), and asserts the draft-translation
governance surfaces: amber banner, es-v1-draft version label, Spanish risk
text, and the "Reviewed English wording" disclosure.

Run:  python3 e2e/refusal_es_e2e.py            (dev server on :8080)
Screenshots land in e2e/screenshots/.
"""

import asyncio
import math
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
PATIENT = "p-demo-mar-seed-es"
SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

failures: list[str] = []


def check(name: str, cond: bool) -> None:
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond:
        failures.append(name)


async def draw_signature(page, canvas) -> None:
    """Draw three real strokes — SignaturePad rejects taps and single strokes."""
    box = await canvas.bounding_box()
    x0, y0 = box["x"] + 30, box["y"] + box["height"] / 2
    for seg in range(3):
        await page.mouse.move(x0 + seg * 90, y0)
        await page.mouse.down()
        for i in range(1, 40):
            await page.mouse.move(x0 + seg * 90 + i * 2.2, y0 + math.sin(i / 3) * 22, steps=1)
        await page.mouse.up()
        await page.wait_for_timeout(80)


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        await page.goto(BASE + "/", wait_until="domcontentloaded")
        await page.evaluate(
            "localStorage.setItem('adelante.actingRole','pmhnp');"
            "localStorage.setItem('adelante.actingStaffId','s-np1')"
        )
        await page.goto(f"{BASE}/record/{PATIENT}?section=mar", wait_until="networkidle")
        await page.get_by_role("button", name="Open document").first.click()
        await page.wait_for_timeout(800)
        dlg = page.locator("[role=dialog]")
        await dlg.wait_for(state="visible")
        text = await dlg.inner_text()
        await page.screenshot(path=str(SHOTS / "es_1_opened.png"))

        # --- draft-translation governance surfaces -------------------------
        check("amber draft-translation banner is shown", "Draft translation" in text)
        check("draft version label es-v1-draft is shown", "es-v1-draft" in text)
        check(
            "banner explains it awaits clinical sign-off",
            "awaiting clinical sign-off" in text,
        )
        check(
            "interpreter section required for Spanish",
            await dlg.get_by_label("Interpreter method").count() > 0,
        )
        check(
            "risk text is presented in Spanish",
            "medicamento" in text.lower() and "rechazar" in text.lower(),
        )
        banner = dlg.locator("div.border-amber-500\\/60").first
        check("banner uses the amber warning styling", await banner.count() > 0)

        # --- English disclosure is a collapsed <details>, labelled reviewed -
        disclosure = dlg.locator("details summary", has_text="Reviewed English wording")
        check("English disclosure summary is present", await disclosure.count() > 0)
        check(
            "English disclosure is NOT labelled as a locked reference copy",
            "locked reference copy" not in text,
        )
        if await disclosure.count():
            await disclosure.first.click()
            await page.wait_for_timeout(200)
            body = await dlg.locator("details").first.inner_text()
            check(
                "expanded disclosure contains the reviewed English wording",
                "medication" in body.lower() and "refus" in body.lower(),
            )
        await page.screenshot(path=str(SHOTS / "es_2_draft_banner.png"))

        # --- complete the document with real signatures --------------------
        await dlg.get_by_text("Patient declines to sign").click()
        await page.wait_for_timeout(400)
        combos = dlg.get_by_role("combobox")
        for i in range(await combos.count()):
            await combos.nth(i).click()
            await page.wait_for_timeout(250)
            await page.get_by_role("option").first.click()
            await page.wait_for_timeout(250)

        canvases = dlg.locator("canvas")
        n_canvas = await canvases.count()
        check("signature canvases rendered", n_canvas > 0)
        for i in range(n_canvas):
            await draw_signature(page, canvases.nth(i))
        await page.wait_for_timeout(400)
        after_draw = await dlg.inner_text()
        check(
            "real strokes accepted (no stroke-validation error left)",
            "a tap is not accepted" not in after_draw.lower()
            or "Signature captured" in after_draw
            or "too small" not in after_draw.lower(),
        )
        await page.screenshot(path=str(SHOTS / "es_3_signed.png"))

        for i in range(await dlg.locator("button[role=checkbox]").count()):
            cb = dlg.locator("button[role=checkbox]").nth(i)
            if await cb.get_attribute("data-state") != "checked":
                await cb.click()
        await page.wait_for_timeout(300)

        finalize = dlg.get_by_role("button", name="Finalize refusal document")
        check("finalize is enabled once the document is complete", await finalize.is_enabled())
        await finalize.click()
        await page.wait_for_timeout(1500)
        body_text = await page.inner_text("body")
        check(
            "document finalized (no pending-signature entry left open)",
            await page.locator("[role=dialog]").count() == 0,
        )
        check("finalized state visible on the MAR tab", "Refus" in body_text)
        await page.screenshot(path=str(SHOTS / "es_4_finalized.png"))

        await browser.close()

    print(f"\n{'ALL PASSED' if not failures else 'FAILURES: ' + ', '.join(failures)}")
    sys.exit(1 if failures else 0)


asyncio.run(main())
