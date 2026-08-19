import { RECOVERY_MODULES, RECOVERY_LESSONS } from "@/lib/recovery";
console.log(RECOVERY_MODULES.map((m:any,i:number)=>`${i} ${m.id} | ${m.title} | ${m.subtitle??''}`).join("\n"));
const m5:any = RECOVERY_MODULES[4];
const ls = RECOVERY_LESSONS.filter((l:any)=>l.moduleId===m5.id);
console.log("count", ls.length);
console.log(JSON.stringify(ls, null, 1));
