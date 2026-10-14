import { StatusChip } from "@/components/ui/status-chip";
// §v3.0 Phase 4 expansion — the advocate's expanded surface.
//
// Every panel here is rendered ONLY when the live store gate says the
// permission is held; nothing is hidden with CSS and nothing is fetched
// "just in case". 42 CFR Part 2 content is masked in the data layer
// (`AdelanteEHR.advocate*`), not here — this file cannot un-mask it.
import { verifiedLabel } from "@/lib/coverageStatus";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AdelanteEHR, useEhr, RESOURCE_REFERRAL_OUTCOME_LABEL } from "@/lib/ehr";
import type { AdvocateContributionSection } from "@/lib/ehr";
import { ADVOCATE_TIER_LABEL, advocateTier } from "@/lib/advocate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ClientDate } from "@/components/ClientDate";
import { HeartHandshake, ClipboardList, IdCard, Stethoscope, Lock, FileText, Info, Download, Bell } from "lucide-react";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { downloadDocumentPayload } from "@/components/documents/PatientDocumentsCard";
import { useI18n } from "@/lib/i18n";
/** Ordinary screen copy — Spanish draft pending translation review. */
const SCREEN_COPY = {
  "ui.e88bb6736a67": {
    "en": "Housing, food & transport",
    "es": "Vivienda, comida y transporte"
  },
  "ui.be16edfd1602": {
    "en": "Nothing being coordinated right now.",
    "es": "No hay nada en coordinación por ahora."
  },
  "ui.3a7d9767b123": {
    "en": "item",
    "es": "elemento"
  },
  "ui.14b71a6c50bc": {
    "en": "Raise a need",
    "es": "Reportar una necesidad"
  },
  "ui.a0da38b3fb71": {
    "en": "e.g. needs a ride to Thursday's appointment",
    "es": "ej. necesita transporte para la cita del jueves"
  },
  "ui.9bc2575c3930": {
    "en": "Send",
    "es": "Enviar"
  },
  "ui.4e71b81ca85b": {
    "en": "Coming-home plan",
    "es": "Plan de regreso a casa"
  },
  "ui.a29a60c68de9": {
    "en": "The care team writes this plan. You can add comments and requests — they'll see them alongside it.",
    "es": "El equipo de atención redacta este plan. Puedes agregar comentarios y solicitudes; ellos los verán junto con el plan."
  },
  "ui.0ebae7e975e3": {
    "en": "Housing",
    "es": "Vivienda"
  },
  "ui.674c3c2c213d": {
    "en": "Appointments arranged",
    "es": "Citas programadas"
  },
  "ui.2f6c536bc27e": {
    "en": "Pharmacy",
    "es": "Farmacia"
  },
  "ui.a6c830b66120": {
    "en": "Equipment needs",
    "es": "Necesidades de equipo"
  },
  "ui.28cbeaad4e01": {
    "en": "No plan has been started yet.",
    "es": "Aún no se ha iniciado ningún plan."
  },
  "ui.18e3d55167ae": {
    "en": "Add your input",
    "es": "Agregar tus comentarios"
  },
  "ui.62d49a2a25e7": {
    "en": "Send to care team",
    "es": "Enviar al equipo de atención"
  },
  "ui.64554eb178f2": {
    "en": "Medi-Cal application",
    "es": "Solicitud de Medi-Cal"
  },
  "ui.11dc9e195292": {
    "en": "Status:",
    "es": "Estado:"
  },
  "ui.e8124936896b": {
    "en": "No coverage record yet.",
    "es": "Aún no hay registro de cobertura."
  },
  "ui.0a3951aa7f2f": {
    "en": "Type your name to confirm you're helping with this application",
    "es": "Escribe tu nombre para confirmar que estás ayudando con esta solicitud"
  },
  "ui.941cc89dfaaf": {
    "en": "Attest",
    "es": "Atestiguar"
  },
  "ui.1050a31a1d1c": {
    "en": "Placeholder:",
    "es": "Espacio reservado:"
  },
  "ui.2f185fbcbc51": {
    "en": "this records your attestation only. No application is submitted from here — the submission path and DHCS form content are not defined yet.",
    "es": "esto solo registra tu declaración. No se envía ninguna solicitud desde aquí; todavía no se ha definido el proceso de envío ni el contenido del formulario de DHCS."
  },
  "ui.b815bddc8d65": {
    "en": "Care plan",
    "es": "Plan de atención"
  },
  "ui.4530221f46ae": {
    "en": "Shown because your authorization includes decision-making authority.",
    "es": "Se muestra porque tu autorización incluye autoridad para tomar decisiones."
  },
  "ui.02e02eeb894e": {
    "en": "Your own care",
    "es": "Tu propia atención"
  },
  "ui.569ee51c2751": {
    "en": "You have your own record with us, kept completely separate from the person you support.",
    "es": "Tienes tu propio registro con nosotros, mantenido de forma totalmente separada de la persona a la que apoyas."
  },
  "ui.f0f792071724": {
    "en": "Go to my care",
    "es": "Ir a mi atención"
  },
  "ui.8ad446e5a3d3": {
    "en": "Would you like support for yourself too?",
    "es": "¿Te gustaría recibir apoyo para ti también?"
  },
  "ui.c983f309ddcc": {
    "en": "Supporting someone is hard. If you'd like care of your own — mental health, medication support, or substance-use help — we can open a record for you here, with the same sign-in. It stays completely separate from the person you're supporting: your own care team, your own plan, and nothing shared between the two.",
    "es": "Cuidar a alguien es difícil. Si quieres atención para ti (salud mental, apoyo con medicamentos o ayuda con el uso de sustancias), podemos abrirte un registro aquí con el mismo inicio de sesión. Se mantiene separado de la persona a la que apoyas: tu propio equipo, tu propio plan y nada se comparte entre ambos."
  },
  "ui.7e568a90221d": {
    "en": "First name",
    "es": "Nombre"
  },
  "ui.adec36a821f8": {
    "en": "Last name",
    "es": "Apellido"
  },
  "ui.5bb22a741c1f": {
    "en": "Start my intake",
    "es": "Comenzar mi ingreso"
  },
  "ui.ff02ee406b6f": {
    "en": "Yes, support for me too",
    "es": "Sí, yo también quiero apoyo"
  },
  "ui.e45714907316": {
    "en": "Not now",
    "es": "En otro momento"
  },
  "ui.687c82861c95": {
    "en": "Documents",
    "es": "Documentos"
  },
  "ui.4317925d5c54": {
    "en": "Send paperwork on their behalf, and see what has been sent. A care team member reviews everything before it enters the medical record.",
    "es": "Envía documentación en su nombre y mira lo que se ha enviado. El equipo de atención revisa todo antes de que entre al expediente médico."
  }
} as const;


