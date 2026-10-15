// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { readFileSync } from "node:fs";
import { ConfirmDialog } from "@/components/staff/confirm-dialog";
import { runAction } from "@/lib/actions/runAction";
import { AdelanteEHR } from "@/lib/ehr";
import { getContentEntry, saveContentDraft, seedPublishedContent } from "@/lib/contentPublishing";
const actor={role:"clinical_coordinator" as const,staffId:"s-cc2",name:"Cathy"};
afterEach(cleanup);
describe("8c-1 adapters",()=>{
 it("has no browser prompt or confirm in CMS/calendar/publication hosts",()=>{for(const file of ["src/components/admin/ContentAdminWorkspace.tsx","src/components/admin/ConsentFormLibrary.tsx","src/routes/location-calendars.tsx","src/routes/team-calendar.tsx","src/routes/my-calendar.tsx","src/routes/clinician-availability.tsx","src/components/calendar/CalendarSyncCard.tsx"]){expect(readFileSync(file,"utf8")).not.toMatch(/window\.(prompt|confirm)\s*\(/);}});
 it("executes a real Cathy discard once with one registry event and no cancel audit",async()=>{const id="8c1-discard-unit";saveContentDraft({typeId:"library_lesson",id,body:{id,title:"Draft"},actor,note:"Draft fixture"});const before=AdelanteEHR.listAuditEvents({}).map(x=>x.id);function Host(){const[open,setOpen]=useState(true);return <ConfirmDialog open={open} onOpenChange={setOpen} title="Discard this draft?" description="History is removed; nobody is notified." confirmLabel="Discard draft" keepLabel="Keep draft" requireReason onConfirm={note=>runAction("content_discard",{role:actor.role,staffId:actor.staffId},undefined,{args:[{typeId:"library_lesson",id,actor,note}]}).ok}/>;}render(<Host/>);fireEvent.click(screen.getByRole("button",{name:"Keep draft"}));expect(AdelanteEHR.listAuditEvents({}).filter(x=>!before.includes(x.id))).toHaveLength(0);cleanup();render(<Host/>);fireEvent.change(screen.getByRole("textbox"),{target:{value:"Duplicate draft"}});fireEvent.click(screen.getByRole("button",{name:"Discard draft"}));await waitFor(()=>expect(getContentEntry("library_lesson",id)).toBeUndefined());expect(AdelanteEHR.listAuditEvents({}).filter(x=>!before.includes(x.id)&&x.action==="action.succeeded")).toHaveLength(1);});
 it("keeps withdraw lifecycle provenance and neutral Part 2 audit text",()=>{const id="8c1-protected-unit";seedPublishedContent({typeId:"recovery_lesson",id,body:{id,title:"Protected"},actor,atISO:"2026-10-01T00:00:00Z"});const before=AdelanteEHR.listAuditEvents({}).map(x=>x.id);const r=runAction("content_withdraw",{role:actor.role,staffId:actor.staffId},undefined,{args:[{typeId:"recovery_lesson",id,actor,note:"Private rationale"}]});expect(r.ok).toBe(true);const events=AdelanteEHR.listAuditEvents({}).filter(x=>!before.includes(x.id));expect(events.filter(x=>x.action==="content.retired")).toHaveLength(1);expect(events.find(x=>x.action==="content.retired")?.detail?.reason).not.toContain("Private rationale");expect(getContentEntry("recovery_lesson",id)?.revisions.at(-1)?.note).toBe("Private rationale");});
});
