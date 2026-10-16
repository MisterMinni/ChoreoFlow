import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProjectCommand, canCreateCast, canCreateProject, canUpload, checkConflicts, CommandConflictError,
  commitProject, countsToSeconds, createDemoProject, createHistory, createProject, createProjectCommand,
  distance, evaluatePath, evaluateScene, exportProject, formationStartTime, generateTemplate, groupPosition,
  importProject, PLAN_LIMITS, planAfterDowngrade, projectDuration, ProjectValidationError, redo,
  secondsToCounts, undo, validateProject, vec,
} from '../src/index';
import type { GroupMotion, IndividualMotion, Project, TemplateType } from '../src/index';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const approx = (a: number, b: number, tolerance = 1e-7): void => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≈ ${b}`);
function twoFormations(count = 3): Project {
  const p = createProject('Test', count);
  p.formations[0]!.holdSeconds = 0;
  p.formations.push({ ...clone(p.formations[0]!), id: 'formation-two', name: 'Ziel', holdSeconds: 1 });
  p.transitions = [{ id: 'transition-test', fromFormationId: p.formations[0]!.id, toFormationId: p.formations[1]!.id, durationSeconds: 4, motions: [] }];
  return p;
}
function rotating(angle: number): { p: Project; motion: GroupMotion } {
  const p = twoFormations();
  const ids = p.people.map(v => v.id);
  p.formations[0]!.positions = generateTemplate('line', ids, { width: 4 });
  const motion: GroupMotion = { id: 'rotation-test', type: 'group', personIds: ids, pivot: vec(), angleDegrees: angle, translation: vec(), scale: { x: 1, y: 1 }, delaySeconds: 0, durationSeconds: 4, easing: 'linear', rotateFacing: true };
  p.transitions[0]!.motions = [motion];
  p.formations[1]!.positions = Object.fromEntries(ids.map(id => [id, groupPosition(motion, p.formations[0]!.positions[id]!, id, 1)]));
  p.formations[1]!.facing = Object.fromEntries(ids.map(id => [id, angle]));
  return { p, motion };
}

for (const angle of [360, -360, 720]) test(`Rigid ${angle}° turn preserves distances, centre and explicit direction`, () => {
  const { p } = rotating(angle); assert.deepEqual(validateProject(p), []);
  for (let time = 0; time < 4; time += 0.125) {
    const scene = evaluateScene(p, time), [left, centre, right] = scene.people;
    approx(distance(left!.position, centre!.position), 2); approx(distance(centre!.position, right!.position), 2);
    approx(distance(left!.position, right!.position), 4); approx(distance(centre!.position, vec()), 0);
    const theta = angle * time / 4 * Math.PI / 180;
    approx(right!.position.x, 2 * Math.cos(theta)); approx(right!.position.y, 2 * Math.sin(theta));
    approx(right!.facingDeg, angle * time / 4);
  }
  const restored = importProject(exportProject(p));
  assert.deepEqual(evaluateScene(restored, 0.5), evaluateScene(p, 0.5));
  assert.equal((restored.transitions[0]!.motions[0] as GroupMotion).angleDegrees, angle);
});

test('Combined translation and rotation derives every point from original offsets', () => {
  const { p, motion } = rotating(360); motion.translation = vec(4, 2);
  for (const person of p.people) p.formations[1]!.positions[person.id] = groupPosition(motion, p.formations[0]!.positions[person.id]!, person.id, 1);
  const scene = evaluateScene(p, 2); approx(scene.people[1]!.position.x, 2); approx(scene.people[1]!.position.y, 1);
  approx(distance(scene.people[0]!.position, scene.people[2]!.position), 4);
});

test('Fan and delayed subgroups are deterministic with stable assignments', () => {
  const { p, motion } = rotating(90); motion.fanDegrees = 45; motion.durationSeconds = 3;
  motion.staggerSeconds = { [p.people[0]!.id]: 1 };
  for (const person of p.people) p.formations[1]!.positions[person.id] = groupPosition(motion, p.formations[0]!.positions[person.id]!, person.id, 1);
  assert.deepEqual(validateProject(p), []);
  const first = evaluateScene(p, 0.5), second = evaluateScene(p, 0.5);
  assert.deepEqual(first, second); assert.deepEqual(first.people.map(p => p.personId), p.people.map(p => p.id));
  assert.deepEqual(first.people[0]!.position, p.formations[0]!.positions[p.people[0]!.id]);
  assert.notDeepEqual(first.people[2]!.position, p.formations[0]!.positions[p.people[2]!.id]);
});

test('Curve samples move at constant physical speed and polyline respects segment lengths', () => {
  const path = { type: 'cubic', control1: vec(-5, 8), control2: vec(3, -7) } as const;
  const start = vec(-4, -1), end = vec(4, 1);
  const steps = Array.from({ length: 100 }, (_, i) => distance(evaluatePath(path, start, end, i / 100), evaluatePath(path, start, end, (i + 1) / 100)));
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
  assert.ok(Math.max(...steps) - Math.min(...steps) < mean * 0.03);
  const point = evaluatePath({ type: 'polyline', points: [vec(1, 0)] }, vec(), vec(1, 3), 0.5);
  approx(point.x, 1); approx(point.y, 1);
});

test('Every template preserves order, finite coordinates and person identities', () => {
  const types: TemplateType[] = ['line', 'rows', 'block', 'circle', 'semicircle', 'v', 'inverted-v', 'diagonal', 'double-diagonal'];
  for (const type of types) for (const count of [1, 2, 8, 24, 100]) {
    const ids = Array.from({ length: count }, (_, i) => `p${i}`), positions = generateTemplate(type, ids);
    assert.deepEqual(Object.keys(positions), ids);
    assert.ok(Object.values(positions).every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.z === 0));
  }
});

test('Curve control edits invalidate cached parameter tables', () => {
  const path = { type: 'arc' as const, control: vec(-4, 8) };
  evaluatePath(path, vec(), vec(4, 0), 0.5);
  path.control = vec(8, -4);
  assert.deepEqual(evaluatePath(path, vec(), vec(4, 0), 0.5), evaluatePath(clone(path), vec(), vec(4, 0), 0.5));
});

test('Rigid transformations preserve pairwise distance for varied pivots and unwrapped angles', () => {
  let seed = 42;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 100; i++) {
    const a = vec(random() * 8 - 4, random() * 8 - 4), b = vec(random() * 8 - 4, random() * 8 - 4);
    const motion: GroupMotion = { id: 'm', type: 'group', personIds: ['a', 'b'], pivot: vec(random() * 4 - 2, random() * 4 - 2), angleDegrees: random() * 2880 - 1440, translation: vec(random() * 4, random() * 4), scale: { x: 1, y: 1 }, delaySeconds: 0, durationSeconds: 4, easing: 'linear', rotateFacing: true };
    const progress = random();
    approx(distance(groupPosition(motion, a, 'a', progress), groupPosition(motion, b, 'b', progress)), distance(a, b));
  }
});

test('Tempo changes and offsets invert without accumulating frame rounding', () => {
  const tempo = { countOffsetSeconds: 2, marks: [{ id: 'a', timeSeconds: 0, bpm: 120 }, { id: 'b', timeSeconds: 10, bpm: 90 }, { id: 'c', timeSeconds: 25, bpm: 145 }] };
  approx(secondsToCounts(tempo, 2), 0); approx(secondsToCounts(tempo, 12), 19);
  for (const t of [-2, 0, 1.23, 10, 23.57, 600]) approx(countsToSeconds(tempo, secondsToCounts(tempo, t)), t, 1e-9);
});

test('Formation holds, transition endpoints and timeline bounds agree', () => {
  const p = createDemoProject('line');
  assert.equal(projectDuration(p), 28); assert.equal(formationStartTime(p, p.formations[1]!.id), 8);
  assert.equal(evaluateScene(p, 3.99).transitionId, null); assert.equal(evaluateScene(p, 4).transitionId, p.transitions[0]!.id);
  assert.equal(evaluateScene(p, 8).formationId, p.formations[1]!.id);
  assert.equal(evaluateScene(p, -20).timeSeconds, 0); assert.equal(evaluateScene(p, 2000).timeSeconds, 28);
});

test('JSON roundtrip preserves full show, phases, identities and stress fixture', () => {
  for (const kind of ['line', 'show', 'stress'] as const) {
    const p = createDemoProject(kind); assert.deepEqual(validateProject(p), []);
    assert.deepEqual(importProject(exportProject(p)), p);
  }
  const stress = createDemoProject('stress'); assert.equal(stress.people.length, 100); assert.equal(stress.formations.length, 200); assert.equal(projectDuration(stress), 598);
});

test('Import rejects version errors, duplicate IDs, missing references and invalid numeric payloads', () => {
  const p = createDemoProject('line');
  const bad: unknown[] = [null, [], { ...p, schemaVersion: 2 }, { ...p, revision: -1 }, { ...p, stage: { ...p.stage, width: Infinity } }, { ...p, people: [p.people[0], p.people[0]] }, { ...p, formations: [{ ...p.formations[0], positions: {} }] }, { ...p, formations: [{ ...p.formations[0], facing: {} }] }, { ...p, unexpectedCode: 'alert(1)' }];
  for (const value of bad) assert.throws(() => importProject(JSON.stringify(value)), ProjectValidationError);
  const polluted = exportProject(p).replace('"schemaVersion": 1,', '"schemaVersion": 1, "__proto__": {"polluted":true},');
  assert.throws(() => importProject(polluted), ProjectValidationError);
  assert.throws(() => importProject('not-json'), ProjectValidationError);
  const missingMedia = clone(p); missingMedia.audio.clips = [{ id: 'clip', assetId: 'unknown', startSeconds: 0, trimStartSeconds: 0, trimEndSeconds: 1, fadeInSeconds: 0, fadeOutSeconds: 0, volume: 1 }];
  assert.ok(validateProject(missingMedia).some(i => i.message.includes('Medienreferenz')));
});

test('Overlapping person motions and group endpoint jumps fail validation', () => {
  const { p, motion } = rotating(360);
  p.transitions[0]!.motions.push({ ...clone(motion), id: 'duplicate-motion' });
  assert.ok(validateProject(p).some(i => i.message.includes('Überlappende')));
  p.transitions[0]!.motions.pop(); p.formations[1]!.positions[p.people[0]!.id]!.x += 1;
  assert.ok(validateProject(p).some(i => i.message.includes('Zielposition')));
});

function crossing(delayed = false, fast = false): Project {
  const p = twoFormations(2), [a, b] = p.people.map(p => p.id);
  p.formations[0]!.positions = { [a!]: vec(-4, 0), [b!]: vec(0, -4) };
  p.formations[1]!.positions = { [a!]: vec(4, 0), [b!]: vec(0, 4) };
  p.transitions[0]!.durationSeconds = delayed ? 3 : 1;
  const motion = (personId: string, delaySeconds: number): IndividualMotion => ({ id: `motion-${personId}`, type: 'individual', personId, path: { type: 'line' }, delaySeconds, durationSeconds: fast ? 0.01 : 1, easing: 'linear' });
  p.transitions[0]!.motions = [motion(a!, fast ? 0.245 : 0), motion(b!, delayed ? 2 : fast ? 0.245 : 0)];
  return p;
}
test('Geometric path crossing at different times is not a person conflict', () => {
  const conflicts = checkConflicts(crossing(true)); assert.equal(conflicts.filter(c => c.kind === 'person-distance').length, 0);
});
test('Simultaneous and 10ms high-speed crossings cannot fall between sample frames', () => {
  for (const fast of [false, true]) {
    const conflicts = checkConflicts(crossing(false, fast));
    const crossingConflict = conflicts.find(c => c.kind === 'person-distance'); assert.ok(crossingConflict);
    const expected = fast ? 0.25 : 0.5;
    assert.ok(crossingConflict.startSeconds < expected && crossingConflict.endSeconds > expected);
    assert.ok(crossingConflict.minimumDistance < 0.1);
  }
});
test('Approved lift contacts only suppress the named pair in the explicit phase', () => {
  const p = createDemoProject('show'), [a, b, outsider] = p.people;
  p.formations[0]!.positions[outsider!.id] = clone(p.formations[0]!.positions[a!.id]!);
  const before = checkConflicts(p, { startSeconds: 0, endSeconds: 0.5 });
  assert.ok(before.some(c => c.personIds.includes(a!.id) && c.personIds.includes(b!.id)));
  const during = checkConflicts(p, { startSeconds: 1, endSeconds: 1.2 });
  assert.ok(!during.some(c => c.personIds.includes(a!.id) && c.personIds.includes(b!.id)));
  assert.ok(during.some(c => c.personIds.includes(a!.id) && c.personIds.includes(outsider!.id)));
});

test('Requisite boxes and stage edges are checked in their active time windows', () => {
  const p = createProject('Prop test', 1), id = p.people[0]!.id;
  p.formations[0]!.positions[id] = vec(5.9, 0);
  p.props = [{ id: 'prop', name: 'Podest', position: vec(5.9, 0), size: vec(1, 1, 1), rotationDegrees: 45, startSeconds: 2, endSeconds: 4 }];
  const before = checkConflicts(p, { startSeconds: 0, endSeconds: 1 });
  assert.ok(before.some(c => c.kind === 'stage-edge')); assert.ok(!before.some(c => c.kind === 'prop'));
  const during = checkConflicts(p, { startSeconds: 2, endSeconds: 3 });
  assert.ok(during.some(c => c.kind === 'prop' && c.objectId === 'prop'));
});

test('First lift phase above the floor retains a conservative vertical speed bound', () => {
  const p = createProject('Height test', 2), [a, b] = p.people.map(person => person.id);
  p.formations[0]!.positions = { [a!]: vec(0, 0, 10), [b!]: vec(0, 0, 8.7) };
  p.lifts = [{ id: 'lift', name: 'Height change', note: '', roles: [{ personId: a!, role: 'flyer' }, { personId: b!, role: 'spotter' }], phases: [{ id: 'phase', type: 'lower', startSeconds: 0, endSeconds: 1, heights: { [a!]: 0 }, contacts: [] }] }];
  const result = checkConflicts(p, { startSeconds: 0, endSeconds: 1 }).find(c => c.kind === 'person-distance');
  assert.ok(result); assert.ok(result.startSeconds <= 0.13 && result.endSeconds >= 0.13);
});

test('Committed gesture is one serializable undo step and survives restart', () => {
  const p = createProject(), next = clone(p); next.formations[0]!.positions[p.people[0]!.id]!.x = 2;
  let history = commitProject(createHistory(p), next);
  assert.equal(history.undoStack.length, 1); history = clone(history);
  history = undo(history); assert.deepEqual(history.present.formations, p.formations);
  history = redo(history); assert.deepEqual(history.present.formations, next.formations);
  assert.equal(history.present.revision, 3);
});
test('Independent stale edits merge while conflicting edits and foreign undo fail visibly', () => {
  const p = createProject(), own = clone(p), foreign = clone(p);
  own.people[0]!.name = 'Eigene Änderung'; foreign.people[1]!.name = 'Andere Person';
  const history = commitProject(createHistory(p), own, 'owner');
  const merged = applyProjectCommand(history.present, createProjectCommand(p, foreign, 'guest'));
  const undone = undo({ ...history, present: merged }, 'owner');
  assert.equal(undone.present.people[0]!.name, p.people[0]!.name); assert.equal(undone.present.people[1]!.name, 'Andere Person');
  assert.throws(() => undo(history, 'guest'));
  const conflict = clone(history.present); conflict.people[0]!.name = 'Gleiches Objekt';
  const changed = applyProjectCommand(history.present, createProjectCommand(history.present, conflict, 'guest'));
  assert.throws(() => undo({ ...history, present: changed }, 'owner'), CommandConflictError);
});
test('Plan limits remain central and downgrade preserves every project', () => {
  assert.equal(canCreateProject('free', 3), false); assert.equal(canCreateProject('pro', 100000), true);
  assert.equal(canCreateCast('free', 2), true); assert.equal(canCreateCast('free', 3), false);
  assert.equal(canUpload('free', PLAN_LIMITS.free.cloudStorageBytes, 1), false);
  const result = planAfterDowngrade(['a', 'b', 'c', 'd'], ['b', 'c', 'd']);
  assert.deepEqual(result, { active: ['b', 'c', 'd'], readOnly: ['a'] });
  assert.equal(PLAN_LIMITS.pro.additionalEditors, 4); assert.equal(PLAN_LIMITS.free.videoHeight, 720);
});
