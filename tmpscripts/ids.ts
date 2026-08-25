import { RECOVERY_LESSONS } from "../src/lib/recovery";
import { matchExerciseForLesson } from "../src/lib/recovery.exerciseMatch";
const byMod: Record<string,string[]> = {};
for (const l of RECOVERY_LESSONS) (byMod[l.moduleId] ??= []).push(l.id);
for (const [m, ids] of Object.entries(byMod)) console.log(m, ids.length, ids[0]);
const tiers: Record<string,number> = {}; const ex: Record<string,number> = {};
for (const l of RECOVERY_LESSONS){const r=matchExerciseForLesson(l);tiers[r.tier]=(tiers[r.tier]??0)+1;ex[r.exercise.id]=(ex[r.exercise.id]??0)+1;}
console.log(tiers, ex);
