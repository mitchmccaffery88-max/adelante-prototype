import { beforeEach, describe, expect, it } from "vitest";
import { _resetConsentForms, approveForm, editForm, listFormVersions, publishForm, publishedForm, submitForLegalReview } from "@/lib/consentForms";
import { runAction } from "@/lib/actions/runAction";
import { AdelanteEHR } from "@/lib/ehr";
const admin={role:"sys_admin" as const,name:"Admin"};
beforeEach(_resetConsentForms);
function ready(){const v=editForm("hipaa",{},admin);submitForLegalReview(v.id,admin);approveForm(v.id,admin);return v;}
describe("required consent-publication reason",()=>{
 it("rejects whitespace before mutating either version",()=>{const v=ready();expect(()=>publishForm(v.id,admin," ")).toThrow(/reason/);expect(publishedForm("hipaa")?.version).toBe(1);expect(listFormVersions("hipaa").find(x=>x.id===v.id)?.status).toBe("approved");});
 it("writes one lifecycle and one registry event with the saved reason",()=>{const v=ready();const before=AdelanteEHR.listAuditEvents({}).map(x=>x.id);const r=runAction("consent_form_publish",admin,undefined,{via:"publishForm",args:[v.id,admin," Reviewed — Draft "]});expect(r.ok).toBe(true);const events=AdelanteEHR.listAuditEvents({}).filter(x=>!before.includes(x.id));expect(events.filter(x=>x.action==="consent_form.published")).toHaveLength(1);expect(events.find(x=>x.action==="consent_form.published")?.detail?.reason).toBe("Reviewed — Draft");expect(events.filter(x=>x.action==="action.succeeded")).toHaveLength(1);});
 it("retains only-sys_admin publication and all ten real seed forms",()=>{const v=ready();expect(()=>publishForm(v.id,{role:"clinical_coordinator",name:"Cathy"},"Reviewed")).toThrow(/sys_admin/);expect(listFormVersions().filter(x=>x.status==="published")).toHaveLength(10);});
});
