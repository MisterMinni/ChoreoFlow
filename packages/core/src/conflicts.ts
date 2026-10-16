import { add, distance, pathSpeedBound } from './geometry';
import type { Project, Scene } from './model';
import { evaluateScene } from './scene';
import { formationStartTime, projectDuration } from './time';

export interface MotionConflict {
  kind: 'person-distance' | 'stage-edge' | 'prop'; personIds: string[]; objectId?: string;
  startSeconds: number; endSeconds: number; minimumDistance: number;
  /** Conservative uncertainty interval, not an observed overlap. */
  conservative: boolean;
}
export interface ConflictOptions { clearance?: number; timeTolerance?: number; maxResults?: number; startSeconds?: number; endSeconds?: number }
/** Max physical speed bound per person during one timeline segment. */
function speedBounds(project: Project, scene: Scene): Map<string, number> {
  const speeds = new Map(project.people.map(p => [p.id, 0]));
  const transition = project.transitions.find(t => t.id === scene.transitionId);
  if (transition) {
    const from = project.formations.find(f => f.id === transition.fromFormationId)!;
    const to = project.formations.find(f => f.id === transition.toFormationId)!;
    for (const person of project.people) {
      const initial = from.positions[person.id]!, target = to.positions[person.id]!;
      const motion = transition.motions.find(m => m.type === 'individual' ? m.personId === person.id : m.personIds.includes(person.id));
      let speed = distance(initial, target) / transition.durationSeconds;
      if (motion?.type === 'individual') speed = pathSpeedBound(motion.path, initial, target) / motion.durationSeconds * (motion.easing === 'linear' ? 1 : 1.5);
      else if (motion?.type === 'group') {
        const radius = Math.hypot(initial.x - motion.pivot.x, initial.y - motion.pivot.y);
        const angle = (Math.abs(motion.angleDegrees) + Math.abs(motion.fanDegrees ?? 0) / 2) * Math.PI / 180;
        const maximumScale = Math.max(1, motion.scale.x, motion.scale.y);
        const scaling = Math.max(Math.abs(motion.scale.x - 1), Math.abs(motion.scale.y - 1));
        const translation = pathSpeedBound(motion.path ?? { type: 'line' }, motion.pivot, add(motion.pivot, motion.translation));
        speed = (radius * (angle * maximumScale + scaling) + translation) / motion.durationSeconds * (motion.easing === 'linear' ? 1 : 1.5);
      }
      speeds.set(person.id, speed);
    }
  }
  for (const lift of project.lifts) for (let i = 0; i < lift.phases.length; i++) {
    const phase = lift.phases[i]!;
    if (scene.timeSeconds < phase.startSeconds || scene.timeSeconds >= phase.endSeconds || !['raise', 'lower'].includes(phase.type)) continue;
    for (const [id, height] of Object.entries(phase.heights)) {
      const previous = lift.phases[i - 1]?.heights[id];
      const baseSpeed = speeds.get(id) ?? 0, phaseDuration = phase.endSeconds - phase.startSeconds;
      if (previous !== undefined) speeds.set(id, baseSpeed + Math.abs(height - previous) / phaseDuration);
      else {
        // A first raise can begin above ground. Bound its unmodified height and
        // underlying movement as well, instead of assuming a zero-height start.
        const base = evaluateScene({ ...project, lifts: [] }, scene.timeSeconds).people.find(p => p.personId === id)?.position.z ?? 0;
        speeds.set(id, baseSpeed * 2 + Math.abs(height - base) / phaseDuration);
      }
    }
  }
  return speeds;
}
function contactAllowed(project: Project, a: string, b: string, time: number): boolean {
  return project.lifts.some(l => l.phases.some(p => time >= p.startSeconds && time < p.endSeconds && p.contacts.some(c => (c.personA === a && c.personB === b) || (c.personA === b && c.personB === a))));
}
function events(project: Project, start: number, end: number): number[] {
  const result = new Set([start, end]);
  const put = (n: number): void => { if (n > start && n < end) result.add(n); };
  for (const formation of project.formations) {
    const t = formationStartTime(project, formation.id); put(t); put(t + formation.holdSeconds);
    const transition = project.transitions.find(item => item.fromFormationId === formation.id);
    if (transition) for (const motion of transition.motions) for (const delay of motion.type === 'group' ? [0, ...Object.values(motion.staggerSeconds ?? {})] : [0]) {
      put(t + formation.holdSeconds + motion.delaySeconds + delay); put(t + formation.holdSeconds + motion.delaySeconds + delay + motion.durationSeconds);
    }
  }
  project.lifts.forEach(l => l.phases.forEach(p => { put(p.startSeconds); put(p.endSeconds); }));
  project.props.forEach(p => { put(p.startSeconds); put(p.endSeconds); });
  return [...result].sort((a, b) => a - b);
}
/**
 * Conservative adaptive distance check using Lipschitz speed bounds. Coarse intervals
 * only nominate candidates; they cannot make a fast crossing disappear. Human bodies
 * are spheres, props oriented boxes. This is no physical safety certification.
 */
