import { liveLessonsInModule } from "@/lib/contentCatalog";
import { originalityErrors } from "@/lib/contentOriginality";
const lessons = liveLessonsInModule("changing-my-everyday-life");
lessons.slice(5).forEach((l:any)=>{
  console.log("===",l.id,"|",l.title);
  console.log("problem:",l.problem,"| learnTitle:",l.learnTitle);
  console.log("learnBody:",l.learnBody);
  console.log("insight:",l.insight);
  console.log("todayActions:",JSON.stringify(l.toolFlow.todayActions));
  console.log("gateCount:",originalityErrors("recovery_lesson",structuredClone(l) as never).length);
});
const d=(k:string)=>new Set(lessons.map((l:any)=>JSON.stringify(l.toolFlow[k]))).size;
console.log("\nDISTINCT warningSigns",d("warningSigns"),"supportPeople",d("supportPeople"),"todayActions",d("todayActions"));
console.log("tail-identical todayActions[1..]:", new Set(lessons.map((l:any)=>JSON.stringify(l.toolFlow.todayActions.slice(1)))).size);
console.log("activities:", JSON.stringify(lessons.map((l:any)=>l.activity ?? null)));
