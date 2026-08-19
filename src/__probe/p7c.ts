import { RECOVERY_LESSONS } from "@/lib/recovery";
const ls = RECOVERY_LESSONS.filter((l:any)=>l.moduleId==="when-recovery-gets-hard") as any[];
for (const l of ls) console.log(`### ${l.order} ${l.id}\nTITLE ${l.title}\nPROBLEM ${l.problem}\nLEARN ${l.learnTitle}: ${l.learnBody}\nPROMPT ${l.activity.prompt}\nINSIGHT ${l.insight}\nTOOLKIT ${l.toolkitLabel}\nFIRSTACTION ${l.toolFlow.todayActions[0]}\n`);
