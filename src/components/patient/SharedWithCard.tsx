// §Batch C1 — patient-facing "Who my information was shared with".
// Recipient, date and purpose only. No staff names; emergency shows only as
// "shared in an emergency". Spanish is DRAFT pending bilingual review.
import { useEhr } from "@/lib/ehr";
import { useI18n } from "@/lib/i18n";
import { patientSharedList } from "@/lib/part2Disclosure";
import { Card } from "@/components/ui/card";

const COPY = {
  en: {
    title: "Who my information was shared with",
    empty: "Your substance-use records haven't been shared with anyone outside your care team.",
    emergency: "Shared in an emergency",
    draft: "",
  },
  es: {
    title: "Con quién se compartió mi información",
    empty: "Sus registros de uso de sustancias no se han compartido con nadie fuera de su equipo de atención.",
    emergency: "Compartido en una emergencia",
    draft: "Borrador — traducción pendiente de revisión bilingüe",
  },
} as const;

export function SharedWithCard({ patientId }: { patientId: string }) {
  const { lang } = useI18n();
  const c = COPY[lang === "es" ? "es" : "en"];
  const rows = JSON.parse(useEhr(() => JSON.stringify(patientSharedList(patientId)))) as ReturnType<typeof patientSharedList>;
  return (
    <Card className="p-5" data-testid="shared-with-card">
      <h2 className="font-display text-lg text-navy">{c.title}</h2>
      {c.draft && <p className="text-[11px] text-muted-foreground">{c.draft}</p>}
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-border/60 pb-2 last:border-0">
              <div className="font-medium">{r.recipient}</div>
              <div className="text-muted-foreground">
                {new Date(r.at).toLocaleDateString(lang === "es" ? "es-US" : "en-US")} · {r.purpose}
                {r.emergency ? ` · ${c.emergency}` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
