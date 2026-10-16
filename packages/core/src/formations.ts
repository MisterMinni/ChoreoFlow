import type { Formation, Project, Transition } from './model';
import { createId } from './projects';
import { commitCommand, createProjectCommand, type ProjectCommand, type ProjectHistory } from './history';
import { TECHNICAL_LIMITS } from './plans';
import { formationStartTime, projectDuration } from './time';
import { assertValidProject, validateProject } from './validation';

export type FormationEditAction =
  | { type: 'duplicate'; formationId: string }
  | { type: 'delete'; formationId: string }
  | { type: 'move'; formationId: string; beforeFormationId: string | null };
export type FormationTimingPolicy = 'keep-absolute' | 'follow-choreography';
export type TimedElementKind = 'lift' | 'prop' | 'note' | 'marker' | 'audio' | 'tempo';
export interface TimedElementImpact { id: string; kind: TimedElementKind; startSeconds: number; endSeconds?: number }
export interface MovedTimedElement extends TimedElementImpact { nextStartSeconds: number; nextEndSeconds?: number }
export interface FormationEditOptions {
  timing?: FormationTimingPolicy;
  newTransitionSeconds?: number;
  /** Resolve only events that cannot follow or would newly leave the timeline. */
  unmappedEventResolutions?: Record<string, 'keep-absolute' | 'remove'>;
}
export type FormationEditBlockerCode = 'formation-not-found' | 'target-not-found' | 'last-formation' | 'formation-limit' | 'invalid-duration' | 'invalid-timing' | 'event-unmapped' | 'event-outside-duration' | 'event-overlap' | 'project-invalid';
export interface FormationEditBlocker { code: FormationEditBlockerCode; message: string; eventId?: string; kind?: TimedElementKind }
export interface FormationEditPlan {
  action: FormationEditAction;
  timing: FormationTimingPolicy;
  projectId: string;
  baseRevision: number;
  nextProject: Project | null;
  command: ProjectCommand | null;
  focusFormationId: string | null;
  focusTimeSeconds: number;
  durationBeforeSeconds: number;
  durationAfterSeconds: number;
  newTransitionCount: number;
  removedTransitionIds: string[];
  newTransitionIds: string[];
  removedMotionIds: string[];
  removedSingleMotionCount: number;
  removedGroupMotionCount: number;
  retainedOutgoingMotionCount: number;
  retainedTimedElements: TimedElementImpact[];
  movedTimedElements: MovedTimedElement[];
  removedTimedElements: TimedElementImpact[];
  affectedFormationIds: string[];
  blockers: FormationEditBlocker[];
  requiresConfirmation: boolean;
  isNoop: boolean;
}
export class FormationEditError extends Error {
  constructor(public readonly code: 'stale-plan' | 'blocked-plan' | 'confirmation-required' | 'invalid-plan', message: string) { super(message); this.name = 'FormationEditError'; }
}
interface Segment { key: string; start: number; end: number }
const EPSILON = 1e-8;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const pair = (from: string, to: string): string => `${from}\u0000${to}`;