export function AdvocateTierBadge({ linkId }: { linkId: string }) {
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  if (!link?.authorizationType) return null;
  return <Badge variant="secondary">{ADVOCATE_TIER_LABEL[advocateTier(link.authorizationType)]}</Badge>;
}

export function AdvocateCoordinationPanel({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const view = useEhr(() => AdelanteEHR.advocateCoordination(linkId));
  const { t } = useI18n();
  const [need, setNeed] = useState("");
  if (!view.allowed) return null;

  function add() {
    const res = AdelanteEHR.advocateAddCoordinationNeed(linkId, { need });
    if (!res.ok) return toast.error(res.reason);
    setNeed("");
    toast.success("Shared with the care team.");
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <HeartHandshake className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.e88bb6736a67"][screenLang]} </h2>
      {view.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{SCREEN_COPY["ui.be16edfd1602"][screenLang]}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {view.items.map((i) => (
            <li key={i.id} className="rounded-lg border p-3 text-sm">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-navy">{i.need}</span>
                <StatusChip state={i.status === "completed" ? "done" : i.status === "not_completed" ? "yourturn" : i.status === "scheduled" ? "upnext" : "team"} label={i.status.replace(/_/g, " ")} />
              </span>
              {i.note && <span className="mt-1 block text-xs text-muted-foreground">{i.note}</span>}
              {/* §5d-4 — the referrals made for this need, within this
                  advocate's authority. A restricted row names nothing. */}
              {i.referrals.length > 0 && (
                <span className="mt-2 block space-y-1">
                  {i.referrals.map((r) => (
                    <span key={r.id} className="block text-xs text-muted-foreground">
                      {r.restricted ? (
                        <span className="inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> {t("needAdvRestricted")}
                        </span>
                      ) : (
                        <>
                          {r.provider} — {RESOURCE_REFERRAL_OUTCOME_LABEL[r.status]}
                        </>
                      )}
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>

      )}
      {view.maskedCount > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> {view.maskedCount} {SCREEN_COPY["ui.3a7d9767b123"][screenLang]} {view.maskedCount === 1 ? " is" : "s are"} protected and not shown to advocates.
        </p>
      )}
      {view.canWrite && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="adv-need">{SCREEN_COPY["ui.14b71a6c50bc"][screenLang]}</Label>
          <div className="flex gap-2">
            <Input
              id="adv-need"
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              placeholder={SCREEN_COPY["ui.a0da38b3fb71"][screenLang]}
            />
            <Button onClick={add}>{SCREEN_COPY["ui.9bc2575c3930"][screenLang]}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const SECTIONS: { key: AdvocateContributionSection; label: string }[] = [
  { key: "housing", label: "Housing" },
  { key: "appointments", label: "Appointments" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "dme", label: "Equipment" },
  { key: "general", label: "General" },
];

export function AdvocateCarePlanParticipationPanel({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const view = useEhr(() => AdelanteEHR.advocateCarePlanParticipation(linkId));
  const [section, setSection] = useState<AdvocateContributionSection>("general");
  const [text, setText] = useState("");
  if (!view.allowed) return null;

  function send() {
    const res = AdelanteEHR.advocateAddCarePlanComment(linkId, { section, text });
    if (!res.ok) return toast.error(res.reason);
    setText("");
    toast.success(res.reason);
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <ClipboardList className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.4e71b81ca85b"][screenLang]} </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {SCREEN_COPY["ui.a29a60c68de9"][screenLang]} </p>
      {view.plan ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{SCREEN_COPY["ui.0ebae7e975e3"][screenLang]}</dt>
            <dd className="font-medium text-navy">{view.plan.housing.arrangement || "—"}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{SCREEN_COPY["ui.674c3c2c213d"][screenLang]}</dt>
            <dd className="font-medium text-navy">{view.plan.appointmentCount}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{SCREEN_COPY["ui.2f6c536bc27e"][screenLang]}</dt>
            <dd className="font-medium text-navy">{view.plan.pharmacyName ?? "—"}</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{SCREEN_COPY["ui.a6c830b66120"][screenLang]}</dt>
            <dd className="font-medium text-navy">
              {view.plan.dmeNeeds.length ? view.plan.dmeNeeds.join(", ") : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{SCREEN_COPY["ui.28cbeaad4e01"][screenLang]}</p>
      )}

      {view.contributions.length > 0 && (
        <ul className="mt-4 space-y-2">
          {view.contributions.map((c) => (
            <li key={c.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
              <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="uppercase tracking-wide">{c.section}</span>
                <ClientDate value={c.createdAt} />
              </span>
              <span className="mt-1 block">{c.text}</span>
            </li>
          ))}
        </ul>
      )}

      {view.canWrite && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="adv-comment">{SCREEN_COPY["ui.18e3d55167ae"][screenLang]}</Label>
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={section === s.key ? "default" : "outline"}
                onClick={() => setSection(s.key)}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <Textarea id="adv-comment" value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          <Button onClick={send}>{SCREEN_COPY["ui.62d49a2a25e7"][screenLang]}</Button>
        </div>
      )}
    </Card>
  );
}

export function AdvocateEligibilityPanel({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const view = useEhr(() => AdelanteEHR.advocateEligibilityAssist(linkId));
  const [name, setName] = useState("");
  if (!view.allowed) return null;

  function attest() {
    const res = AdelanteEHR.advocateAttestEligibilityAssist(linkId, { attestedName: name });
    if (!res.ok) return toast.error(res.reason);
    setName("");
    toast.success(res.reason);
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <IdCard className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.64554eb178f2"][screenLang]} </h2>
      {view.coverage ? (
        <p className="mt-3 text-sm">
          {SCREEN_COPY["ui.11dc9e195292"][screenLang]} <span className="font-medium text-navy">{view.coverage.status}</span> ·{" "}
          {verifiedLabel(view.coverage.verified as never)}
          {view.coverage.countyOfRelease ? ` · ${view.coverage.countyOfRelease} County` : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{SCREEN_COPY["ui.e8124936896b"][screenLang]}</p>
      )}
      {view.canAct && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="adv-attest-elig">
            {SCREEN_COPY["ui.0a3951aa7f2f"][screenLang]} </Label>
          <div className="flex gap-2">
            <Input id="adv-attest-elig" value={name} onChange={(e) => setName(e.target.value)} />
            <Button onClick={attest}>{SCREEN_COPY["ui.941cc89dfaaf"][screenLang]}</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>{SCREEN_COPY["ui.1050a31a1d1c"][screenLang]}</strong> {SCREEN_COPY["ui.2f185fbcbc51"][screenLang]} </p>
        </div>
      )}
    </Card>
  );
}

export function AdvocateClinicalPanel({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const view = useEhr(() => AdelanteEHR.advocateCarePlanClinical(linkId));
  if (!view.allowed) return null;
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 font-display text-lg text-navy">
        <Stethoscope className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.b815bddc8d65"][screenLang]} </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {SCREEN_COPY["ui.4530221f46ae"][screenLang]} </p>
      {view.summary && <p className="mt-3 text-sm">{view.summary}</p>}
      {view.focusAreas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {view.focusAreas.map((f) => (
            <Badge key={f.key} variant="outline">
              {f.label}
              {f.severity ? ` · ${f.severity}` : ""}
            </Badge>
          ))}
        </div>
      )}
      {view.activeGoals.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          {view.activeGoals.map((g) => (
            <li key={g.id}>{g.text}</li>
          ))}
        </ul>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Substance-use treatment information is protected under 42
        CFR Part 2 and is never shown here, whatever your authorization.
      </p>
    </Card>
  );
}

// §Advocate Access Redesign Phase 3 — the standalone "Self-help progress"
// panel/destination was removed as redundant. The underlying DTO
// (`AdelanteEHR.advocateLibraryProgress`) is untouched and will be rendered
// INLINE inside the advocate Library once that content ships (Phase 5),
// matching the patient Library's per-category progress pattern.

/**
 * "Would you like support for yourself too?" — one identity, two hats.
 * Accepting creates the advocate's OWN patient record and hands off to the
 * standard intake flow. It is a separate record with separate care; nothing
 * about the person they support is carried across.
 */
export function AdvocateSelfCareCard({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  // Router navigation, not `window.location`: a hard reload drops the
  // in-memory store, which made switching between the advocated-for view and
  // the advocate's own care impossible to exercise (or test) end to end.
  const navigate = useNavigate();
  const link = useEhr(() => AdelanteEHR.getAdvocateLink(linkId));
  const self = useEhr(() => AdelanteEHR.advocateSelfPatient(linkId));
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  if (!link) return null;

  if (self) {
    return (
      <Card className="space-y-2 p-5 text-sm">
        <h2 className="font-display text-lg text-navy">{SCREEN_COPY["ui.02e02eeb894e"][screenLang]}</h2>
        <p className="text-muted-foreground">
          {SCREEN_COPY["ui.569ee51c2751"][screenLang]} </p>
        <Button
          onClick={() => {
            AdelanteEHR.setCurrentPatientId(self.id);
            void navigate({ to: "/intake" });
          }}
        >
          {SCREEN_COPY["ui.f0f792071724"][screenLang]} </Button>
      </Card>
    );
  }

  if (link.selfCareOfferDeclinedAt && !open) return null;

  return (
    <Card className="space-y-3 p-5 text-sm">
      <h2 className="font-display text-lg text-navy">{SCREEN_COPY["ui.8ad446e5a3d3"][screenLang]}</h2>
      <p className="text-muted-foreground">
        {SCREEN_COPY["ui.c983f309ddcc"][screenLang]} </p>
      {open ? (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="self-first">{SCREEN_COPY["ui.7e568a90221d"][screenLang]}</Label>
              <Input id="self-first" value={first} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="self-last">{SCREEN_COPY["ui.adec36a821f8"][screenLang]}</Label>
              <Input id="self-last" value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => {
              try {
                const p = AdelanteEHR.startAdvocateSelfCare(linkId, {
                  firstName: first,
                  lastName: last,
                });
                AdelanteEHR.setCurrentPatientId(p.id);
                toast.success("Your own record is ready.");
                void navigate({ to: "/intake" });
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not start.");
              }
            }}
          >
            {SCREEN_COPY["ui.5bb22a741c1f"][screenLang]} </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={() => setOpen(true)}>{SCREEN_COPY["ui.ff02ee406b6f"][screenLang]}</Button>
          <Button variant="ghost" onClick={() => AdelanteEHR.declineAdvocateSelfCare(linkId)}>
            {SCREEN_COPY["ui.e45714907316"][screenLang]} </Button>
        </div>
      )}
    </Card>
  );
}


/**
 * §v3.0 Phase 5 — advocate documents. Upload and review for the linked
 * patient, both tiers, on the advocate's EXISTING claimed link.
 *
 * A Part 2-classified document is RESTRICTED, not hidden: the row stays, and
 * the missing piece is named explicitly. The gate itself lives in the data
 * layer and is Phase 4's `advocate_sud_disclosure` consent check reused
 * verbatim — this component cannot un-restrict anything.
 */
export function AdvocateDocumentsPanel({ linkId }: { linkId: string }) {
  const { lang: screenLang } = useI18n();

  const { t } = useI18n();
  const view = useEhr(() => AdelanteEHR.advocateDocuments(linkId));
  const notices = useEhr(() => AdelanteEHR.advocateDocumentNotifications(linkId));
  if (!view.allowed) return null;

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg text-navy">
          <FileText className="h-5 w-5 text-teal" /> {SCREEN_COPY["ui.687c82861c95"][screenLang]} </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {SCREEN_COPY["ui.4317925d5c54"][screenLang]} </p>
      </div>

      {view.canUpload && (
        <DocumentUploadForm
          part2Prompt="This document comes from a substance-use treatment program"
          onSubmit={(input) => {
            const res = AdelanteEHR.advocateUploadDocument(linkId, {
              file: input.file,
              isPart2: input.isPart2,
              ...(input.docType ? { docType: input.docType } : {}),
              ...(input.note ? { note: input.note } : {}),
            });
            if (!res.ok) return toast.error(res.reason);
            toast.success(res.reason);
          }}
        />
      )}

      {notices.length > 0 && (
        <div className="rounded-lg border p-3 text-sm" data-testid="advocate-doc-notices">
          <p className="flex items-center gap-2 font-medium text-navy">
            <Bell className="h-4 w-4 text-teal" /> {t("docNotificationsTitle")}
          </p>
          <ul className="mt-2 space-y-1">
            {notices.map((n) => (
              <li key={n.id} className="text-xs text-muted-foreground">
                <ClientDate value={n.at} /> · {t("docVerifiedNotice")}
                {n.channel === "sms" ? ` · ${t("docNotificationSimulated")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {view.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("docNoneYet")}</p>
      ) : (
        <ul className="space-y-2">
          {view.items.map((d) => (
            <li key={d.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <span className="font-medium text-navy">{d.fileName}</span>
                  <span className="block text-xs text-muted-foreground">
                    <ClientDate value={d.uploadedAt} /> · {d.uploaderLabel}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {d.restricted && (
                    <StatusChip state="restricted" label={t("docRestricted")} />
                  )}
                  <StatusChip state={d.verification === "verified" ? "done" : d.verification === "rejected" ? "yourturn" : "team"} label={d.verification === "verified" ? t("docStatusVerified") : d.verification === "rejected" ? t("docStatusRejected") : t("docStatusPending")} />
                  {/* The button is offered even for a restricted row: refusing
                      at the SHARED gate (and saying why) is the honest
                      behaviour, and hiding it would be a second, silent rule. */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const res = AdelanteEHR.requestDocumentDownload({
                        documentId: d.id,
                        viewer: { kind: "advocate", linkId },
                      });
                      if (!res.ok) return toast.error(res.reason);
                      downloadDocumentPayload(res);
                    }}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> {t("docDownload")}
                  </Button>
                </span>
              </div>
              {d.restricted && (
                <p className="mt-2 flex gap-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {d.restrictionMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
