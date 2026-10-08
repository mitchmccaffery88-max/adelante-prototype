export interface BreathState { phase: number; left: number; cycles: number; finished: boolean }
export function startBreath(durations: readonly number[]): BreathState {
  const phase = durations.findIndex((n) => n > 0);
  return { phase: Math.max(0, phase), left: durations[Math.max(0, phase)] ?? 1, cycles: 0, finished: phase < 0 };
}
/** Pure phase transition; zero-length holds are skipped, cycle cap is final. */
export function tickBreath(state: BreathState, durations: readonly number[], cap: number): BreathState {
  if (state.finished) return state;
  if (state.left > 1) return { ...state, left: state.left - 1 };
  let phase = state.phase;
  let cycles = state.cycles;
  for (let i = 0; i < durations.length; i++) {
    phase = (phase + 1) % durations.length;
    if (phase === 0) cycles++;
    if (cycles >= cap) return { phase, left: 0, cycles: cap, finished: true };
    if ((durations[phase] ?? 0) > 0) return { phase, left: durations[phase] ?? 1, cycles, finished: false };
  }
  return { ...state, finished: true };
}