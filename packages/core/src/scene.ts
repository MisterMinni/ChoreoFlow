import { add, clamp, evaluatePath, lerp, rotate, vec } from './geometry';
import type { Formation, GroupMotion, Project, Scene, ScenePerson, Transition, Vec3 } from './model';
import { projectDuration } from './time';

function motionProgress(motion: { delaySeconds: number; durationSeconds: number; easing: string }, elapsed: number, extraDelay = 0): number {
  const t = clamp((elapsed - motion.delaySeconds - extraDelay) / Math.max(0.000001, motion.durationSeconds));
  return motion.easing === 'ease-in-out' ? t * t * (3 - 2 * t) : t;
}
export function groupPosition(motion: GroupMotion, initial: Vec3, personId: string, progress: number): Vec3 {
  const t = clamp(progress), index = motion.personIds.indexOf(personId);
  const fan = motion.personIds.length <= 1 ? 0 : ((index / (motion.personIds.length - 1)) - 0.5) * (motion.fanDegrees ?? 0);
  const scaled = vec(motion.pivot.x + (initial.x - motion.pivot.x) * (1 + (motion.scale.x - 1) * t), motion.pivot.y + (initial.y - motion.pivot.y) * (1 + (motion.scale.y - 1) * t), initial.z);
  const rotated = rotate(scaled, motion.pivot, (motion.angleDegrees + fan) * t);
  const center = evaluatePath(motion.path ?? { type: 'line' }, motion.pivot, add(motion.pivot, motion.translation), t);
  return add(rotated, vec(center.x - motion.pivot.x, center.y - motion.pivot.y, center.z - motion.pivot.z));
}
function evaluatePeople(project: Project, from: Formation, to: Formation | null, transition: Transition | null, elapsed: number): ScenePerson[] {
  return project.people.map(person => {
    const start = from.positions[person.id] ?? vec(), end = to?.positions[person.id] ?? start;
    const defaultProgress = transition ? clamp(elapsed / Math.max(0.000001, transition.durationSeconds)) : 0;
    let position = lerp(start, end, defaultProgress);
    let facingDeg = from.facing[person.id] ?? 0;
    if (to) facingDeg += ((to.facing[person.id] ?? facingDeg) - facingDeg) * defaultProgress;
    const motion = transition?.motions.find(m => m.type === 'individual' ? m.personId === person.id : m.personIds.includes(person.id));
    if (motion?.type === 'individual') {
      const p = motionProgress(motion, elapsed);
      position = evaluatePath(motion.path, start, end, p);
      if (motion.facing?.type === 'fixed') facingDeg = motion.facing.degrees;
      if (motion.facing?.type === 'interpolate') facingDeg = motion.facing.fromDegrees + motion.facing.angleDegrees * p;
      if (motion.facing?.type === 'along-path') {
        const before = evaluatePath(motion.path, start, end, Math.max(0, p - 0.0001));
        const after = evaluatePath(motion.path, start, end, Math.min(1, p + 0.0001));
        if (Math.hypot(after.x - before.x, after.y - before.y) > 1e-8) facingDeg = Math.atan2(after.x - before.x, -(after.y - before.y)) * 180 / Math.PI;
      }
    } else if (motion?.type === 'group') {
      const p = motionProgress(motion, elapsed, motion.staggerSeconds?.[person.id] ?? 0);
      position = groupPosition(motion, start, person.id, p);
      if (motion.rotateFacing) {
        const index = motion.personIds.indexOf(person.id);
        const fan = motion.personIds.length <= 1 ? 0 : (index / (motion.personIds.length - 1) - 0.5) * (motion.fanDegrees ?? 0);
        facingDeg = (from.facing[person.id] ?? 0) + (motion.angleDegrees + fan) * p;
      }
    }
    return { personId: person.id, position, facingDeg };
  });
}
/** A single pure scene evaluator used by every renderer, export and conflict checker. */
export function evaluateScene(project: Project, timeSeconds: number): Scene {
  const durationSeconds = projectDuration(project), time = clamp(Number.isFinite(timeSeconds) ? timeSeconds : 0, 0, durationSeconds);
  let cursor = 0;
  let formation = project.formations[project.formations.length - 1];
  let transition: Transition | null = null, target: Formation | null = null, elapsed = 0;
  for (let i = 0; i < project.formations.length; i++) {
    const current = project.formations[i]!;
    if (time < cursor + current.holdSeconds || i === project.formations.length - 1) { formation = current; break; }
    cursor += current.holdSeconds;
    const next = project.formations[i + 1];
    const nextTransition = project.transitions.find(t => t.fromFormationId === current.id && t.toFormationId === next?.id);
    if (nextTransition && time < cursor + nextTransition.durationSeconds) { formation = current; target = next!; transition = nextTransition; elapsed = time - cursor; break; }
    cursor += nextTransition?.durationSeconds ?? 0;
  }
  const people = formation ? evaluatePeople(project, formation, target, transition, elapsed) : [];
  // Explicit phase heights are planning parameters, not a biomechanical simulation.
  for (const lift of project.lifts) {
    for (let i = 0; i < lift.phases.length; i++) {
      const phase = lift.phases[i]!;
      if (time < phase.startSeconds || time >= phase.endSeconds) continue;
      const previous = lift.phases[i - 1];
      const progress = phase.type === 'hold' || phase.type === 'setup' ? 1 : clamp((time - phase.startSeconds) / Math.max(0.000001, phase.endSeconds - phase.startSeconds));
      for (const [personId, targetHeight] of Object.entries(phase.heights)) {
        const person = people.find(p => p.personId === personId);
        if (person) { const initialHeight = previous?.heights[personId] ?? person.position.z; person.position = { ...person.position, z: initialHeight + (targetHeight - initialHeight) * progress }; }
      }
    }
  }
  return { timeSeconds: time, durationSeconds, formationId: formation?.id ?? null, transitionId: transition?.id ?? null, progress: transition ? elapsed / transition.durationSeconds : 0, people };
}
