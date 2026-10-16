import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProjectCommand, CommandConflictError, commitFormationEdit, commitProject, createDemoProject, createHistory, createProject, createProjectCommand,
  evaluateScene, FormationEditError, formationStartTime, groupPosition, prepareFormationEdit,
  projectDuration, redo, undo, validateProject, vec,
  type FormationEditPlan, type GroupMotion, type Lift, type Project,
} from '../src/index';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fixture(count = 4): Project {
  const project = createProject('Formationsaktionen', 3), source = project.formations[0]!;
  project.formations = Array.from({ length: count }, (_, index) => ({ ...clone(source), id: `f${index + 1}`, name: `Formation ${index + 1}`, holdSeconds: 2 }));
  project.transitions = project.formations.slice(0, -1).map((formation, index) => ({ id: `t${index + 1}`, fromFormationId: formation.id, toFormationId: project.formations[index + 1]!.id, durationSeconds: 2, motions: [] }));
  return project;
}
function ready(plan: FormationEditPlan): Project {
  assert.deepEqual(plan.blockers, []); assert.ok(plan.nextProject); assert.ok(plan.command || plan.isNoop);
  assert.deepEqual(validateProject(plan.nextProject), []); return plan.nextProject;
}
function rotation(project: Project, angle: number): void {
  const motion: GroupMotion = { id: 'full-turn', type: 'group', personIds: project.people.map(person => person.id), pivot: vec(), angleDegrees: angle, translation: vec(), scale: { x: 1, y: 1 }, delaySeconds: 0, durationSeconds: 2, easing: 'linear', rotateFacing: true };
  project.transitions[0]!.motions = [motion];
  for (const person of project.people) {
    project.formations[1]!.positions[person.id] = groupPosition(motion, project.formations[0]!.positions[person.id]!, person.id, 1);
    project.formations[1]!.facing[person.id] = angle;
  }
}
function lift(project: Project, start: number, end: number, id = 'lift-1'): Lift {
  return { id, name: 'Test-Hebegruppe', note: '', roles: [{ personId: project.people[0]!.id, role: 'base' }, { personId: project.people[1]!.id, role: 'flyer' }], phases: [{ id: `${id}-phase`, type: 'hold', startSeconds: start, endSeconds: end, heights: { [project.people[1]!.id]: 1 }, contacts: [{ personA: project.people[0]!.id, personB: project.people[1]!.id }] }] };
}

for (const index of [0, 1, 3]) test(`Duplicate formation at index ${index} preserves identities and only creates a copy plus one edge`, () => {
  const project = fixture(), before = clone(project), selected = project.formations[index]!;
  const plan = prepareFormationEdit(project, { type: 'duplicate', formationId: selected.id }, { newTransitionSeconds: 2 });
  const next = ready(plan), copied = next.formations[index + 1]!;
  assert.deepEqual(project, before); assert.notEqual(copied.id, selected.id); assert.equal(plan.focusFormationId, copied.id);
  assert.deepEqual(copied.positions, selected.positions); assert.deepEqual(copied.facing, selected.facing); assert.equal(copied.holdSeconds, selected.holdSeconds);
  assert.deepEqual(next.people, project.people); assert.deepEqual(next.groups, project.groups);
  assert.equal(plan.newTransitionCount, 1); assert.deepEqual(plan.removedTransitionIds, []);
  assert.equal(plan.durationAfterSeconds, plan.durationBeforeSeconds + 4);
  assert.equal(plan.focusTimeSeconds, formationStartTime(next, copied.id));
  assert.deepEqual(next.formations.filter(f => f.id !== copied.id), project.formations);
  copied.positions[project.people[0]!.id]!.x += 1;
  assert.deepEqual(project, before);
});

for (const angle of [360, -360, 720]) test(`Duplicate retains the outgoing ${angle}° rotation with stable motion ID`, () => {
  const project = fixture(); rotation(project, angle);
  const originalMotion = clone(project.transitions[0]!.motions[0]);
  const plan = prepareFormationEdit(project, { type: 'duplicate', formationId: 'f1' }, { newTransitionSeconds: 2 });
  const next = ready(plan), retained = next.transitions.find(t => t.id === 't1')!;
  assert.equal(retained.fromFormationId, plan.focusFormationId); assert.equal(retained.toFormationId, 'f2');
  assert.deepEqual(retained.motions[0], originalMotion); assert.equal(plan.retainedOutgoingMotionCount, 1);
  assert.equal(plan.removedGroupMotionCount, 0);
  for (const time of [2, 2.25, 2.5, 3, 3.75]) assert.deepEqual(evaluateScene(next, time + 4).people, evaluateScene(project, time).people);
});

