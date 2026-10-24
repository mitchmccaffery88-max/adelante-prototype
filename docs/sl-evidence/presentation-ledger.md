# SL presentation-only before/after ledger
Rollback: 0eff6798065e7362df8141759a99463e06005c9c
All app hunks below are additive imports or label elements; no handlers/gates/existing text changed.

## src/components/NotificationBell.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/NotificationBell.tsx

+++ src/components/NotificationBell.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 // §Notification feed, Phase 1 — operational alerts only (staff-to-staff,
 // system-generated). In-app only: no email/SMS/push transport exists.
@@ -111,4 +112,5 @@

           </Button>
         </div>
+        <div className="px-3 py-2"><SimulatedBadge flag="notifications_simulated" lang={isMember ? lang : "en"} /></div>
         {!isMember && (
           <div className="flex gap-1 border-b px-2 py-1.5" role="group" aria-label="Notification filter">
```

## src/components/PatientHome.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/PatientHome.tsx

+++ src/components/PatientHome.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { StatusChip } from "@/components/ui/status-chip";
 import { FormsToSign } from "@/components/consent/FormsToSign";
@@ -477,4 +478,5 @@

       </div>
       <p className="mt-1 text-xs text-muted-foreground">{t("msgSubtitle")}</p>
+      <SimulatedBadge flag="notifications_simulated" lang={AdelanteEHR.getPatient(patientId)?.preferredLanguage === "es" ? "es" : "en"} />
       {/* §Peer messaging — one thread, honest sender identity. There is no
           second peer-only channel: the existing care-team thread already IS
```

## src/components/SimulatedBadge.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/SimulatedBadge.tsx

+++ src/components/SimulatedBadge.tsx

@@ -0,0 +1,45 @@

+import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel, type FeatureId } from "@/lib/features";
+
+// Explicit calls also keep the existing component-label inventory guard intact.
+const labels = {
+  hie_simulated: () => simulatedSurfaceLabel("hie_simulated"),
+  placeholder_lab: () => simulatedSurfaceLabel("placeholder_lab"),
+  cures_placeholder: () => simulatedSurfaceLabel("cures_placeholder"),
+  eligibility_simulated: () => simulatedSurfaceLabel("eligibility_simulated"),
+  erx_simulated: () => simulatedSurfaceLabel("erx_simulated"),
+  caloms_export_simulated: () => simulatedSurfaceLabel("caloms_export_simulated"),
+  notifications_simulated: () => simulatedSurfaceLabel("notifications_simulated"),
+  payments_simulated: () => simulatedSurfaceLabel("payments_simulated"),
+  voice_intake: () => simulatedSurfaceLabel("voice_intake"),
+  adel_drafts: () => simulatedSurfaceLabel("adel_drafts"),
+  telehealth_simulated: () => simulatedSurfaceLabel("telehealth_simulated"),
+  scribe_simulated: () => simulatedSurfaceLabel("scribe_simulated"),
+  llm_simulated: () => simulatedSurfaceLabel("llm_simulated"),
+  calendar_sync_simulated: () => simulatedSurfaceLabel("calendar_sync_simulated"),
+  consent_upload_simulated: () => simulatedSurfaceLabel("consent_upload_simulated"),
+};
+const spanish: Record<keyof typeof labels, string> = {
+  hie_simulated: "Simulado — sin conexión real al intercambio de información de salud",
+  placeholder_lab: "Simulado — no se envía a un laboratorio",
+  cures_placeholder: "Simulado — no se consulta CURES en vivo",
+  eligibility_simulated: "Simulado — no se verifica la elegibilidad en vivo",
+  erx_simulated: "Simulado — no se envía a una farmacia",
+  caloms_export_simulated: "Simulado — no se presenta nada al estado",
+  notifications_simulated: "Simulado — no se envía ningún mensaje externo",
+  payments_simulated: "Simulado — no se procesa ningún pago ni se transmite una reclamación",
+  voice_intake: "Simulado — no se guarda audio",
+  adel_drafts: "Simulado — borrador basado en reglas, no en inteligencia artificial",
+  telehealth_simulated: "Simulado — proveedor de video de prueba",
+  scribe_simulated: "Simulado — transcripción y borrador de prueba; no se guarda audio",
+  llm_simulated: "Simulado — resumen de plantilla, sin modelo de inteligencia artificial",
+  calendar_sync_simulated: "Simulado — nada sale de Adelante al sincronizar el calendario",
+  consent_upload_simulated: "Simulado — la copia en papel no se guarda en un sistema real de documentos",
+};
+
+/** Presentation only. Member shells own the single Spanish review notice. */
+export function SimulatedBadge({ flag, lang = "en" }: { flag: Exclude<FeatureId, "in_facility">; lang?: "en" | "es" }) {
+  return <Badge variant="outline" className="max-w-full whitespace-normal break-words text-sm font-normal" data-simulated-flag={flag}>
+    {lang === "es" ? spanish[flag] : labels[flag]()}
+  </Badge>;
+}
```

## src/components/__tests__/simulatedLabelsSL.test.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/__tests__/simulatedLabelsSL.test.tsx

+++ src/components/__tests__/simulatedLabelsSL.test.tsx

@@ -0,0 +1,87 @@

+// @vitest-environment jsdom
+import "@/test/freezeClock";
+import { afterEach, describe, expect, it } from "vitest";
+import { cleanup, fireEvent, render } from "@testing-library/react";
+import { SimulatedBadge } from "@/components/SimulatedBadge";
+import { EligibilityHistoryCard } from "@/components/coverage/EligibilityHistoryCard";
+import { VerificationSourceBadge } from "@/components/coverage/VerificationSourceBadge";
+import { FEATURE_FLAGS } from "@/lib/features";
+import { CHART_ACTIONS } from "@/lib/chartActions";
+import { runAction } from "@/lib/actions/runAction";
+import { AdelanteEHR, type CoverageVerificationRecord } from "@/lib/ehr";
+import { STAFF_ROLES, setActingStaff } from "@/lib/roles";
+import { hieAudit } from "@/lib/hie";
+import { adelDraftAudit } from "@/lib/adelDrafts";
+import { getAdelBrief, adelSummary } from "@/lib/adelBrief";
+
+afterEach(cleanup);
+const flags = ["hie_simulated", "voice_intake", "adel_drafts", "placeholder_lab", "cures_placeholder", "eligibility_simulated", "erx_simulated", "telehealth_simulated", "caloms_export_simulated", "notifications_simulated", "payments_simulated", "scribe_simulated", "llm_simulated", "calendar_sync_simulated", "consent_upload_simulated"] as const;
+function patient() {
+  const p = AdelanteEHR.listPatients()[0];
+  if (!p) throw new Error("Missing demo patient");
+  return p;
+}
+describe("SL all 15 simulated flags: rendered bilingual label and audit contract", () => {
+  it("covers the exact simulated registry, excluding outpatient switch", () => {
+    expect(FEATURE_FLAGS.filter(f => f.simulated).map(f => f.id).sort()).toEqual([...flags].sort());
+    expect(FEATURE_FLAGS.find(f => f.id === "in_facility")?.simulated).toBe(false);
+  });
+  for (const flag of flags) {
+    it(`${flag}: renders English and Spanish integration context`, () => {
+      const en = render(<SimulatedBadge flag={flag} />);
+      expect(en.container.querySelector(`[data-simulated-flag="${flag}"]`)?.textContent).toMatch(/^Simulated/);
+      en.unmount();
+      const es = render(<SimulatedBadge flag={flag} lang="es" />);
+      expect(es.container.querySelector(`[data-simulated-flag="${flag}"]`)?.textContent).toMatch(/^Simulado/);
+    });
+    it(`${flag}: every tied registry action writes exactly one simulated action audit`, () => {
+      const p = patient();
+      for (const action of CHART_ACTIONS.filter(a => a.flags?.includes(flag))) {
+        const role = STAFF_ROLES.find(r => action.allowed({ role: r.key, staffId: "s-admin1" }, p).state !== "hidden")?.key;
+        if (!role) throw new Error(`No permitted actor for ${action.id}`);
+        // Isolate registry transport, not clinical store correctness (tested separately).
+        const stores = action.store;
+        action.store = [{ name: "sl_audit_transport", fn: () => ({ ok: true }) }];
+        try {
+          const before = AdelanteEHR.listAuditEvents({ category: "action" }).length;
+          const result = runAction(action.id, { role, staffId: "s-admin1" }, p);
+          expect(result.ok, action.id).toBe(true);
+          expect(result.event.detail?.simulated, action.id).toBe(true);
+          expect(result.event.detail?.outcome, action.id).not.toBe("succeeded");
+          expect(AdelanteEHR.listAuditEvents({ category: "action" }).length).toBe(before + 1);
+        } finally { action.store = stores; }
+      }
+      // Surface-only flags do not invent actions/audits; private browser voice has no audit sink.
+      if (flag === "voice_intake") expect(CHART_ACTIONS.filter(a => a.flags?.includes(flag))).toHaveLength(0);
+    });
+  }
+});
+describe("SL real integration paths, no invented verification", () => {
+  it("electronic click shows disconnected result and simulated audits but creates no verification", () => {
+    setActingStaff("s-bill1", "billing");
+    const p = patient();
+    const before = JSON.stringify(p.coverage?.verifications ?? []);
+    const actionCount = AdelanteEHR.listAuditEvents({ category: "action" }).length;
+    const ui = render(<EligibilityHistoryCard patientId={p.id} canCheck onRecordManual={() => {}} />);
+    fireEvent.click(ui.getByTestId("check-electronically"));
+    expect(ui.getByTestId("eligibility-not-connected").textContent).toContain("Electronic eligibility isn't connected yet");
+    expect(JSON.stringify(p.coverage?.verifications ?? [])).toBe(before);
+    expect(AdelanteEHR.listAuditEvents({ category: "action" }).length).toBe(actionCount + 1);
+    const audits = AdelanteEHR.listAuditEvents({ patientId: p.id });
+    expect(audits.find(e => e.action === "eligibility_check_attempted")?.detail?.simulated).toBe(true);
+    expect(audits.find(e => e.detail?.actionId === "eligibility_check")?.detail?.simulated).toBe(true);
+  });
+  it("real staff-reported verification does not receive an integration label", () => {
+    const ui = render(<VerificationSourceBadge record={{ channel: "phone_county", checkedAt: "2026-10-24", checkedBy: "Staff", result: "verified" } as CoverageVerificationRecord} />);
+    expect(ui.container.querySelector("[data-simulated-flag]")).toBeNull();
+  });
+  it("HIE and rule-based draft real audit helpers retain simulated metadata", () => {
+    const p = patient();
+    hieAudit("sl_hie_review", p.id, { name: "SL reviewer", role: "sys_admin" }, {});
+    adelDraftAudit("progress_note", "drafted", p.id, { name: "SL reviewer", role: "sys_admin" });
+    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).find(e => e.action === "sl_hie_review")?.detail?.simulated).toBe(true);
+    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).find(e => e.action === "adel_draft_drafted")?.detail?.simulated).toBe(true);
+    adelSummary(getAdelBrief(p, "physician"), { role: "physician", staffId: "s-np1" });
+    expect(AdelanteEHR.listAuditEvents({ patientId: p.id }).find(e => e.action === "adel_summary_generated")?.detail?.simulated).toBe(true);
+  });
+});
```

## src/components/billing/PatientBalance.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/billing/PatientBalance.tsx

+++ src/components/billing/PatientBalance.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { billingClaimInput, billingArrangement } from "@/lib/billingProjection";
 import { Button } from "@/components/ui/button";
@@ -30,4 +31,5 @@

   return (
     <div className="font-sans space-y-0.5 text-[10px]" data-testid="patient-balance">
+      <SimulatedBadge flag="payments_simulated" />
       {claim.arrangementMissing && (
         <div
@@ -129,4 +131,5 @@

       <PopoverContent className="w-72 space-y-2 text-xs">
         <p className="font-medium">Record a payment received</p>
+        <SimulatedBadge flag="payments_simulated" />
         <p className="text-muted-foreground">Balance {DOLLARS(claim.patientBalanceCents)}. No card processing here.</p>
         <label className="block">
```

## src/components/chart/AdelDrafts.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/chart/AdelDrafts.tsx

+++ src/components/chart/AdelDrafts.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { StatusChip } from "@/components/ui/status-chip";
 import { isPrescriberRole } from "@/lib/roles";
@@ -177,4 +178,5 @@

       {confirmation.dialog}
       <p className="font-medium text-navy">{refill.medicationName}</p>
+      <SimulatedBadge flag="erx_simulated" />
       <StatusChip lang="en" state={refill.status === "approved" || refill.status === "sent_to_pharmacy" ? "done" : refill.status === "denied" ? "closed" : refill.status === "needs_appointment" || isPrescriberRole(role) ? "yourturn" : "team"} label={refill.status === "approved" || refill.status === "sent_to_pharmacy" ? "Sent to pharmacy" : refill.status === "denied" ? `Not refilled${refill.denyReason ? ` — ${refill.denyReason}` : ""}` : refill.status === "needs_appointment" ? "Book a visit first" : "Pending"} />
       <AdelDraftLabel />
@@ -236,4 +238,5 @@

     <div className="space-y-2 rounded-lg border border-gold/50 p-3" data-testid="adel-outreach-panel">
       <AdelDraftLabel />
+      <SimulatedBadge flag="notifications_simulated" lang={lang} />
       <p className="text-xs text-muted-foreground">
         {OUTREACH_REASON_LABEL[reason]} · plain language, no clinical or substance use details.
```

## src/components/chart/ChartTabView.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/chart/ChartTabView.tsx

+++ src/components/chart/ChartTabView.tsx

@@ -21,4 +21,5 @@

 import type { RecordSection } from "@/components/clinical/recordSections";
 import { Card } from "@/components/ui/card";
+import { SimulatedBadge } from "@/components/SimulatedBadge";
 
 export function tabsWithSections(sections: RecordSection[], role?: StaffRole) {
@@ -252,4 +253,7 @@

               </button>
             )}
+            {(s.id === "outside-records" || s.id === "med-recon") && <SimulatedBadge flag="hie_simulated" />}
+            {s.id === "orders" && <SimulatedBadge flag="erx_simulated" />}
+            {s.id === "labs" && <SimulatedBadge flag="placeholder_lab" />}
             {isOpen && <div className={`chart-pane px-4 pb-4 ${single ? "pt-4" : ""}`}>{s.render()}</div>}
           </Card>
```

## src/components/chart/LabsAndMeasures.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/chart/LabsAndMeasures.tsx

+++ src/components/chart/LabsAndMeasures.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { StatusChip } from "@/components/ui/status-chip";
 // §Chart redesign turn 2 — lab orders, screener requests and metabolic
@@ -71,4 +72,5 @@

     <div className="space-y-3" data-testid="lab-order-form">
       <Badge variant="outline" className="text-xs">{LAB_PLACEHOLDER_LABEL}</Badge>
+      <SimulatedBadge flag="placeholder_lab" />
       <div className="space-y-1">
         <Label htmlFor="lab-test">Test</Label>
@@ -221,4 +223,5 @@

         <div className="flex flex-wrap items-center gap-2">
           <h4 className="flex-1 text-sm font-medium text-navy">Labs</h4>
+          <SimulatedBadge flag="placeholder_lab" />
           <Badge variant="outline" className="text-[10px]">{LAB_PLACEHOLDER_LABEL}</Badge>
         </div>
```

## src/components/clinical/NoteOrdersSection.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/clinical/NoteOrdersSection.tsx

+++ src/components/clinical/NoteOrdersSection.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { CircleAlert } from "lucide-react";
 // §Clinical documentation Phase 3b — orders_section renderer.
@@ -141,4 +142,5 @@

       <div>
         <h5 className="font-display text-sm text-navy">{section.title}</h5>
+        <SimulatedBadge flag="erx_simulated" />
         <p className="text-[11px] text-muted-foreground">
           Orders placed here follow the same validation, lifecycle and attestation as the Orders
```

## src/components/clinical/OrderSafetyPanel.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/clinical/OrderSafetyPanel.tsx

+++ src/components/clinical/OrderSafetyPanel.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { CircleAlert } from "lucide-react";
 // §B1/B2 — allergy cross-check, NKDA prompt and the CURES/PDMP step on a
@@ -91,4 +92,5 @@

           </div>
           <p className="rounded bg-muted px-2 py-1 text-muted-foreground">{CURES_PLACEHOLDER_LABEL}</p>
+          <SimulatedBadge flag="cures_placeholder" />
           {order.curesCheck ? (
             <p>
```

## src/components/clinical/OrdersTab.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/clinical/OrdersTab.tsx

+++ src/components/clinical/OrdersTab.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { CircleAlert } from "lucide-react";
 import { StatusChip } from "@/components/ui/status-chip";
@@ -804,4 +805,5 @@

   return (
     <div className="space-y-4">
+      <SimulatedBadge flag="erx_simulated" />
       {!viewOnly && (
         <Card className="p-4">
```

## src/components/clinical/RefillCuresStep.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/clinical/RefillCuresStep.tsx

+++ src/components/clinical/RefillCuresStep.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { CircleAlert } from "lucide-react";
 // §Refill safety — CURES step on a controlled (DEA II–V) refill. The store
@@ -29,4 +30,5 @@

       </div>
       <p className="rounded bg-muted px-2 py-1 text-muted-foreground">{CURES_PLACEHOLDER_LABEL}</p>
+      <SimulatedBadge flag="cures_placeholder" />
       {c ? (
         <p>
```

## src/components/coverage/EligibilityHistoryCard.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/coverage/EligibilityHistoryCard.tsx

+++ src/components/coverage/EligibilityHistoryCard.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 // §Phase 8c — the chart's eligibility history with a source badge on every
 // record, plus the honest "Check electronically" control.
@@ -27,4 +28,5 @@

       <div className="flex flex-wrap items-center justify-between gap-2">
         <div className="text-xs font-medium uppercase text-muted-foreground">Eligibility history</div>
+        {canCheck && <SimulatedBadge flag="eligibility_simulated" />}
         {canCheck && (
           <Button
```

## src/components/coverage/VerificationSourceBadge.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/coverage/VerificationSourceBadge.tsx

+++ src/components/coverage/VerificationSourceBadge.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { Badge } from "@/components/ui/badge";
 import type { CoverageVerificationRecord } from "@/lib/ehr";
@@ -11,7 +12,10 @@

 export function VerificationSourceBadge({ record }: { record: CoverageVerificationRecord }) {
   return (
+    <>
+    {record.electronic && <SimulatedBadge flag="eligibility_simulated" />}
     <Badge className={`text-[10px] font-normal ${TONE[verificationKind(record)]}`} data-testid="verification-source">
       {verificationSourceLabel(record)}
     </Badge>
+    </>
   );
 }
```

## src/components/messages/StaffMessagesTab.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/messages/StaffMessagesTab.tsx

+++ src/components/messages/StaffMessagesTab.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { CircleAlert } from "lucide-react";
 // §Messaging Phase 2 — staff side of the patient's care-team thread.
@@ -61,4 +62,5 @@

   return (
     <div className="space-y-3">
+      <SimulatedBadge flag="notifications_simulated" />
       <p className="text-xs text-muted-foreground">
         One ongoing thread with this patient. Patient messages are shown verbatim — never
```

## src/components/ops/OpsActionLauncher.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/ops/OpsActionLauncher.tsx

+++ src/components/ops/OpsActionLauncher.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { billingClaims, billingPatients, billingAudience, billingOpsWorkspace, billingClaimBlock } from "@/lib/billingProjection";
 import { StaffNewTrigger } from "@/components/StaffDensity";
@@ -254,4 +255,5 @@

   return (
     <div className="space-y-3" data-testid="ops-status-form">
+      <SimulatedBadge flag="payments_simulated" />
       <p className="text-sm">Now: {claim.state === "denied" ? <Badge variant="outline">{claim.state}</Badge> : <StatusChip lang="en" state={claim.state === "documented" ? "upnext" : claim.state === "submitted" ? "team" : claim.state === "paid" ? "done" : claim.state === "written_off" ? "closed" : canWrite ? "yourturn" : "team"} label={claim.state === "documented" ? "Documented" : claim.state === "signed" || claim.state === "coded" || claim.state === "generated" ? "Ready to send" : claim.state === "submitted" ? "With payer" : claim.state === "partial" ? "Partly paid — review" : claim.state} />}</p>
       <Label>Move to</Label>
@@ -270,4 +272,5 @@

   return (
     <div className="space-y-3">
+      <SimulatedBadge flag="payments_simulated" />
       <Label htmlFor="ops-amt">Amount ($)</Label><Input id="ops-amt" value={amount} onChange={(e) => setAmount(e.target.value)} />
       <Label htmlFor="ops-on">Received on</Label><Input id="ops-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
@@ -295,4 +298,5 @@

   return (
     <div className="space-y-2">
+      <SimulatedBadge flag="eligibility_simulated" />
       <Button data-testid="ops-run-eligibility" onClick={() => {
         const r = runAction<{ detail: string }>("eligibility_check", currentRunActor(), AdelanteEHR.getPatient(patientId), { args: [patientId] });
@@ -321,4 +325,5 @@

   return (
     <div className="flex flex-wrap gap-2">
+      <SimulatedBadge flag="caloms_export_simulated" />
       <Button variant="outline" onClick={() => { try { download(`isl-${day}.csv`, actFor<string>("isl_export", "exportIslReport", undefined)); toast.success("Simulated — ISL file downloaded (not submitted)"); } catch (e) { toast.error((e as Error).message); } }}>ISL export (CSV)</Button>
       <Button variant="outline" onClick={() => { try { download(`claims-${day}.csv`, actFor<string>("claims_export", "exportClaimsCsv", undefined)); toast.success("Claims file downloaded"); } catch (e) { toast.error((e as Error).message); } }}>Claims export (CSV)</Button>
@@ -332,4 +337,5 @@

   return (
     <ul className="divide-y rounded-md border text-sm">
+      <li className="p-2"><SimulatedBadge flag="notifications_simulated" /></li>
       {today.failedNotifications.map((n) => (
         <li key={n.notificationId} className="flex items-center justify-between p-2">
```

## src/components/ops/OpsWorkspace.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/ops/OpsWorkspace.tsx

+++ src/components/ops/OpsWorkspace.tsx

@@ -15,4 +15,5 @@

 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 import { countyReminders } from "@/lib/countyReporting";
 
@@ -57,4 +58,5 @@

   return (
     <section className="space-y-3" data-testid="billing-workspace">
+      <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("payments_simulated")}</Badge>
       <div className="flex gap-2 overflow-x-auto [&>button]:shrink-0" data-testid="billing-today-strip">
         <StripCount testId="strip-blocked" label="Claims blocked" n={ws.blocked.length} onClick={() => set("action", true)} />
```

## src/components/patient/AppointmentsSummary.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/patient/AppointmentsSummary.tsx

+++ src/components/patient/AppointmentsSummary.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 // §P1 My Care de-clutter — one cohesive appointments view.
 //
@@ -137,4 +138,5 @@

           <Video className="mr-1.5 h-4 w-4" /> {t("opensAt")} {new Date(+new Date(appt.start) - 15 * 60_000).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit" })}
         </Button>
+        {!real && <SimulatedBadge flag="telehealth_simulated" lang={lang} />}
       </span>
     );
@@ -145,5 +147,5 @@

         <Video className="mr-1.5 h-4 w-4" /> {real ? sc.join : `${sc.join} (${simulatedSurfaceLabel("telehealth_simulated")})`}
       </a>
-    </Button></span>
+    </Button>{!real && <SimulatedBadge flag="telehealth_simulated" lang={lang} />}</span>
   );
 }
```

## src/components/patient/MyMedicationsCard.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/patient/MyMedicationsCard.tsx

+++ src/components/patient/MyMedicationsCard.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { StatusChip } from "@/components/ui/status-chip";
 // §P1 My Care de-clutter — the real "My medications" list, moved off My Care.
@@ -183,4 +184,5 @@

       <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-teal">
         <Pill className="h-4 w-4" /> {SCREEN_COPY["ui.6deaed92d12f"][screenLang]} </div>
+      <SimulatedBadge flag="erx_simulated" lang={screenLang} />
       <p className="mt-1 text-xs text-muted-foreground">
         {SCREEN_COPY["ui.7f3e9658d048"][screenLang]} </p>
```

## src/components/voice/AdelVoice.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/voice/AdelVoice.tsx

+++ src/components/voice/AdelVoice.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 // §E5 Phase A — reusable voice UI: opt-in card, controls + transcript, voice answer.
 import { simulatedSurfaceLabel } from "@/lib/features";
@@ -58,4 +59,5 @@

     <div className="rounded-lg border border-teal/40 bg-card p-3 space-y-2" data-testid="voice-bar" aria-label={SCREEN_COPY["ui.562107b866b5"][screenLang]}>
       <p className="text-[11px] text-muted-foreground" data-testid="voice-simulated">{simulatedSurfaceLabel("voice_intake")}</p>
+      {lang === "es" && <SimulatedBadge flag="voice_intake" lang="es" />}
       <div className="flex flex-wrap items-center gap-2">
         <Button size="sm" variant="outline" onClick={() => speak(text, { force: true })} aria-label={c.play}><Play className="h-4 w-4" aria-hidden="true" /><span className="ml-1 hidden sm:inline">{c.play}</span></Button>
```

## src/components/voice/LessonReadAloud.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/components/voice/LessonReadAloud.tsx

+++ src/components/voice/LessonReadAloud.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { useEffect } from "react";
 import { Volume2, Square, RotateCcw } from "lucide-react";
@@ -17,4 +18,5 @@

   return <div className="lesson-voice space-y-2" aria-label={t("playerVoice")}>
     <p className="text-sm text-foreground">{t("playerVoice")}{lang === "es" ? ` · ${t("playerDraft")}` : ""}</p>
+    <SimulatedBadge flag="voice_intake" lang={lang} />
     <div className="flex flex-wrap items-center gap-2">
       <Button variant="outline" className="min-h-11 rounded-full" onClick={() => { voice.setEnabled(true); voice.speak(text, { force: true }); }} aria-label={t("playerListen")}><Volume2 className="mr-2 size-4" />{t("playerListen")}</Button>
```

## src/lib/features.ts
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/lib/features.ts

+++ src/lib/features.ts

@@ -243,4 +243,13 @@

  */
 export const SIMULATED_SURFACE_LABELS: Partial<Record<FeatureId, string>> = {
+  hie_simulated: `${SIMULATED_LABEL} — no live HIE connection`,
+  placeholder_lab: `${SIMULATED_LABEL} — not sent to a lab`,
+  cures_placeholder: `${SIMULATED_LABEL} — no live CURES query`,
+  eligibility_simulated: `${SIMULATED_LABEL} — no live eligibility check`,
+  erx_simulated: `${SIMULATED_LABEL} — not sent to a pharmacy`,
+  caloms_export_simulated: `${SIMULATED_LABEL} — nothing submitted to the state`,
+  notifications_simulated: `${SIMULATED_LABEL} — no external message is actually sent`,
+  payments_simulated: `${SIMULATED_LABEL} — no payment processed or claim transmitted`,
+  consent_upload_simulated: `${SIMULATED_LABEL} — paper copy is not stored in a real document system`,
   voice_intake: `${SIMULATED_LABEL} speech recognition — no audio is stored`,
   adel_drafts: `${SIMULATED_LABEL} — rule-based draft, not AI`,
```

## src/routes/admin-claims.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/admin-claims.tsx

+++ src/routes/admin-claims.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { billingClaims, billingPatients, billingBlockedAttempts, billingAudience, billingDocumentationBlock, type BillingClaim } from "@/lib/billingProjection";
 import { staffPatientLabel } from "@/lib/staffPatientLabel";
@@ -322,4 +323,5 @@

         <div>
           <h1 className="font-display text-2xl text-navy">Claims worklist</h1>
+          <SimulatedBadge flag="payments_simulated" />
           <p className="text-sm text-muted-foreground">Every encounter's billing lifecycle.</p>
         </div>
```

## src/routes/admin-vendors.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/admin-vendors.tsx

+++ src/routes/admin-vendors.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { StaffTable } from "@/components/staff/StaffTable";
 import { StatusChip } from "@/components/ui/status-chip";
@@ -58,4 +59,6 @@

       },
       { property: "og:title", content: "Vendor status — Adelante Admin" },
+      { property: "og:type", content: "website" },
+      { name: "twitter:card", content: "summary" },
       {
         property: "og:description",
@@ -105,4 +108,6 @@

       </Link>
       <h1 className="font-display text-2xl text-navy">Vendor status</h1>
+      <SimulatedBadge flag="erx_simulated" />
+      <SimulatedBadge flag="telehealth_simulated" />
       <VoiceGuardrailNotice />
       <p className="text-sm text-muted-foreground">
```

## src/routes/admin.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/admin.tsx

+++ src/routes/admin.tsx

@@ -19,4 +19,5 @@

 import { Card } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 import { Button } from "@/components/ui/button";
 import {
@@ -559,4 +560,5 @@

           immediately.
         </p>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("notifications_simulated")}</Badge>
         <Button
           size="sm"
@@ -633,4 +635,6 @@

           <ShieldCheck className="h-4 w-4 shrink-0 text-teal" /> Integrated vendors
         </h3>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("telehealth_simulated")}</Badge>
         <div className="flex flex-wrap items-center gap-2">
           <Link to="/disclosure-log" className="text-[11px] text-teal underline underline-offset-2" data-testid="admin-disclosure-log-link">Disclosure &amp; access log</Link>{" "}
```

## src/routes/billing.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/billing.tsx

+++ src/routes/billing.tsx

@@ -4,4 +4,6 @@

 import { StaffTable } from "@/components/staff/StaffTable";
 import { StatusChip } from "@/components/ui/status-chip";
+import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 const tableCopy = { claims: "Claims worklist", isl: "ISL encounters", credentials: "Credentialing" };
 import { useConfirmDialog } from "@/components/staff/use-confirm-dialog";
@@ -275,4 +277,6 @@

         <div className="min-w-0">
           <h1 className="font-display text-2xl text-navy">Billing coordinator</h1>
+          <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("payments_simulated")}</Badge>
+          <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("caloms_export_simulated")}</Badge>
           <p className="text-sm text-muted-foreground">
             Tulare County pilot · 7 funding lanes tracked separately from billing status.
```

## src/routes/clinician.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/clinician.tsx

+++ src/routes/clinician.tsx

@@ -19,4 +19,5 @@

 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
+import { simulatedSurfaceLabel } from "@/lib/features";
 import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
 import { Textarea } from "@/components/ui/textarea";
@@ -772,4 +773,5 @@

                 <Video className="h-4 w-4 mr-1.5" /> {(t as (k: string) => string)("clinJoin")}
               </Button>
+              <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("telehealth_simulated")}</Badge>
               {(() => {
                 const s = AdelanteEHR.getTelehealthSession(a.id);
@@ -1157,4 +1159,5 @@

           <Video className="h-4 w-4" aria-hidden="true" /> Refill requests
         </h3>
+        <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>
         <p className="mt-2 text-xs text-muted-foreground">
           {effectiveScope === "mine"
@@ -1170,4 +1173,5 @@

     <Card className="p-5" data-testid="refill-card">
       <h3 className="font-display text-base text-navy">Refill requests</h3>
+      <Badge variant="outline" className="max-w-full whitespace-normal text-sm">{simulatedSurfaceLabel("erx_simulated")}</Badge>
       {scopeToggle}
       <ul className="mt-3 space-y-3 text-sm">
```

## src/routes/county-reporting.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/county-reporting.tsx

+++ src/routes/county-reporting.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { StatusChip } from "@/components/ui/status-chip";
 import { STAFF_ROLES } from "@/lib/roles";
@@ -116,4 +117,5 @@

           <StatusChip lang="en" state="simulated" label={COUNTY_PROTOTYPE_LABEL} />
           <Badge variant="outline">{COUNTY_SIMULATED_LABEL}</Badge>
+          <SimulatedBadge flag="caloms_export_simulated" />
           <Badge variant="outline">Layouts and rules: {COUNTY_DRAFT_LABEL}</Badge>
           <Badge variant="outline" data-testid="county-preparer">
```

## src/routes/group-sessions.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/group-sessions.tsx

+++ src/routes/group-sessions.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { useConfirmDialog } from "@/components/staff/use-confirm-dialog";
 import { confirmedAction } from "@/components/staff/confirmed-action";
@@ -498,4 +499,5 @@

       <Card className="p-4 space-y-3">
         <h3 className="font-display text-sm text-navy">Standing roster</h3>
+        <SimulatedBadge flag="notifications_simulated" />
         {roster.length === 0 && (
           <p className="text-xs text-muted-foreground">Nobody enrolled yet.</p>
```

## src/routes/my-work.tsx
```diff
--- 0eff6798065e7362df8141759a99463e06005c9c:src/routes/my-work.tsx

+++ src/routes/my-work.tsx

@@ -1,2 +1,3 @@

+import { SimulatedBadge } from "@/components/SimulatedBadge";
 import { PageNewLauncher } from "@/components/staff/PageNewLauncher";
 import { StatusChip } from "@/components/ui/status-chip";
@@ -337,4 +338,5 @@

       {pendingLabRows.length > 0 && (
         <section aria-labelledby="labs-pending-heading" className="space-y-3" data-testid="my-work-labs-pending">
+          <SimulatedBadge flag="placeholder_lab" />
           <SectionHeading
             id="labs-pending-heading"
@@ -418,4 +420,5 @@

       {isPrescriberRole(actor.role) && (
         <section aria-labelledby="refill-heading" className="space-y-3" data-testid="my-work-refills">
+          <SimulatedBadge flag="erx_simulated" />
           <SectionHeading
             id="refill-heading"
```
