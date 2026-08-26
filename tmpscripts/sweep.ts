import { liveRecoveryModules, liveLessonsInModule } from "../src/lib/contentCatalog";
import { originalityErrors } from "../src/lib/contentOriginality";
const mods = liveRecoveryModules().map(m=>m.id);
console.log("modules", mods.length, mods.join(","));
const all = mods.flatMap(id=>liveLessonsInModule(id));
console.log("lessons", all.length);
let bad=0;
for (const l of all){
  const e = originalityErrors("recovery_lesson", structuredClone(l) as any);
  if (e.length){bad++;console.log("FAIL",l.id,e);}
}
console.log("failing", bad);
for (const key of ["warningSigns","supportPeople","todayActions"] as const){
  const sets = all.map(l=>JSON.stringify((l as any).toolFlow[key]));
  console.log(key, new Set(sets).size, "/", sets.length);
}
const cs = all.map(l=> l.activity.kind==="decision"? JSON.stringify(l.activity.choices.map((c:any)=>c.label)) : l.id);
console.log("activityChoices", new Set(cs).size, "/", cs.length);
