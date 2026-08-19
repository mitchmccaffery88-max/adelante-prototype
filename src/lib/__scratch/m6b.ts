import { liveLessonsInModule } from "@/lib/contentCatalog";
const ls = liveLessonsInModule("building-a-life-that-works");
for (const l of ls) {
  console.log(`### ${l.order} ${l.id}\ntitle=${l.title}\nproblem=${l.problem}\nlearnTitle=${l.learnTitle}\nlearnBody=${l.learnBody}\ninsight=${l.insight}\ntoolkitLabel=${l.toolkitLabel}\nactivity.prompt=${l.activity?.prompt}\nactivity.choices=${JSON.stringify(l.activity?.choices?.map((c:any)=>c.label))}\ntoday0=${l.toolFlow.todayActions[0]}\nwarn=${JSON.stringify(l.toolFlow.warningSigns)}\nsupport=${JSON.stringify(l.toolFlow.supportPeople)}\ntoday=${JSON.stringify(l.toolFlow.todayActions)}\n`);
}