export function checkConflicts(project: Project, options: ConflictOptions = {}): MotionConflict[] {
  const clearance = options.clearance ?? 0.05, tolerance = options.timeTolerance ?? 0.002, maxResults = options.maxResults ?? 500;
  const duration = projectDuration(project), start = Math.max(0, options.startSeconds ?? 0), end = Math.min(duration, options.endSeconds ?? duration);
  if (end < start || tolerance <= 0 || clearance < 0) return [];
  const result: MotionConflict[] = [], byKey = new Map<string, MotionConflict>();
  const cache = new Map<number, Scene>();
  const sceneAt = (time: number): Scene => { let scene = cache.get(time); if (!scene) { scene = evaluateScene(project, time); cache.set(time, scene); } return scene; };
  const addConflict = (conflict: MotionConflict): void => {
    const key = `${conflict.kind}:${conflict.personIds.join(':')}:${conflict.objectId ?? ''}`;
    const previous = byKey.get(key);
    if (previous && conflict.startSeconds <= previous.endSeconds + tolerance) { previous.endSeconds = Math.max(previous.endSeconds, conflict.endSeconds); previous.minimumDistance = Math.min(previous.minimumDistance, conflict.minimumDistance); previous.conservative &&= conflict.conservative; }
    else if (result.length < maxResults) { result.push(conflict); byKey.set(key, conflict); }
  };
  const inspect = (a: number, b: number, speed: number, distanceAt: (time: number) => number, report: (a: number, b: number, min: number, uncertain: boolean) => void, depth = 0): void => {
    const middle = (a + b) / 2;
    const da = distanceAt(a), db = distanceAt(Math.max(a, b - 1e-9)), dm = distanceAt(middle), minimum = Math.min(da, db, dm);
    if (speed <= 1e-12) { if (minimum <= 0) report(a, b, minimum, false); return; }
    // Every point is at most one quarter-interval from one of the three samples.
    if (minimum - speed * (b - a) / 4 > 0) return;
    if (minimum + speed * (b - a) / 4 < 0 || b - a <= tolerance || depth >= 30) { report(a, b, minimum, minimum > 0); return; }
    inspect(a, middle, speed, distanceAt, report, depth + 1); inspect(middle, b, speed, distanceAt, report, depth + 1);
  };
  const boundaries = events(project, start, end);
  for (let interval = 1; interval < boundaries.length; interval++) {
    const a = boundaries[interval - 1]!, b = boundaries[interval]!, middle = (a + b) / 2;
    const scene = sceneAt(middle), speeds = speedBounds(project, scene);
    // Sweep in x over conservative swept spheres; y/z then narrow the candidate set.
    const envelopes = scene.people.map((p, index) => ({ p, index, reach: (speeds.get(p.personId) ?? 0) * (b - a) / 2 + project.people[index]!.radius + clearance })).sort((u, v) => u.p.position.x - u.reach - (v.p.position.x - v.reach));
    for (let i = 0; i < envelopes.length; i++) {
      const first = envelopes[i]!, idA = first.p.personId, radiusA = project.people[first.index]!.radius;
      for (let j = i + 1; j < envelopes.length; j++) {
        const second = envelopes[j]!, idB = second.p.personId;
        if (second.p.position.x - second.reach > first.p.position.x + first.reach) break;
        if (distance(first.p.position, second.p.position) > first.reach + second.reach || contactAllowed(project, idA, idB, middle)) continue;
        const threshold = radiusA + project.people[second.index]!.radius + clearance;
        const distanceAt = (time: number): number => { const persons = sceneAt(time).people; return distance(persons[first.index]!.position, persons[second.index]!.position) - threshold; };
        inspect(a, b, (speeds.get(idA) ?? 0) + (speeds.get(idB) ?? 0), distanceAt, (from, to, min, uncertain) => addConflict({ kind: 'person-distance', personIds: [idA, idB].sort(), startSeconds: from, endSeconds: to, minimumDistance: min + threshold, conservative: uncertain }));
      }
      const edgeDistance = (time: number): number => { const p = sceneAt(time).people[first.index]!.position; return Math.min(project.stage.width / 2 - Math.abs(p.x), project.stage.depth / 2 - Math.abs(p.y)) - radiusA; };
      inspect(a, b, speeds.get(idA) ?? 0, edgeDistance, (from, to, min, uncertain) => addConflict({ kind: 'stage-edge', personIds: [idA], startSeconds: from, endSeconds: to, minimumDistance: min, conservative: uncertain }));
      for (const prop of project.props) {
        if (middle < prop.startSeconds || middle >= prop.endSeconds) continue;
        const propDistance = (time: number): number => {
          const position = sceneAt(time).people[first.index]!.position, theta = -prop.rotationDegrees * Math.PI / 180;
          const dx = position.x - prop.position.x, dy = position.y - prop.position.y;
          const x = dx * Math.cos(theta) - dy * Math.sin(theta), y = dx * Math.sin(theta) + dy * Math.cos(theta);
          return Math.hypot(Math.max(0, Math.abs(x) - prop.size.x / 2), Math.max(0, Math.abs(y) - prop.size.y / 2), Math.max(0, prop.position.z - position.z, position.z - prop.position.z - prop.size.z)) - radiusA - clearance;
        };
        inspect(a, b, speeds.get(idA) ?? 0, propDistance, (from, to, min, uncertain) => addConflict({ kind: 'prop', personIds: [idA], objectId: prop.id, startSeconds: from, endSeconds: to, minimumDistance: min + radiusA + clearance, conservative: uncertain }));
      }
    }
    // Keep memory bounded for long projects; interval samples no longer needed.
    cache.clear();
    if (result.length >= maxResults) break;
  }
  return result.sort((a, b) => a.startSeconds - b.startSeconds);
}
