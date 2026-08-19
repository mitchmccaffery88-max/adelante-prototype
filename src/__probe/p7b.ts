import { RECOVERY_LESSONS } from "@/lib/recovery";
import { originalityErrors } from "@/lib/contentOriginality";
import "@/lib/contentCatalog";
const ls = RECOVERY_LESSONS.filter((l:any)=>l.moduleId==="when-recovery-gets-hard") as any[];
for (const l of ls) {
  console.log(`--- ${l.order} ${l.id} | ${l.title} | problem="${l.problem}"`);
  console.log("  gate:", JSON.stringify(originalityErrors("recovery_lesson", structuredClone(l))));
  console.log("  activityKind:", l.activity.kind, "| choices:", JSON.stringify((l.activity.choices??[]).map((c:any)=>c.label)));
  console.log("  toolkitLabel:", l.toolkitLabel, "| insight:", l.insight);
}
for (const k of ["warningSigns","supportPeople","todayActions"] as const) {
  const sets = ls.map(l=>JSON.stringify(l.toolFlow[k]));
  const tails = ls.map(l=>JSON.stringify(l.toolFlow[k].slice(1)));
  console.log(k, "distinct full:", new Set(sets).size, "distinct tails:", new Set(tails).size);
}
console.log("distinct choice-label sets:", new Set(ls.map(l=>JSON.stringify((l.activity.choices??[]).map((c:any)=>c.label)))).size);
