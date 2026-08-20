import { liveRecoveryModules, liveLessonsInModule } from "@/lib/contentCatalog";
const mods = liveRecoveryModules();
console.log("MODULE COUNT:", mods.length);
for (const m of mods) {
  const ls = liveLessonsInModule(m.id);
  console.log(`\n#${m.order} ${m.id} | ${m.name} | mission="${m.mission}" | lessons=${ls.length} | contentPending=${!!m.contentPending}`);
  for (const l of ls) console.log(`   ${l.order}. ${l.id} | "${l.title}" | ${l.minutes}min | toolkitLabel="${l.toolkitLabel}"`);
}
