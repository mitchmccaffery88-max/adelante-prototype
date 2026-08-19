import { liveRecoveryModules, liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
const m = liveRecoveryModules().find(x=>x.id==="building-a-life-that-works");
console.log(JSON.stringify(m,null,1));
const ls = liveLessonsInModule("building-a-life-that-works");
console.log("count",ls.length);
for (const l of ls) {
  console.log("=====",l.id,"|",l.title);
  console.log(JSON.stringify(l,null,1));
  console.log("GATE:",JSON.stringify(originalityErrors("recovery_lesson", structuredClone(l) as any)));
}
