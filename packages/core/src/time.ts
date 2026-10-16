import type { Project, TempoMap } from './model';

export function projectDuration(project: Project): number {
  return project.formations.reduce((sum, formation, i) => sum + formation.holdSeconds + (i < project.formations.length - 1 ? project.transitions.find(t => t.fromFormationId === formation.id && t.toFormationId === project.formations[i + 1]?.id)?.durationSeconds ?? 0 : 0), 0);
}
export function formationStartTime(project: Project, formationId: string): number {
  let time = 0;
  for (let i = 0; i < project.formations.length; i++) {
    const formation = project.formations[i]!; if (formation.id === formationId) return time;
    time += formation.holdSeconds;
    time += project.transitions.find(t => t.fromFormationId === formation.id && t.toFormationId === project.formations[i + 1]?.id)?.durationSeconds ?? 0;
  }
  throw new Error(`Unknown formation: ${formationId}`);
}
export const roundTime = (seconds: number): number => Math.round(seconds * 100) / 100;
/** Integrate tempo analytically; no accumulation of rounded frame/count values. */
function beatsBetween(tempo: TempoMap, start: number, end: number): number {
  if (end < start) return -beatsBetween(tempo, end, start);
  const marks = [...tempo.marks].sort((a, b) => a.timeSeconds - b.timeSeconds);
  let cursor = start, beats = 0, bpm = marks[0]?.bpm ?? 120;
  for (const mark of marks) {
    if (mark.timeSeconds <= start) bpm = mark.bpm;
    else if (mark.timeSeconds < end) { beats += (mark.timeSeconds - cursor) * bpm / 60; cursor = mark.timeSeconds; bpm = mark.bpm; }
  }
  return beats + (end - cursor) * bpm / 60;
}
/** Zero-based musical count, so offset time is count 0 (display as first count). */
export function secondsToCounts(tempo: TempoMap, seconds: number): number { return beatsBetween(tempo, tempo.countOffsetSeconds, seconds); }
export function countsToSeconds(tempo: TempoMap, counts: number): number {
  let low = tempo.countOffsetSeconds - Math.abs(counts) * 60 / 10 - 1;
  let high = tempo.countOffsetSeconds + Math.abs(counts) * 60 / 10 + 1;
  for (let i = 0; i < 64; i++) { const mid = (low + high) / 2; if (secondsToCounts(tempo, mid) < counts) low = mid; else high = mid; }
  return (low + high) / 2;
}
export function formatCounts(tempo: TempoMap, seconds: number): string {
  const count = Math.floor(secondsToCounts(tempo, seconds) + 1e-8);
  return `${Math.floor(count / 8) + 1} × 8 · ${((count % 8) + 8) % 8 + 1}`;
}