for (const id of ['f1', 'f2', 'f4']) test(`Deleting ${id} leaves valid neighbours and selects the next or previous formation`, () => {
  const project = fixture(), plan = prepareFormationEdit(project, { type: 'delete', formationId: id }, { newTransitionSeconds: 2 });
  const next = ready(plan); assert.equal(next.formations.length, 3); assert.ok(next.formations.every(f => f.id !== id));
  assert.equal(plan.focusFormationId, id === 'f1' ? 'f2' : 'f3');
  assert.equal(plan.focusTimeSeconds, formationStartTime(next, plan.focusFormationId!));
  assert.equal(plan.newTransitionCount, id === 'f2' ? 1 : 0);
  if (id === 'f2') { assert.deepEqual(plan.removedTransitionIds, ['t1', 't2']); assert.equal(next.transitions[0]!.fromFormationId, 'f1'); assert.equal(next.transitions[0]!.toFormationId, 'f3'); }
  assert.ok(next.transitions.some(t => t.id === (id === 'f4' ? 't1' : 't3')));
});

test('Moving a formation retains only the exact directed adjacent pairs and never reassigns old motions', () => {
  const project = fixture(5); rotation(project, 720);
  project.transitions[1]!.motions = [{ id: 'curve-1', type: 'individual', personId: project.people[0]!.id, path: { type: 'arc', control: vec(1, 2) }, delaySeconds: 0, durationSeconds: 2, easing: 'linear' }];
  const plan = prepareFormationEdit(project, { type: 'move', formationId: 'f2', beforeFormationId: 'f5' }, { newTransitionSeconds: 2 });
  const next = ready(plan);
  assert.deepEqual(next.formations.map(f => f.id), ['f1', 'f3', 'f4', 'f2', 'f5']);
  assert.deepEqual(next.transitions.find(t => t.id === 't3'), project.transitions[2]);
  assert.deepEqual(plan.removedTransitionIds, ['t1', 't2', 't4']);
  assert.equal(plan.removedGroupMotionCount, 1); assert.equal(plan.removedSingleMotionCount, 1);
  assert.deepEqual(plan.removedMotionIds, ['full-turn', 'curve-1']); assert.equal(plan.newTransitionCount, 3);
  assert.ok(next.transitions.filter(t => plan.newTransitionIds.includes(t.id)).every(t => t.motions.length === 0));
  assert.equal(plan.focusFormationId, 'f2'); assert.equal(plan.focusTimeSeconds, 12);
  const history = createHistory(project);
  assert.throws(() => commitFormationEdit(history, plan, { acceptImpact: false }), (error: unknown) => error instanceof FormationEditError && error.code === 'confirmation-required');
  const changed = commitFormationEdit(history, plan, { acceptImpact: true });
  assert.equal(changed.undoStack.length, 1); assert.deepEqual(changed.present.formations, next.formations);
});

test('Move to end and first position works; already adjacent or self moves are no-ops', () => {
  const project = fixture();
  const end = ready(prepareFormationEdit(project, { type: 'move', formationId: 'f1', beforeFormationId: null }));
  assert.deepEqual(end.formations.map(f => f.id), ['f2', 'f3', 'f4', 'f1']);
  const first = ready(prepareFormationEdit(project, { type: 'move', formationId: 'f4', beforeFormationId: 'f1' }));
  assert.deepEqual(first.formations.map(f => f.id), ['f4', 'f1', 'f2', 'f3']);
  for (const action of [{ type: 'move' as const, formationId: 'f2', beforeFormationId: 'f3' }, { type: 'move' as const, formationId: 'f2', beforeFormationId: 'f2' }, { type: 'move' as const, formationId: 'f4', beforeFormationId: null }]) {
    const plan = prepareFormationEdit(project, action), history = createHistory(project);
    assert.equal(plan.isNoop, true); assert.equal(plan.command, null); assert.deepEqual(ready(plan), project);
    assert.strictEqual(commitFormationEdit(history, plan, { acceptImpact: false }), history);
  }
});

