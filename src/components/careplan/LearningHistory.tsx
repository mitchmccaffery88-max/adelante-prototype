import { useActingStaff } from "@/lib/roles";
import { useEhr } from "@/lib/ehr";
import { staffLearningHistory } from "@/lib/contentAnalytics";
import { ClientDate } from "@/components/ClientDate";
export function LearningHistory({ patientId }: { patientId: string }) {
  const { role } = useActingStaff(); const rows = useEhr(() => staffLearningHistory(patientId, role));
  return <section data-testid="learning-history"><h3 className="font-semibold">Lessons &amp; practice</h3>{rows.length ? <ul className="mt-2 divide-y divide-border">{rows.map((r, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{r.title}</span><span><ClientDate value={r.at} /> · {r.completed ? "Complete" : "In progress"} · {r.publishedRev ? `Revision ${r.publishedRev}` : "Legacy revision not recorded"}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No lessons shown.</p>}</section>;
}
