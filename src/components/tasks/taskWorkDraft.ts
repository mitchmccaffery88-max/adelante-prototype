import { useState, type Dispatch, type SetStateAction } from "react";
import type { TaskPriority } from "@/lib/ehr";

/** Session-only editor state; no record write, persistence or audit. */
export interface TaskWorkDraft {
  open: boolean;
  due: string;
  priority: TaskPriority;
  note: string;
  followUp: string | null;
  followUpDue: string;
}
export type TaskWorkDraftCache = Map<string, Partial<TaskWorkDraft>>;

export function useTaskDraftField<K extends keyof TaskWorkDraft>(
  cache: TaskWorkDraftCache | undefined, key: string, field: K, initial: TaskWorkDraft[K],
): [TaskWorkDraft[K], Dispatch<SetStateAction<TaskWorkDraft[K]>>] {
  const saved = cache?.get(key)?.[field];
  const [value, setValue] = useState<TaskWorkDraft[K]>(saved === undefined ? initial : saved);
  const update: Dispatch<SetStateAction<TaskWorkDraft[K]>> = (next) => {
    const result = typeof next === "function" ? next(value) : next;
    cache?.set(key, { ...cache.get(key), [field]: result });
    setValue(result);
  };
  return [value, update];
}