// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { FormField } from "@/components/staff/form-field";
afterEach(cleanup);
function Field({attempted = false}: {attempted?: boolean}) { const [value,setValue]=useState(""); return <FormField reason required value={value} onChange={setValue} attempted={attempted}/>; }
describe("staff FormField", () => {
 it("waits until blur, links corrective guidance, then clears it", () => { render(<Field/>); const input=screen.getByRole("textbox"); expect(screen.queryByRole("alert")).toBeNull(); fireEvent.blur(input); expect(input.getAttribute("aria-invalid")).toBe("true"); expect(input.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id); fireEvent.change(input,{target:{value:"Reviewed"}}); expect(screen.queryByRole("alert")).toBeNull(); expect(input.getAttribute("aria-invalid")).toBe("false"); });
 it("labels the reason and uses gold/attention, never safety red", () => { render(<Field attempted/>); expect(screen.getByLabelText("Reason (saved to the audit log)")).toBeTruthy(); const alert=screen.getByRole("alert"); expect(alert.className).toContain("bg-gold"); expect(alert.className).toContain("border-attention"); expect(alert.className).not.toMatch(/urgent|destructive|red-/); });
 it("preserves a caller's accessible name and mouse/touch minimums", () => {render(<FormField reason accessibleName="Content change reason" value="" onChange={()=>{}}/>); const input=screen.getByRole("textbox",{name:"Content change reason"}); expect(input.className).toContain("min-h-9"); expect(input.className).toContain("min-h-12"); expect(input.className).toContain("border-line-strong");});
});
