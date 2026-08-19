import "@/lib/contentCatalog";
import { liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
const ls:any[] = liveLessonsInModule("healing-my-relationships") as any;
for (const l of ls) {
  const errs = originalityErrors("recovery_lesson", structuredClone(l));
  console.log("###", l.id, "| order", l.order);
  console.log("  problem:", l.problem);
  console.log("  checkIn:", l.checkIn);
  console.log("  adelQ:", l.adelQuestion);
  console.log("  adelR:", l.adelReflection);
  console.log("  insight:", l.insight);
  console.log("  toolkitLabel:", l.toolkitLabel);
  console.log("  ERRORS:", errs.length ? errs : "none");
}
const keys = ["warningSigns","supportPeople","todayActions"] as const;
for (const k of keys) {
  const sigs = new Map<string,string[]>();
  for (const l of ls) { const s = JSON.stringify(l.toolFlow[k]); sigs.set(s,[...(sigs.get(s)??[]), l.id]); }
  console.log("==", k, "distinct sets:", sigs.size, "of", ls.length);
  for (const [s,ids] of sigs) console.log("   ", ids.length, s);
  // first-entry-only pattern
  const tails = new Set(ls.map(l=>JSON.stringify(l.toolFlow[k].slice(1))));
  console.log("   distinct tails (after first entry):", tails.size);
}
