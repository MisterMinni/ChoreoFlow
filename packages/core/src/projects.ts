import { generateTemplate, vec } from './geometry';
import { groupPosition } from './scene';
import type { GroupMotion, Person, Project } from './model';

let localSequence = 0;
export function createId(prefix = 'id'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now().toString(36)}-${(++localSequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;
}
const COLORS = ['#2563eb', '#e87921', '#8b5cf6', '#0891b2', '#db2777', '#059669'];
export function createProject(name = 'Neue Choreografie', personCount = 8): Project {
  if (!Number.isInteger(personCount) || personCount < 1 || personCount > 100) throw new Error('Eine Besetzung benötigt 1 bis 100 Personen.');
  const now = new Date().toISOString();
  const people: Person[] = Array.from({ length: personCount }, (_, i) => ({ id: createId('person'), name: `Person ${i + 1}`, label: `${i + 1}`, color: COLORS[Math.floor(i / 4) % COLORS.length]!, radius: 0.3 }));
  return {
    schemaVersion: 1, id: createId('project'), name, revision: 0, createdAt: now, updatedAt: now,
    stage: { width: 12, depth: 10, gridSize: 1 }, people, groups: [],
    formations: [{ id: createId('formation'), name: 'Auftakt', holdSeconds: 4, positions: generateTemplate('line', people.map(p => p.id)), facing: Object.fromEntries(people.map(p => [p.id, 0])) }],
    transitions: [], tempo: { countOffsetSeconds: 0, marks: [{ id: createId('tempo'), timeSeconds: 0, bpm: 120 }] },
    audio: { assets: [], clips: [] }, props: [], lifts: [], notes: [], markers: [],
  };
}
/** Reproducible synthetic fixtures: IDs/time are deterministic, never real people. */
export function createDemoProject(kind: 'line' | 'show' | 'stress' = 'show'): Project {
  const n = kind === 'stress' ? 100 : kind === 'show' ? 24 : 8;
  const project = createProject(kind === 'show' ? 'Lichtspiel · Showformation' : kind === 'stress' ? 'Belastung · 100 Personen' : 'Erste Schritte · 8 Personen', n);
  project.id = `demo-${kind}`; project.createdAt = project.updatedAt = '2026-10-16T00:00:00.000Z';
  project.people.forEach((p, i) => { p.id = `person-${i + 1}`; });
  project.tempo.marks[0]!.id = 'tempo-1';
  const ids = project.people.map(p => p.id);
  project.groups = Array.from({ length: Math.ceil(n / 8) }, (_, i) => ({ id: `group-${i + 1}`, name: `Gruppe ${i + 1}`, color: COLORS[i % COLORS.length]!, personIds: ids.slice(i * 8, (i + 1) * 8) }));
  const count = kind === 'stress' ? 200 : 4;
  const templates = ['rows', 'circle', 'v', 'line'] as const;
  project.formations = Array.from({ length: count }, (_, i) => ({ id: `formation-${i + 1}`, name: ['Auftakt', 'Kreis', 'Fächer', 'Finale'][i % 4]!, holdSeconds: kind === 'stress' ? 1 : 4, positions: generateTemplate(templates[i % 4]!, ids, { width: 8, depth: 6, rows: kind === 'stress' ? 10 : 3 }), facing: Object.fromEntries(ids.map(id => [id, 0])) }));
  project.transitions = project.formations.slice(0, -1).map((f, i) => ({ id: `transition-${i + 1}`, fromFormationId: f.id, toFormationId: project.formations[i + 1]!.id, durationSeconds: kind === 'stress' ? 2 : 4, motions: [] }));
  if (kind === 'line') {
    project.formations[0]!.positions = generateTemplate('line', ids, { width: 8 });
    const motion: GroupMotion = { id: 'motion-full-turn', type: 'group', personIds: ids, pivot: vec(), angleDegrees: 360, translation: vec(), scale: { x: 1, y: 1 }, delaySeconds: 0, durationSeconds: 4, easing: 'linear', rotateFacing: true };
    project.transitions[0]!.motions = [motion];
    project.formations[1]!.name = 'Volle Drehung';
    project.formations[1]!.positions = Object.fromEntries(ids.map(id => [id, groupPosition(motion, project.formations[0]!.positions[id]!, id, 1)]));
    project.formations[1]!.facing = Object.fromEntries(ids.map(id => [id, 360]));
  }
  if (kind === 'show') {
    const base = ids[0]!, flyer = ids[1]!, spotter = ids[2]!;
    project.lifts = [{ id: 'lift-1', name: 'Schematische Hebegruppe', note: 'Synthetische Planungsdaten. Keine praktische Hebeanleitung oder Sicherheitsfreigabe.', roles: [{ personId: base, role: 'base' }, { personId: flyer, role: 'flyer' }, { personId: spotter, role: 'spotter' }], phases: [
      { id: 'lift-setup', type: 'setup', startSeconds: 0, endSeconds: 1, heights: { [flyer]: 0 }, contacts: [] },
      { id: 'lift-raise', type: 'raise', startSeconds: 1, endSeconds: 2, heights: { [flyer]: 1 }, contacts: [{ personA: base, personB: flyer }] },
      { id: 'lift-hold', type: 'hold', startSeconds: 2, endSeconds: 3, heights: { [flyer]: 1 }, contacts: [{ personA: base, personB: flyer }] },
      { id: 'lift-lower', type: 'lower', startSeconds: 3, endSeconds: 4, heights: { [flyer]: 0 }, contacts: [{ personA: base, personB: flyer }] },
    ] }];
    // Model a connected group while the formation holds; no isolated floating flyer.
    project.formations[0]!.positions[base] = vec(-3, -2);
    project.formations[0]!.positions[flyer] = vec(-3, -2);
    project.formations[0]!.positions[spotter] = vec(-2.3, -2);
  }
  project.notes = [{ id: 'note-1', text: 'Synthetisches Testprojekt – Namen, Positionen und Zeitwerte können frei bearbeitet werden.', timeSeconds: 0 }];
  project.markers = [{ id: 'marker-1', name: 'Start', timeSeconds: 0 }];
  return project;
}