function segments(project: Project): Segment[] {
  const result: Segment[] = [];
  let time = 0;
  project.formations.forEach((formation, index) => {
    result.push({ key: `formation:${formation.id}`, start: time, end: time + formation.holdSeconds });
    time += formation.holdSeconds;
    const transition = project.transitions.find(t => t.fromFormationId === formation.id && t.toFormationId === project.formations[index + 1]?.id);
    if (transition) { result.push({ key: `transition:${transition.id}`, start: time, end: time + transition.durationSeconds }); time += transition.durationSeconds; }
  });
  return result;
}
function segmentAt(items: Segment[], time: number): Segment | undefined {
  const boundary = items.find(segment => segment.end > segment.start && Math.abs(time - segment.start) <= EPSILON);
  if (boundary) return boundary;
  const active = items.find(segment => time >= segment.start && time < segment.end);
  if (active) return active;
  const last = items[items.length - 1];
  return last && Math.abs(time - last.end) <= EPSILON ? last : undefined;
}
function elements(project: Project): TimedElementImpact[] {
  return [
    ...project.lifts.map(lift => ({ id: lift.id, kind: 'lift' as const, startSeconds: Math.min(...lift.phases.map(p => p.startSeconds)), endSeconds: Math.max(...lift.phases.map(p => p.endSeconds)) })),
    ...project.props.map(prop => ({ id: prop.id, kind: 'prop' as const, startSeconds: prop.startSeconds, endSeconds: prop.endSeconds })),
    ...project.notes.filter(note => note.timeSeconds !== undefined).map(note => ({ id: note.id, kind: 'note' as const, startSeconds: note.timeSeconds! })),
    ...project.markers.map(marker => ({ id: marker.id, kind: 'marker' as const, startSeconds: marker.timeSeconds })),
    ...project.audio.clips.map(clip => ({ id: clip.id, kind: 'audio' as const, startSeconds: clip.startSeconds, endSeconds: clip.startSeconds + clip.trimEndSeconds - clip.trimStartSeconds })),
    ...project.tempo.marks.map(mark => ({ id: mark.id, kind: 'tempo' as const, startSeconds: mark.timeSeconds })),
  ];
}
/** Preserve an entire event's duration and phase spacing; never stretch a lift. */
function followingDelta(event: TimedElementImpact, before: Segment[], after: Segment[]): number | null {
  const end = event.endSeconds ?? event.startSeconds;
  const covered = end > event.startSeconds
    ? before.filter(segment => Math.min(segment.end, end) - Math.max(segment.start, event.startSeconds) > EPSILON)
    : [segmentAt(before, event.startSeconds)].filter((s): s is Segment => Boolean(s));
  if (!covered.length || event.startSeconds < 0 || end > (before[before.length - 1]?.end ?? 0) + EPSILON) return null;
  let delta: number | null = null;
  for (const segment of covered) {
    const next = after.find(item => item.key === segment.key);
    if (!next || Math.abs((segment.end - segment.start) - (next.end - next.start)) > EPSILON) return null;
    const offset = next.start - segment.start;
    if (delta !== null && Math.abs(offset - delta) > EPSILON) return null;
    delta = offset;
  }
  return delta;
}
function contextChanged(event: TimedElementImpact, before: Segment[], after: Segment[]): boolean {
  const start = event.startSeconds, end = event.endSeconds ?? start;
  const sameAt = (time: number): boolean => {
    const original = segmentAt(before, time), next = segmentAt(after, time);
    return original?.key === next?.key && Math.abs((original?.start ?? 0) - (next?.start ?? 0)) <= EPSILON;
  };
  if (end === start) return !sameAt(start);
  const cuts = [...new Set([start, end, ...before.flatMap(s => [s.start, s.end]), ...after.flatMap(s => [s.start, s.end])])].filter(time => time >= start && time <= end).sort((a, b) => a - b);
  for (let index = 1; index < cuts.length; index++) {
    const time = (cuts[index - 1]! + cuts[index]!) / 2;
    if (!sameAt(time)) return true;
  }
  return false;
}
function shiftElement(project: Project, event: TimedElementImpact, delta: number): void {
  const shifted = (time: number): number => Math.abs(time + delta) <= EPSILON ? 0 : time + delta;
  if (event.kind === 'lift') for (const phase of project.lifts.find(lift => lift.id === event.id)!.phases) { phase.startSeconds = shifted(phase.startSeconds); phase.endSeconds = shifted(phase.endSeconds); }
  if (event.kind === 'prop') { const prop = project.props.find(p => p.id === event.id)!; prop.startSeconds = shifted(prop.startSeconds); prop.endSeconds = shifted(prop.endSeconds); }
  if (event.kind === 'note') { const note = project.notes.find(note => note.id === event.id)!; note.timeSeconds = shifted(note.timeSeconds!); }
}
function removeElement(project: Project, event: TimedElementImpact): void {
  if (event.kind === 'lift') project.lifts = project.lifts.filter(lift => lift.id !== event.id);
  if (event.kind === 'prop') project.props = project.props.filter(prop => prop.id !== event.id);
  if (event.kind === 'note') project.notes = project.notes.filter(note => note.id !== event.id);
}

