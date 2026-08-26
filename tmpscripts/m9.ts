import { PORTED_RECOVERY_LESSONS } from "../src/lib/recovery.ported";
for (const l of PORTED_RECOVERY_LESSONS.filter(x=>x.moduleId==="living-recovery")) {
  console.log(l.order, l.id);
  console.log(" title:", l.title, "| problem:", l.problem, "| toolkit:", l.toolkitLabel);
  console.log(" learn:", l.learnTitle, "::", l.learnBody);
  console.log(" act:", l.activity.kind, "|", (l.activity as any).prompt);
  console.log(" insight:", l.insight);
  console.log(" today0:", l.toolFlow.todayActions[0]);
  console.log();
}
