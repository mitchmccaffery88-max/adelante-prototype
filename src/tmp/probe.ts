import { liveRecoveryModules, liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
import { RECOVERY_LESSON_TYPE } from "@/lib/contentTypes";
const mods = liveRecoveryModules();
console.log(mods.map((m:any)=>`${m.order} ${m.id} ${m.name} / ${m.mission}`).join("\n"));
const l = liveLessonsInModule("finding-my-people");
console.log("count", l.length);
for (const x of l) {
  const errs = originalityErrors("recovery_lesson", x.id, structuredClone(x) as any);
  console.log("\n=== ", x.order, x.id, x.title);
  console.log("problem:", x.problem);
  console.log("learnTitle:", x.learnTitle);
  console.log("learnBody:", x.learnBody.slice(0,400));
  console.log("checkIn:", x.checkIn);
  console.log("adelQ:", x.adelQuestion);
  console.log("adelR:", x.adelReflection);
  console.log("insight:", x.insight);
  console.log("activity:", JSON.stringify(x.activity).slice(0,500));
  console.log("toolFlow:", JSON.stringify(x.toolFlow));
  console.log("GATE:", JSON.stringify(errs));
  console.log("VALIDATE:", JSON.stringify(RECOVERY_LESSON_TYPE.validate(structuredClone(x) as any)));
}