test('Absolute time preserves music and complete lift phases while reporting changed context', () => {
  const project = fixture(); project.lifts = [lift(project, 4.25, 5.75)];
  project.props = [{ id: 'prop-1', name: 'Podest', position: vec(), size: vec(1, 1, 1), rotationDegrees: 0, startSeconds: 4, endSeconds: 6 }];
  project.notes = [{ id: 'note-1', text: 'Notiz', timeSeconds: 5 }]; project.markers = [{ id: 'marker-1', name: 'Musik', timeSeconds: 5 }];
  project.tempo.marks.push({ id: 'tempo-2', timeSeconds: 5, bpm: 140 });
  project.audio = { assets: [{ id: 'audio-1', name: 'Test', mimeType: 'audio/wav', durationSeconds: 10, sizeBytes: 100 }], clips: [{ id: 'clip-1', assetId: 'audio-1', startSeconds: 4, trimStartSeconds: 0, trimEndSeconds: 2, fadeInSeconds: 0, fadeOutSeconds: 0, volume: 1 }] };
  const plan = prepareFormationEdit(project, { type: 'duplicate', formationId: 'f1' }, { timing: 'keep-absolute', newTransitionSeconds: 2 });
  const next = ready(plan);
  for (const key of ['lifts', 'props', 'notes', 'markers', 'tempo', 'audio'] as const) assert.deepEqual(next[key], project[key]);
  assert.deepEqual(new Set(plan.retainedTimedElements.map(e => e.kind)), new Set(['lift', 'prop', 'note', 'marker', 'audio', 'tempo']));
  assert.equal(plan.requiresConfirmation, true); assert.equal(next.lifts.length, 1);
});

test('Following choreography moves an entire lift, prop and note while audio/tempo/markers stay fixed', () => {
  const project = fixture(); project.lifts = [lift(project, 4.25, 5.75)];
  project.props = [{ id: 'prop-1', name: 'Podest', position: vec(), size: vec(1, 1, 1), rotationDegrees: 0, startSeconds: 4, endSeconds: 6 }];
  project.notes = [{ id: 'note-1', text: 'Notiz', timeSeconds: 5 }]; project.markers = [{ id: 'marker-1', name: 'Musik', timeSeconds: 5 }];
  const plan = prepareFormationEdit(project, { type: 'duplicate', formationId: 'f1' }, { timing: 'follow-choreography', newTransitionSeconds: 2 });
  const next = ready(plan);
  assert.equal(next.lifts[0]!.phases[0]!.startSeconds, 8.25); assert.equal(next.lifts[0]!.phases[0]!.endSeconds, 9.75);
  assert.deepEqual(next.lifts[0]!.roles, project.lifts[0]!.roles); assert.deepEqual(next.lifts[0]!.phases[0]!.contacts, project.lifts[0]!.phases[0]!.contacts);
  assert.equal(next.props[0]!.startSeconds, 8); assert.equal(next.notes[0]!.timeSeconds, 9);
  assert.deepEqual(next.markers, project.markers); assert.deepEqual(next.tempo, project.tempo); assert.deepEqual(next.audio, project.audio);
  assert.equal(plan.movedTimedElements.length, 3);
});

test('Absolute-time preview reports changed progress even when an event still lies in the same transition', () => {
  const project = fixture(2); project.transitions[0]!.durationSeconds = 100;
  project.notes = [{ id: 'note-in-long-transition', text: 'Zeitlich gebundene Notiz', timeSeconds: 50 }];
  const plan = prepareFormationEdit(project, { type: 'duplicate', formationId: 'f1' }, { newTransitionSeconds: 0.01 });
  ready(plan); assert.ok(plan.retainedTimedElements.some(event => event.id === 'note-in-long-transition'));
});

