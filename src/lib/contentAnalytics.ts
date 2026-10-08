import { curriculumProgress } from "./curriculumProgress";
import { AdelanteEHR } from "./ehr";
import { getEngagement } from "./engagement";
import { contentPlanUsage, contentVisibleToStaff } from "./contentStaff";
import { getContentEntry, type ContentTypeId } from "./contentPublishing";
import { liveLibraryItem, liveRecoveryLesson, liveExercise, liveRecoveryLessons } from "./contentCatalog";
import { liveCurricula } from "./curriculumTypes";
import type { StaffRole } from "./roles";
const suppress = (n: number) => n < 11 ? null : n;
const median = (values: number[]) => { const v = [...values].sort((a, b) => a - b); const i = Math.floor(v.length / 2); return v.length ? v.length % 2 ? v[i] ?? 0 : ((v[i - 1] ?? 0) + (v[i] ?? 0)) / 2 : null; };
export function contentMetrics(type: ContentTypeId, id: string, role: StaffRole, from?: string, to?: string) {
  const entry = getContentEntry(type, id);
  const baseline = type === "recovery_lesson" ? liveRecoveryLesson(id) : type === "exercise" ? liveExercise(id) : type === "library_lesson" ? liveLibraryItem(id) : undefined;
  if (!contentVisibleToStaff(role, type, entry?.body ?? baseline as unknown as Record<string, unknown> ?? {})) return undefined;
  const surface = type === "recovery_lesson" ? "recovery" : type === "exercise" ? "exercise" : "library";
  const key = `${surface}:${id}`;
  const inPeriod = (date?: string) => !!date && (!from || date >= from) && (!to || date.slice(0, 10) <= to);
  const rows = AdelanteEHR.listPatients().flatMap((p) => { const e = getEngagement(p.id); return e ? [e] : []; });
  if (type === "journey") {
    const j = liveCurricula().find((j) => j.id === id); if (!j) return undefined;
    const keys = j.steps.flatMap((s) => s.type === "recovery_module" ? liveRecoveryLessons().filter((l) => l.moduleId === s.id).map((l) => `recovery:${l.id}`) : [`${s.type === "exercise" ? "exercise" : s.type === "library_lesson" ? "library" : "recovery"}:${s.id}`]);
    const started = AdelanteEHR.listPatients().filter((p) => { const e = getEngagement(p.id); const dates = keys.flatMap((k) => [e?.lessonResponses[k]?.startedAt ?? e?.lessonResponses[k]?.updatedAt, e?.completedAt?.[k]]).filter((d): d is string => !!d).sort(); return inPeriod(dates[0]); });
    const finished = started.filter((p) => { const e = getEngagement(p.id); const dates = keys.map((k) => e?.completedAt?.[k]).filter((d): d is string => !!d).sort(); return curriculumProgress(p.id, j).complete && inPeriod(dates.at(-1)); });
    const changes = started.flatMap((p) => { const e = getEngagement(p.id); const pairs = keys.flatMap((k) => { const r = e?.lessonResponses[k]; return Object.keys(r?.ratingsBefore ?? {}).flatMap((dimension) => typeof r?.ratingsBefore?.[dimension] === "number" && typeof r.ratingsAfter?.[dimension] === "number" ? [r.ratingsAfter[dimension]! - r.ratingsBefore[dimension]!] : []); }); return pairs.length ? [pairs.reduce((sum, n) => sum + n, 0) / pairs.length] : []; });
    return { starts: suppress(started.length), completions: suppress(finished.length), rate: started.length >= 11 && finished.length >= 11 && started.length - finished.length >= 11 ? Math.round(finished.length / started.length * 100) : null, dropoff: j.steps.map((_, step) => ({ step, count: suppress(started.filter((p) => curriculumProgress(p.id, j).next?.id === j.steps[step]?.id).length) })), medianChange: changes.length >= 11 ? median(changes) : null, planUsage: suppress(contentPlanUsage(id)) };
  }
  const started = rows.filter((r) => inPeriod(r.lessonResponses[key]?.startedAt ?? r.lessonResponses[key]?.updatedAt ?? r.completedAt?.[key]));
  const finished = started.filter((r) => inPeriod(r.completedAt?.[key]));
  const drops = new Map<number, number>(); const changes: number[] = [];
  for (const r of started) { const response = r.lessonResponses[key]; if (!r.completedAt?.[key]) { const step = response?.stepIndex ?? 0; drops.set(step, (drops.get(step) ?? 0) + 1); } if (response) { const before = response.ratingsBefore, after = response.ratingsAfter; const pairs = Object.keys(before ?? {}).filter((k) => typeof before?.[k] === "number" && typeof after?.[k] === "number"); if (pairs.length) changes.push(pairs.reduce((n, k) => n + Number(after?.[k]) - Number(before?.[k]), 0) / pairs.length); } }
  return { starts: suppress(started.length), completions: suppress(finished.length), rate: started.length >= 11 && finished.length >= 11 && started.length - finished.length >= 11 ? Math.round(finished.length / started.length * 100) : null, dropoff: [...drops].map(([step, n]) => ({ step, count: suppress(n) })), medianChange: changes.length >= 11 ? median(changes) : null, planUsage: suppress(contentPlanUsage(id)) };
}
export function contentMetricCsv(rows: { title: string; type: ContentTypeId; id: string }[], role: StaffRole, from?: string, to?: string) {
  const quote = (v: unknown) => `"${String(v ?? "<11").replace(/"/g, '""')}"`;
  return [["title", "type", "starts", "completions", "completion rate", "median rating change", "care plans"], ...rows.flatMap((r) => { const m = contentMetrics(r.type, r.id, role, from, to); return m ? [[r.title, r.type, m.starts, m.completions, m.rate, m.medianChange, m.planUsage]] : []; })].map((r) => r.map(quote).join(",")).join("\r\n");
}
export function staffLearningHistory(patientId: string, role: StaffRole) {
  const e = getEngagement(patientId); if (!e) return [];
  return [...new Set([...Object.keys(e.completedAt ?? {}), ...Object.keys(e.lessonResponses)])].flatMap((key) => {
    const at = e.completedAt?.[key] ?? e.lessonResponses[key]?.updatedAt;
    if (!at) return [];
    const split = key.indexOf(":"); const surface = key.slice(0, split), id = key.slice(split + 1); const type: ContentTypeId = surface === "recovery" ? "recovery_lesson" : surface === "exercise" ? "exercise" : "library_lesson";
    const item = type === "recovery_lesson" ? liveRecoveryLesson(id) : type === "exercise" ? liveExercise(id) : liveLibraryItem(id);
    const entry = getContentEntry(type, id); const body = entry?.publishedBody ?? entry?.body ?? item as unknown as Record<string, unknown>;
    if (!body || !contentVisibleToStaff(role, type, body)) return [];
    const revision = e.completedRevisions?.[key] ?? e.lessonResponses[key]?.publishedRev ?? null;
    const observed = entry?.revisions.find((r) => r.rev === revision)?.body;
    return [{ title: String(observed?.title ?? item?.title ?? "Retired content"), at, completed: !!e.completedAt?.[key], publishedRev: revision }];
  }).sort((a, b) => b.at.localeCompare(a.at));
}
