import { RECOVERY_MODULES, RECOVERY_LESSONS } from "@/lib/recovery";
const m = RECOVERY_MODULES.find(m=>m.order===7) ?? RECOVERY_MODULES[6];
console.log("MODULE", JSON.stringify({id:m.id,title:m.title,mission:(m as any).mission,order:m.order}));
console.log(RECOVERY_MODULES.map(x=>`${x.order} ${x.id} ${x.title}`).join("\n"));
const ls = RECOVERY_LESSONS.filter((l:any)=>l.moduleId===m.id);
console.log("N",ls.length);
for (const l of ls as any[]) console.log(JSON.stringify(l,null,1));
