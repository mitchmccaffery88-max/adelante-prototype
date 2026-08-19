import { liveRecoveryModules, liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
const mods = liveRecoveryModules();
console.log(mods.map((m:any,i:number)=>`${i}: ${m.id} | ${m.title} | ${m.subtitle??''}`).join("\n"));
const m4 = mods[3];
const lessons = liveLessonsInModule(m4.id);
console.log("\nMODULE4", m4.id, lessons.length);
for (const l of lessons) {
  console.log("\n=== ", l.id);
  console.log("title:", l.title);
  console.log("problem:", l.problem);
  console.log("learnTitle:", l.learnTitle);
  console.log("learnBody:", l.learnBody);
  console.log("insight:", l.insight);
  console.log("checkIn:", l.checkIn);
  console.log("adelQuestion:", l.adelQuestion);
  console.log("adelReflection:", l.adelReflection);
  console.log("toolFlow:", JSON.stringify(l.toolFlow));
  console.log("GATE:", JSON.stringify(originalityErrors("recovery_lesson", structuredClone(l) as never)));
}
const sig=(k:string)=>new Set(lessons.map((l:any)=>JSON.stringify(l.toolFlow[k])));
for (const k of ["warningSigns","supportPeople","todayActions"]) console.log(k, "distinct:", sig(k).size);
console.log("todayActions first entries:", JSON.stringify(lessons.map((l:any)=>l.toolFlow.todayActions)));
