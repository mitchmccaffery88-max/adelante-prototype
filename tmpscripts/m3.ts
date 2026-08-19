import { RECOVERY_MODULES, RECOVERY_LESSONS } from "@/lib/recovery";
console.log(RECOVERY_MODULES.map((m:any,i:number)=>`${i}: ${m.id} | ${m.title} | ${m.subtitle??""}`).join("\n"));
const m = RECOVERY_MODULES[2] as any;
const ls = RECOVERY_LESSONS.filter((l:any)=>l.moduleId===m.id);
console.log("\nMODULE3", m.id, ls.length);
for (const l of ls as any[]) {
  console.log("\n---", l.id, "|", l.title);
  console.log("problem:", l.problem);
  console.log("learnTitle:", l.learnTitle);
  console.log("learnBody:", l.learnBody);
  console.log("insight:", l.insight);
  console.log("checkIn:", l.checkIn);
  console.log("adelQ:", l.adelQuestion);
  console.log("adelR:", l.adelReflection);
  console.log("toolFlow:", JSON.stringify(l.toolFlow));
  console.log("activity:", JSON.stringify(l.activity));
}
