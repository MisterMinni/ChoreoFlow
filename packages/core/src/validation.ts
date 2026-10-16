import type { Project } from './model';
import { TECHNICAL_LIMITS } from './plans';
import { distance } from './geometry';
import { groupPosition } from './scene';
import { projectDuration } from './time';

export interface ValidationIssue { path: string; message: string }
export class ProjectValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) { super(issues.map(i => `${i.path}: ${i.message}`).join('\n')); this.name = 'ProjectValidationError'; }
}
type Check = (value: unknown, path: string, issues: ValidationIssue[]) => void;
const issue = (issues: ValidationIssue[], path: string, message: string): void => { if (issues.length < 100) issues.push({ path, message }); };
const obj = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (max = 200, min = 0): Check => (v, p, i) => { if (typeof v !== 'string' || v.length > max || v.trim().length < min) issue(i, p, `Text mit ${min} bis ${max} Zeichen erwartet.`); };
const num = (min = 0, max = 3600, integer = false): Check => (v, p, i) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) issue(i, p, `Endliche ${integer ? 'ganze ' : ''}Zahl zwischen ${min} und ${max} erwartet.`); };
const bool: Check = (v, p, i) => { if (typeof v !== 'boolean') issue(i, p, 'Wahrheitswert erwartet.'); };
const oneOf = (...values: (string | number)[]): Check => (v, p, i) => { if (!values.includes(v as string)) issue(i, p, `Erwartet: ${values.join(', ')}.`); };
const optional = (check: Check): Check => (v, p, i) => { if (v !== undefined) check(v, p, i); };
const shape = (fields: Record<string, Check>): Check => (v, p, i) => {
  if (!obj(v)) { issue(i, p, 'Objekt erwartet.'); return; }
  for (const key of Object.keys(v)) if (!Object.prototype.hasOwnProperty.call(fields, key)) issue(i, `${p}.${key}`, 'Unbekanntes Feld.');
  for (const [key, check] of Object.entries(fields)) check(v[key], `${p}.${key}`, i);
};
const array = (check: Check, max = 200, min = 0): Check => (v, p, i) => {
  if (!Array.isArray(v) || v.length > max || v.length < min) { issue(i, p, `Liste mit ${min} bis ${max} Einträgen erwartet.`); return; }
  v.forEach((entry, index) => check(entry, `${p}[${index}]`, i));
};
const id: Check = (v, p, i) => { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v) || ['__proto__', 'constructor', 'prototype'].includes(v)) issue(i, p, 'Ungültige stabile ID.'); };
const map = (check: Check, max = 100): Check => (v, p, i) => {
  if (!obj(v) || Object.keys(v).length > max) { issue(i, p, 'Ungültige Zuordnung.'); return; }
  for (const [key, entry] of Object.entries(v)) { id(key, `${p}.${key}`, i); check(entry, `${p}.${key}`, i); }
};
const color: Check = (v, p, i) => { if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) issue(i, p, 'Farbe im Format #RRGGBB erwartet.'); };
const iso: Check = (v, p, i) => { if (typeof v !== 'string' || v.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v))) issue(i, p, 'ISO-Zeitstempel erwartet.'); };
const vector = shape({ x: num(-1000, 1000), y: num(-1000, 1000), z: num(0, 100) });
const displacement = shape({ x: num(-1000, 1000), y: num(-1000, 1000), z: num(-100, 100) });
const path: Check = (v, p, i) => {
  if (!obj(v)) { issue(i, p, 'Weg erwartet.'); return; }
  const common = { type: oneOf('line', 'arc', 'cubic', 'polyline') };
  if (v.type === 'arc') shape({ ...common, control: vector })(v, p, i);
  else if (v.type === 'cubic') shape({ ...common, control1: vector, control2: vector })(v, p, i);
  else if (v.type === 'polyline') shape({ ...common, points: array(vector, 128) })(v, p, i);
  else shape(common)(v, p, i);
};
const facing: Check = (v, p, i) => {
  if (!obj(v)) { issue(i, p, 'Blickrichtungsverlauf erwartet.'); return; }
  const common = { type: oneOf('fixed', 'along-path', 'interpolate') };
  if (v.type === 'fixed') shape({ ...common, degrees: num(-36000, 36000) })(v, p, i);
  else if (v.type === 'interpolate') shape({ ...common, fromDegrees: num(-36000, 36000), angleDegrees: num(-36000, 36000) })(v, p, i);
  else shape(common)(v, p, i);
};
const motion: Check = (v, p, i) => {
  if (!obj(v)) { issue(i, p, 'Bewegung erwartet.'); return; }
  const common = { id, type: oneOf('individual', 'group'), delaySeconds: num(), durationSeconds: num(0.01), easing: oneOf('linear', 'ease-in-out') };
  if (v.type === 'group') shape({ ...common, personIds: array(id, 100, 1), pivot: vector, angleDegrees: num(-36000, 36000), translation: displacement, scale: shape({ x: num(0.01, 100), y: num(0.01, 100) }), path: optional(path), fanDegrees: optional(num(-36000, 36000)), staggerSeconds: optional(map(num())), rotateFacing: bool })(v, p, i);
  else shape({ ...common, personId: id, path, facing: optional(facing) })(v, p, i);
};
const projectShape = shape({
  schemaVersion: oneOf(1), id, name: text(200, 1), revision: num(0, Number.MAX_SAFE_INTEGER, true), createdAt: iso, updatedAt: iso,
  stage: shape({ width: num(1, 200), depth: num(1, 200), gridSize: num(0.1, 10) }),
  castSource: optional(shape({ id, revision: num(0, Number.MAX_SAFE_INTEGER, true) })),
  people: array(shape({ id, name: text(200, 1), label: text(16, 1), color, radius: num(0.05, 2) }), TECHNICAL_LIMITS.people, 1),
  groups: array(shape({ id, name: text(200, 1), personIds: array(id, 100, 1), color }), 100),
  formations: array(shape({ id, name: text(200, 1), holdSeconds: num(), positions: map(vector), facing: map(num(-36000, 36000)) }), TECHNICAL_LIMITS.formations, 1),
  transitions: array(shape({ id, fromFormationId: id, toFormationId: id, durationSeconds: num(0.01), motions: array(motion, 100) }), 199),
  tempo: shape({ countOffsetSeconds: num(-3600, 3600), marks: array(shape({ id, timeSeconds: num(), bpm: num(10, 400) }), 1000, 1) }),
  audio: shape({ assets: array(shape({ id, name: text(255, 1), mimeType: oneOf('audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/flac'), durationSeconds: num(0.01), sizeBytes: num(0, 1024 * 1024 * 1024, true), localUri: optional(text(2048)) }), TECHNICAL_LIMITS.audioAssets), clips: array(shape({ id, assetId: id, startSeconds: num(), trimStartSeconds: num(), trimEndSeconds: num(0.01), fadeInSeconds: num(), fadeOutSeconds: num(), volume: num(0, 1) }), 1000) }),
  props: array(shape({ id, name: text(200, 1), position: vector, size: shape({ x: num(0.01, 100), y: num(0.01, 100), z: num(0.01, 100) }), rotationDegrees: num(-36000, 36000), startSeconds: num(), endSeconds: num(0.01) }), TECHNICAL_LIMITS.props),
  lifts: array(shape({ id, name: text(200, 1), note: text(10000), roles: array(shape({ personId: id, role: oneOf('base', 'flyer', 'spotter') }), 100, 2), phases: array(shape({ id, type: oneOf('setup', 'raise', 'hold', 'lower'), startSeconds: num(), endSeconds: num(0.01), heights: map(num(0, 20)), contacts: array(shape({ personA: id, personB: id }), 100) }), 100, 1) }), 100),
  notes: array(shape({ id, text: text(10000), timeSeconds: optional(num()) }), TECHNICAL_LIMITS.notes),
  markers: array(shape({ id, name: text(200, 1), timeSeconds: num() }), 1000),
});