test('A multi-phase lift spanning retained contiguous segments shifts without stretching phases or gaps', () => {
  const project = fixture(); project.lifts = [lift(project, 4.25, 5.5)];
  project.lifts[0]!.phases.push({ ...clone(project.lifts[0]!.phases[0]!), id: 'phase-2', type: 'lower', startSeconds: 7, endSeconds: 9.5, heights: { [project.people[1]!.id]: 0 } });
  const plan = prepareFormationEdit(project, { type: 'duplicate', formationId: 'f1' }, { timing: 'follow-choreography', newTransitionSeconds: 2 });
  const next = ready(plan);
  assert.deepEqual(next.lifts[0]!.phases.map(p => [p.startSeconds, p.endSeconds]), [[8.25, 9.5], [11, 13.5]]);
});

test('Splitting a lift across insertion creates a blocker; explicit keep or remove resolves it', () => {
  const project = fixture(); project.lifts = [lift(project, 1, 5)];
  const action = { type: 'duplicate' as const, formationId: 'f1' };
  const blocked = prepareFormationEdit(project, action, { timing: 'follow-choreography', newTransitionSeconds: 2 });
  assert.equal(blocked.nextProject, null); assert.equal(blocked.command, null);
  assert.ok(blocked.blockers.some(b => b.code === 'event-unmapped' && b.eventId === 'lift-1'));
  assert.throws(() => commitFormationEdit(createHistory(project), blocked, { acceptImpact: true }), FormationEditError);
  const kept = ready(prepareFormationEdit(project, action, { timing: 'follow-choreography', newTransitionSeconds: 2, unmappedEventResolutions: { 'lift-1': 'keep-absolute' } }));
  assert.deepEqual(kept.lifts, project.lifts);
  const removedPlan = prepareFormationEdit(project, action, { timing: 'follow-choreography', newTransitionSeconds: 2, unmappedEventResolutions: { 'lift-1': 'remove' } });
  assert.equal(ready(removedPlan).lifts.length, 0); assert.equal(removedPlan.removedTimedElements[0]!.id, 'lift-1'); assert.equal(removedPlan.requiresConfirmation, true);
});

test('Deleting a lift anchor cannot silently move or drop that lift', () => {
  const project = fixture(); project.lifts = [lift(project, 4.25, 5.75)];
  const plan = prepareFormationEdit(project, { type: 'delete', formationId: 'f2' }, { timing: 'follow-choreography', newTransitionSeconds: 2 });
  assert.ok(plan.blockers.some(b => b.code === 'event-unmapped')); assert.equal(plan.command, null);
  assert.equal(project.lifts.length, 1);
});

test('Newly unreachable lift phases block deletion until full values or removal are explicitly chosen', () => {
  const project = fixture(); project.lifts = [lift(project, 12.25, 13.75)];
  const action = { type: 'delete' as const, formationId: 'f4' };
  const blocked = prepareFormationEdit(project, action);
  assert.ok(blocked.blockers.some(b => b.code === 'event-outside-duration'));
  const kept = ready(prepareFormationEdit(project, action, { unmappedEventResolutions: { 'lift-1': 'keep-absolute' } }));
  assert.deepEqual(kept.lifts, project.lifts);
  const removed = ready(prepareFormationEdit(project, action, { unmappedEventResolutions: { 'lift-1': 'remove' } }));
  assert.equal(removed.lifts.length, 0);
});

test('Following and keeping mixed lift anchors cannot create overlapping height commands', () => {
  const project = fixture(); project.lifts = [lift(project, 0.25, 1.75, 'lift-a'), lift(project, 4.25, 6.25, 'lift-b')];
  const plan = prepareFormationEdit(project, { type: 'move', formationId: 'f2', beforeFormationId: 'f1' }, { timing: 'follow-choreography', newTransitionSeconds: 2, unmappedEventResolutions: { 'lift-b': 'keep-absolute' } });
  assert.ok(plan.blockers.some(blocker => blocker.code === 'event-overlap')); assert.equal(plan.command, null);
  assert.deepEqual(project.lifts.map(l => l.phases[0]!.startSeconds), [0.25, 4.25]);
});