/** Prepare only: no input mutation, history edit, or event loss occurs here. */
export function prepareFormationEdit(project: Project, action: FormationEditAction, options: FormationEditOptions = {}): FormationEditPlan {
  assertValidProject(project);
  const timing = options.timing ?? 'keep-absolute', transitionSeconds = options.newTransitionSeconds ?? 4;
  const duration = projectDuration(project);
  const plan: FormationEditPlan = {
    action: clone(action), timing, projectId: project.id, baseRevision: project.revision,
    nextProject: null, command: null, focusFormationId: null, focusTimeSeconds: 0,
    durationBeforeSeconds: duration, durationAfterSeconds: duration,
    newTransitionCount: 0, removedTransitionIds: [], newTransitionIds: [], removedMotionIds: [],
    removedSingleMotionCount: 0, removedGroupMotionCount: 0, retainedOutgoingMotionCount: 0,
    retainedTimedElements: [], movedTimedElements: [], removedTimedElements: [], affectedFormationIds: [], blockers: [], requiresConfirmation: false, isNoop: false,
  };
  const block = (code: FormationEditBlockerCode, message: string, event?: TimedElementImpact): void => { plan.blockers.push({ code, message, ...(event ? { eventId: event.id, kind: event.kind } : {}) }); };
  const index = project.formations.findIndex(formation => formation.id === action.formationId);
  if (index < 0) block('formation-not-found', 'Die ausgewählte Formation ist nicht mehr vorhanden.');
  if (!Number.isFinite(transitionSeconds) || transitionSeconds < 0.01 || transitionSeconds > 3600) block('invalid-duration', 'Neue Übergänge benötigen eine Dauer zwischen 0,01 und 3600 Sekunden.');
  if (!['keep-absolute', 'follow-choreography'].includes(timing)) block('invalid-timing', 'Die gewählte Zeitbehandlung wird nicht unterstützt.');
  if (action.type === 'delete' && project.formations.length === 1) block('last-formation', 'Die letzte Formation des Projekts kann nicht entfernt werden.');
  if (action.type === 'duplicate' && project.formations.length >= TECHNICAL_LIMITS.formations) block('formation-limit', 'Das Projekt enthält bereits die technische Höchstzahl von 200 Formationen.');
  if (action.type === 'move' && action.beforeFormationId !== null && !project.formations.some(f => f.id === action.beforeFormationId)) block('target-not-found', 'Die Zielposition ist nicht mehr vorhanden.');
  if (plan.blockers.length) return plan;

  const next = clone(project), original = next.formations[index]!;
  let duplicate: Formation | null = null;
  if (action.type === 'duplicate') {
    duplicate = { ...clone(original), id: createId('formation'), name: `${original.name.slice(0, 192)} (Kopie)` };
    next.formations.splice(index + 1, 0, duplicate);
    plan.focusFormationId = duplicate.id;
  } else if (action.type === 'delete') {
    next.formations.splice(index, 1);
    plan.focusFormationId = next.formations[Math.min(index, next.formations.length - 1)]!.id;
  } else {
    if (action.beforeFormationId !== action.formationId) {
      next.formations.splice(index, 1);
      const destination = action.beforeFormationId === null ? next.formations.length : next.formations.findIndex(f => f.id === action.beforeFormationId);
      next.formations.splice(destination, 0, original);
    }
    plan.focusFormationId = original.id;
    if (next.formations.every((formation, i) => formation.id === project.formations[i]!.id)) {
      plan.isNoop = true; plan.nextProject = next; plan.focusTimeSeconds = formationStartTime(next, original.id); return plan;
    }
  }

  const existing = new Map(project.transitions.map(transition => [pair(transition.fromFormationId, transition.toFormationId), transition]));
  const originalOutgoing = duplicate ? project.transitions.find(transition => transition.fromFormationId === original.id) : undefined;
  next.transitions = next.formations.slice(0, -1).map((from, i): Transition => {
    const to = next.formations[i + 1]!;
    const retained = existing.get(pair(from.id, to.id));
    if (retained) return clone(retained);
    if (duplicate && from.id === duplicate.id && originalOutgoing?.toFormationId === to.id) {
      plan.retainedOutgoingMotionCount = originalOutgoing.motions.length;
      return { ...clone(originalOutgoing), fromFormationId: duplicate.id };
    }
    const transition: Transition = { id: createId('transition'), fromFormationId: from.id, toFormationId: to.id, durationSeconds: transitionSeconds, motions: [] };
    plan.newTransitionIds.push(transition.id); return transition;
  });
  plan.newTransitionCount = plan.newTransitionIds.length;
  const retainedTransitionIds = new Set(next.transitions.map(t => t.id));
  for (const transition of project.transitions.filter(t => !retainedTransitionIds.has(t.id))) {
    plan.removedTransitionIds.push(transition.id);
    for (const motion of transition.motions) {
      plan.removedMotionIds.push(motion.id);
      if (motion.type === 'group') plan.removedGroupMotionCount++; else plan.removedSingleMotionCount++;
    }
  }
  plan.durationAfterSeconds = projectDuration(next);
  plan.focusTimeSeconds = formationStartTime(next, plan.focusFormationId!);
  const beforeSegments = segments(project), afterSegments = segments(next);
  const affected = new Set([action.formationId, ...(duplicate ? [duplicate.id] : [])]);
  for (const transition of [...project.transitions.filter(t => plan.removedTransitionIds.includes(t.id)), ...next.transitions.filter(t => plan.newTransitionIds.includes(t.id))]) { affected.add(transition.fromFormationId); affected.add(transition.toFormationId); }
  for (const formation of next.formations) if (project.formations.some(f => f.id === formation.id) && Math.abs(formationStartTime(project, formation.id) - formationStartTime(next, formation.id)) > EPSILON) affected.add(formation.id);
  plan.affectedFormationIds = [...affected];

  for (const event of elements(project)) {
    const follows = ['lift', 'prop', 'note'].includes(event.kind), resolution = options.unmappedEventResolutions?.[event.id];
    const changedContext = contextChanged(event, beforeSegments, afterSegments);
    let delta = 0;
    if (timing === 'follow-choreography' && follows) {
      const mapped = followingDelta(event, beforeSegments, afterSegments);
      if (mapped === null) {
        if (resolution === 'remove') { removeElement(next, event); plan.removedTimedElements.push(event); continue; }
        if (resolution !== 'keep-absolute') { block('event-unmapped', 'Ein zeitgebundenes Element lässt sich nicht unverändert mit dem Abschnitt verschieben. Seine Zeitposition muss bewusst beibehalten oder das Element entfernt werden.', event); continue; }
      } else delta = mapped;
    }
    const nextEnd = (event.endSeconds ?? event.startSeconds) + delta;
    const newlyOutside = ['lift', 'prop'].includes(event.kind) && (event.endSeconds ?? event.startSeconds) <= duration + EPSILON && nextEnd > plan.durationAfterSeconds + EPSILON;
    if (newlyOutside) {
      if (resolution === 'remove') { removeElement(next, event); plan.removedTimedElements.push(event); continue; }
      // Keeping absolute values never truncates or removes phases. This explicit
      // resolution acknowledges that a portion now lies beyond playback's end.
      if (resolution !== 'keep-absolute') { block('event-outside-duration', 'Ein zeitgebundenes Element würde über das neue Projektende hinausreichen. Seine vollständigen Zeitwerte müssen bewusst behalten oder das Element entfernt werden.', event); continue; }
      delta = 0;
    }
    if (Math.abs(delta) > EPSILON) {
      shiftElement(next, event, delta);
      plan.movedTimedElements.push({ ...event, nextStartSeconds: event.startSeconds + delta, ...(event.endSeconds !== undefined ? { nextEndSeconds: event.endSeconds + delta } : {}) });
    } else if (changedContext || newlyOutside) plan.retainedTimedElements.push(event);
  }

  const issues = validateProject(next);
  if (issues.some(issue => issue.message.includes('Überlappende Höhenbefehle'))) block('event-overlap', 'Durch die Verschiebung würden sich Hebephasen derselben Person überschneiden.');
  if (issues.some(issue => !issue.message.includes('Überlappende Höhenbefehle'))) block('project-invalid', 'Die Änderung verletzt eine Projektgrenze oder eine bestehende Bewegungsbeziehung.');
  plan.requiresConfirmation = action.type !== 'duplicate' || plan.removedMotionIds.length > 0 || plan.retainedTimedElements.length > 0 || plan.movedTimedElements.length > 0 || plan.removedTimedElements.length > 0;
  if (!plan.blockers.length) { plan.nextProject = next; plan.command = createProjectCommand(project, next); }
  return plan;
}

/** The user confirms exactly this revision and effect list; stale previews fail. */
export function commitFormationEdit(history: ProjectHistory, plan: FormationEditPlan, options: { acceptImpact: boolean }, actorId = 'local-dev'): ProjectHistory {
  if (history.present.id !== plan.projectId || history.present.revision !== plan.baseRevision) throw new FormationEditError('stale-plan', 'Das Projekt wurde seit der Vorschau verändert. Bitte die Änderung erneut prüfen.');
  if (plan.blockers.length) throw new FormationEditError('blocked-plan', 'Die offenen Auswirkungen müssen vor dem Übernehmen geklärt werden.');
  if (!plan.nextProject) throw new FormationEditError('invalid-plan', 'Die Änderungsvorschau enthält keinen gültigen Projektstand.');
  if (plan.isNoop) return history;
  if (plan.requiresConfirmation && !options.acceptImpact) throw new FormationEditError('confirmation-required', 'Die angezeigten Auswirkungen müssen vor dem Übernehmen bestätigt werden.');
  if (!plan.command || plan.command.baseRevision !== plan.baseRevision) throw new FormationEditError('invalid-plan', 'Die Änderungsvorschau enthält keinen gültigen Befehl.');
  return commitCommand(history, { ...plan.command, actorId });
}