export function validateProject(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []; projectShape(value, 'project', issues); if (issues.length) return issues;
  const project = value as Project;
  const seen = new Set<string>();
  const unique = (idValue: string, at: string): void => { if (seen.has(idValue)) issue(issues, at, `Doppelte ID: ${idValue}.`); seen.add(idValue); };
  const people = new Set(project.people.map(p => p.id));
  const refs = (ids: string[], at: string): void => { const local = new Set<string>(); for (const ref of ids) { if (!people.has(ref)) issue(issues, at, `Unbekannte Person: ${ref}.`); if (local.has(ref)) issue(issues, at, `Doppelte Person: ${ref}.`); local.add(ref); } };
  unique(project.id, 'project.id');
  project.people.forEach(p => unique(p.id, 'people'));
  project.groups.forEach(g => { unique(g.id, 'groups'); refs(g.personIds, `groups.${g.id}`); });
  for (const formation of project.formations) {
    unique(formation.id, 'formations'); refs(Object.keys(formation.positions), `formations.${formation.id}.positions`); refs(Object.keys(formation.facing), `formations.${formation.id}.facing`);
    for (const personId of people) {
      if (!Object.prototype.hasOwnProperty.call(formation.positions, personId)) issue(issues, `formations.${formation.id}.positions`, `Position für ${personId} fehlt.`);
      if (!Object.prototype.hasOwnProperty.call(formation.facing, personId)) issue(issues, `formations.${formation.id}.facing`, `Blickrichtung für ${personId} fehlt.`);
    }
  }
  if (project.transitions.length !== project.formations.length - 1) issue(issues, 'transitions', 'Genau ein Übergang zwischen benachbarten Formationen erforderlich.');
  const edges = new Set<string>();
  for (const transition of project.transitions) {
    unique(transition.id, 'transitions');
    const index = project.formations.findIndex(f => f.id === transition.fromFormationId);
    const from = project.formations[index], to = project.formations[index + 1];
    if (!from || !to || to.id !== transition.toFormationId || edges.has(transition.fromFormationId)) { issue(issues, `transitions.${transition.id}`, 'Übergang muss zwei aufeinanderfolgende Formationen eindeutig verbinden.'); continue; }
    edges.add(transition.fromFormationId);
    const assigned = new Set<string>();
    for (const m of transition.motions) {
      unique(m.id, 'motions'); const ids = m.type === 'individual' ? [m.personId] : m.personIds; refs(ids, `motions.${m.id}`);
      for (const personId of ids) { if (assigned.has(personId)) issue(issues, `motions.${m.id}`, 'Überlappende Bewegungsbefehle für dieselbe Person.'); assigned.add(personId); }
      const extraDelay = m.type === 'group' ? Math.max(0, ...Object.values(m.staggerSeconds ?? {})) : 0;
      if (m.delaySeconds + extraDelay + m.durationSeconds > transition.durationSeconds + 1e-8) issue(issues, `motions.${m.id}`, 'Bewegung einschließlich Startversatz passt nicht in den Übergang.');
      if (m.type === 'group') {
        for (const ref of Object.keys(m.staggerSeconds ?? {})) if (!ids.includes(ref)) issue(issues, `motions.${m.id}.staggerSeconds`, 'Startversatz für eine Person außerhalb der Gruppe.');
        for (const personId of ids) if (from.positions[personId] && to.positions[personId] && distance(groupPosition(m, from.positions[personId]!, personId, 1), to.positions[personId]!) > 0.001) issue(issues, `motions.${m.id}`, `Gruppenbewegung endet nicht auf der Zielposition von ${personId}.`);
      }
    }
  }
  project.tempo.marks.forEach((mark, i) => { unique(mark.id, 'tempo'); if ((i === 0 && mark.timeSeconds !== 0) || (i > 0 && mark.timeSeconds <= project.tempo.marks[i - 1]!.timeSeconds)) issue(issues, 'tempo.marks', 'Tempomarken müssen bei 0 beginnen und streng aufsteigend sein.'); });
  project.audio.assets.forEach(a => unique(a.id, 'audio.assets'));
  for (const clip of project.audio.clips) {
    unique(clip.id, 'audio.clips'); const asset = project.audio.assets.find(a => a.id === clip.assetId);
    if (!asset) issue(issues, `audio.clips.${clip.id}`, 'Medienreferenz fehlt.');
    else if (clip.trimEndSeconds > asset.durationSeconds || clip.trimEndSeconds <= clip.trimStartSeconds || clip.fadeInSeconds + clip.fadeOutSeconds > clip.trimEndSeconds - clip.trimStartSeconds) issue(issues, `audio.clips.${clip.id}`, 'Trim- oder Überblendungswerte liegen außerhalb des Clips.');
  }
  const liftIntervals = new Map<string, [number, number][]>();
  for (const lift of project.lifts) {
    unique(lift.id, 'lifts'); const ids = lift.roles.map(r => r.personId); refs(ids, `lifts.${lift.id}.roles`);
    for (let index = 0; index < lift.phases.length; index++) {
      const phase = lift.phases[index]!; unique(phase.id, 'lifts.phases');
      if (phase.endSeconds <= phase.startSeconds || (index > 0 && phase.startSeconds < lift.phases[index - 1]!.endSeconds)) issue(issues, `lifts.${lift.id}`, 'Hebephasen müssen geordnet sein und dürfen sich nicht überschneiden.');
      for (const personId of Object.keys(phase.heights)) {
        if (!ids.includes(personId)) issue(issues, `lifts.${lift.id}.heights`, 'Höhe für eine Person außerhalb der Hebegruppe.');
        const intervals = liftIntervals.get(personId) ?? [];
        if (intervals.some(([a, b]) => a < phase.endSeconds && phase.startSeconds < b)) issue(issues, `lifts.${lift.id}`, 'Überlappende Höhenbefehle für dieselbe Person.');
        intervals.push([phase.startSeconds, phase.endSeconds]); liftIntervals.set(personId, intervals);
      }
      for (const contact of phase.contacts) if (contact.personA === contact.personB || !ids.includes(contact.personA) || !ids.includes(contact.personB)) issue(issues, `lifts.${lift.id}.contacts`, 'Kontakt muss zwei Rollen dieser Hebegruppe verbinden.');
    }
  }
  project.props.forEach(p => { unique(p.id, 'props'); if (p.endSeconds <= p.startSeconds) issue(issues, `props.${p.id}`, 'Ungültiges Anwesenheitsintervall.'); });
  project.notes.forEach(n => unique(n.id, 'notes')); project.markers.forEach(m => unique(m.id, 'markers'));
  if (projectDuration(project) > TECHNICAL_LIMITS.durationSeconds) issue(issues, 'project', `Technische Höchstdauer: ${TECHNICAL_LIMITS.durationSeconds} Sekunden.`);
  return issues;
}
export function assertValidProject(value: unknown): asserts value is Project { const issues = validateProject(value); if (issues.length) throw new ProjectValidationError(issues); }
export function importProject(json: string): Project {
  if (json.length > TECHNICAL_LIMITS.importBytes || new TextEncoder().encode(json).byteLength > TECHNICAL_LIMITS.importBytes) throw new ProjectValidationError([{ path: 'file', message: 'Projektdatei überschreitet 10 MiB.' }]);
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new ProjectValidationError([{ path: 'file', message: 'Keine gültige JSON-Datei.' }]); }
  assertValidProject(value); return value;
}
export function exportProject(project: Project): string { assertValidProject(project); return JSON.stringify(project, null, 2); }