test('Structural operations remain one serializable undo step with full restoration', () => {
  for (const action of [{ type: 'duplicate' as const, formationId: 'f2' }, { type: 'delete' as const, formationId: 'f2' }, { type: 'move' as const, formationId: 'f2', beforeFormationId: null }]) {
    const project = fixture(); rotation(project, -360); project.lifts = [lift(project, 4.25, 5.75)];
    const plan = prepareFormationEdit(project, action, { newTransitionSeconds: 2 });
    ready(plan); let history = commitFormationEdit(createHistory(project), clone(plan), { acceptImpact: true }, 'trainer');
    assert.equal(history.undoStack.length, 1); assert.equal(history.undoStack[0]!.actorId, 'trainer');
    const after = clone(history.present); history = clone(history); history = undo(history, 'trainer');
    assert.deepEqual(history.present.formations, project.formations); assert.deepEqual(history.present.transitions, project.transitions); assert.deepEqual(history.present.lifts, project.lifts);
    history = redo(history, 'trainer'); assert.deepEqual(history.present.formations, after.formations); assert.deepEqual(history.present.transitions, after.transitions);
  }
});

test('Explicit event removal is one undoable command and restores every lift phase and contact', () => {
  const project = fixture(); project.lifts = [lift(project, 4.25, 5.75)];
  const plan = prepareFormationEdit(project, { type: 'delete', formationId: 'f2' }, { timing: 'follow-choreography', newTransitionSeconds: 2, unmappedEventResolutions: { 'lift-1': 'remove' } });
  let history = commitFormationEdit(createHistory(project), plan, { acceptImpact: true });
  assert.equal(history.present.lifts.length, 0); assert.equal(history.undoStack.length, 1);
  history = undo(clone(history)); assert.deepEqual(history.present.lifts, project.lifts);
  history = redo(history); assert.equal(history.present.lifts.length, 0);
});

test('Structural undo preserves independent foreign edits and refuses to replace changed formation data', () => {
  const project = fixture(), plan = prepareFormationEdit(project, { type: 'duplicate', formationId: 'f2' });
  const history = commitFormationEdit(createHistory(project), plan, { acceptImpact: true }, 'owner');
  const renamed = clone(history.present); renamed.people[0]!.name = 'Andere Traineränderung';
  const independent = applyProjectCommand(history.present, createProjectCommand(history.present, renamed, 'guest'));
  const restored = undo({ ...history, present: independent }, 'owner');
  assert.equal(restored.present.people[0]!.name, 'Andere Traineränderung'); assert.deepEqual(restored.present.formations, project.formations);
  const moved = clone(history.present); moved.formations[0]!.positions[project.people[0]!.id]!.x += 1;
  const conflicting = applyProjectCommand(history.present, createProjectCommand(history.present, moved, 'guest'));
  assert.throws(() => undo({ ...history, present: conflicting }, 'owner'), CommandConflictError);
});

test('A different project or any changed revision rejects the preview instead of overwriting it', () => {
  const project = fixture(), history = createHistory(project), plan = prepareFormationEdit(project, { type: 'duplicate', formationId: 'f1' });
  const unrelated = clone(project); unrelated.people[0]!.name = 'Neue Person';
  const updated = commitProject(history, unrelated);
  assert.throws(() => commitFormationEdit(updated, plan, { acceptImpact: true }), (error: unknown) => error instanceof FormationEditError && error.code === 'stale-plan');
  assert.throws(() => commitFormationEdit(createHistory(fixture()), plan, { acceptImpact: true }), FormationEditError);
});

test('Last formation, maximum count, unknown targets and invalid durations are rejected before edits', () => {
  const single = fixture(1); assert.equal(prepareFormationEdit(single, { type: 'delete', formationId: 'f1' }).blockers[0]!.code, 'last-formation');
  const full = createDemoProject('stress'); assert.equal(prepareFormationEdit(full, { type: 'duplicate', formationId: full.formations[0]!.id }).blockers[0]!.code, 'formation-limit');
  const project = fixture();
  assert.equal(prepareFormationEdit(project, { type: 'delete', formationId: 'missing' }).blockers[0]!.code, 'formation-not-found');
  assert.equal(prepareFormationEdit(project, { type: 'move', formationId: 'f1', beforeFormationId: 'missing' }).blockers[0]!.code, 'target-not-found');
  for (const duration of [0, -1, Infinity, NaN, 3601]) assert.ok(prepareFormationEdit(project, { type: 'duplicate', formationId: 'f1' }, { newTransitionSeconds: duration }).blockers.some(b => b.code === 'invalid-duration'));
  assert.equal(projectDuration(project), 14);
});
