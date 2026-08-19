import "@/lib/contentCatalog";
import { liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
import { RECOVERY_LESSON_TYPE } from "@/lib/contentTypes";
const ls = liveLessonsInModule("understanding-my-addiction") as any[];
console.log("count", ls.length);
const counts: Record<string, number> = {};
for (const l of ls) {
  const errs = originalityErrors("recovery_lesson", structuredClone(l));
  console.log("\n", l.id);
  for (const e of errs) { console.log("   GATE:", e); counts[e.split(" is ")[0]] = (counts[e.split(" is ")[0]]??0)+1; }
  const v = RECOVERY_LESSON_TYPE.validate(structuredClone(l));
  if (v.length) console.log("   VALIDATE:", v);
}
console.log("\nflag counts", counts);
for (const k of ["warningSigns","supportPeople","todayActions"] as const) {
  const sigs = new Map<string,string[]>();
  for (const l of ls) { const s = JSON.stringify(l.toolFlow[k]); sigs.set(s, [...(sigs.get(s)??[]), l.id]); }
  console.log(k, "distinct sets:", sigs.size, "of", ls.length);
}
