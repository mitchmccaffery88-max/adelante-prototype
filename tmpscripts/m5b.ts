import "@/lib/contentCatalog";
import { liveLessonsInModule } from "@/lib/contentCatalog";
const ls:any[] = liveLessonsInModule("healing-my-relationships") as any;
for (const l of ls) console.log(`${l.order}\t${l.id}\n\ttitle: ${l.title}\n\tproblem: ${l.problem}\n\tlearnTitle: ${l.learnTitle}\n\tlearn: ${l.learnBody}\n\ttoolkit: ${l.toolkitLabel}`);
