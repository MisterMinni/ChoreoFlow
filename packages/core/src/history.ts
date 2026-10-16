import type { Project } from './model';
import { createId } from './projects';
import { assertValidProject } from './validation';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface ProjectChange { path: string[]; before: JsonValue; after: JsonValue; beforeExists: boolean; afterExists: boolean }
export interface ProjectCommand { schemaVersion: 1; id: string; actorId: string; baseRevision: number; createdAt: string; type: 'patch-project'; affectedObjects: string[]; changes: ProjectChange[] }
export interface ProjectHistory { present: Project; undoStack: ProjectCommand[]; redoStack: ProjectCommand[] }
export class CommandConflictError extends Error { constructor(public readonly path: string[]) { super(`Dieses Objekt wurde inzwischen geändert: ${path.join('/')}. Änderung bitte prüfen.`); this.name = 'CommandConflictError'; } }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const record = (value: unknown): value is Record<string, JsonValue> => typeof value === 'object' && value !== null && !Array.isArray(value);
function diff(before: JsonValue, after: JsonValue, path: string[] = []): ProjectChange[] {
  if (equal(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length && before.every((v, i) => record(v) && typeof v.id === 'string' && record(after[i]) && v.id === (after[i] as Record<string, JsonValue>).id)) {
    return before.flatMap((v, i) => diff(v, after[i]!, [...path, `@${(v as Record<string, JsonValue>).id as string}`]));
  }
  if (record(before) && record(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
      if (path.length === 0 && ['revision', 'updatedAt', 'createdAt', 'schemaVersion', 'id'].includes(key)) return [];
      if (!(key in before) || !(key in after)) return [{ path: [...path, key], before: before[key] ?? null, after: after[key] ?? null, beforeExists: key in before, afterExists: key in after }];
      return diff(before[key]!, after[key]!, [...path, key]);
    });
  }
  return [{ path, before, after, beforeExists: true, afterExists: true }];
}
function resolveParent(project: Project, path: string[]): { parent: Record<string, JsonValue> | JsonValue[]; key: string | number } {
  if (!path.length || path.some(p => ['__proto__', 'constructor', 'prototype'].includes(p)) || ['id', 'schemaVersion', 'createdAt', 'revision', 'updatedAt'].includes(path[0]!)) throw new Error('Ungültiger Änderungspfad.');
  let current: unknown = project;
  for (const segment of path.slice(0, -1)) {
    if (Array.isArray(current) && segment.startsWith('@')) current = current.find(v => record(v) && v.id === segment.slice(1));
    else if (record(current)) current = current[segment];
    else throw new CommandConflictError(path);
  }
  if (!current || typeof current !== 'object') throw new CommandConflictError(path);
  const last = path[path.length - 1]!;
  const key = Array.isArray(current) ? current.findIndex(v => record(v) && v.id === last.slice(1)) : last;
  if (typeof key === 'number' && key < 0) throw new CommandConflictError(path);
  return { parent: current as Record<string, JsonValue> | JsonValue[], key };
}
function commandFor(project: Project, changes: ProjectChange[], actorId: string): ProjectCommand {
  return { schemaVersion: 1, id: createId('command'), actorId, baseRevision: project.revision, createdAt: new Date().toISOString(), type: 'patch-project', affectedObjects: [...new Set(changes.map(c => c.path.slice(0, 2).join('/')))], changes };
}
export function createProjectCommand(before: Project, after: Project, actorId = 'local-dev'): ProjectCommand {
  assertValidProject(after);
  if (before.id !== after.id) throw new Error('Ein Befehl darf die Projektidentität nicht ändern.');
  return commandFor(before, diff(before as unknown as JsonValue, after as unknown as JsonValue), actorId);
}
/** Stale revisions may merge only if every touched value still equals its base. */
export function applyProjectCommand(project: Project, command: ProjectCommand): Project {
  if (command.schemaVersion !== 1 || command.type !== 'patch-project' || command.baseRevision > project.revision) throw new Error('Nicht unterstützter Befehl oder zukünftige Basisrevision.');
  const next = clone(project);
  for (const change of command.changes) {
    const { parent, key } = resolveParent(next, change.path);
    const target = parent as Record<string | number, JsonValue>;
    if (Object.prototype.hasOwnProperty.call(target, key) !== change.beforeExists || (change.beforeExists && !equal(target[key], change.before))) throw new CommandConflictError(change.path);
    if (change.afterExists) target[key] = clone(change.after); else delete target[key];
  }
  next.revision = project.revision + 1; next.updatedAt = command.createdAt;
  assertValidProject(next); return next;
}
export function createHistory(project: Project): ProjectHistory { assertValidProject(project); return { present: clone(project), undoStack: [], redoStack: [] }; }
export function commitProject(history: ProjectHistory, next: Project, actorId = 'local-dev'): ProjectHistory {
  const command = createProjectCommand(history.present, next, actorId);
  return commitCommand(history, command);
}
/** Commit a previously prepared command as one serializable undo step. */
export function commitCommand(history: ProjectHistory, command: ProjectCommand): ProjectHistory {
  if (!command.changes.length) return history;
  return { present: applyProjectCommand(history.present, command), undoStack: [...history.undoStack, command].slice(-100), redoStack: [] };
}
export function undo(history: ProjectHistory, actorId = 'local-dev'): ProjectHistory {
  const command = history.undoStack[history.undoStack.length - 1]; if (!command) return history;
  if (command.actorId !== actorId) throw new Error('Fremde Bearbeitungen können nicht lokal rückgängig gemacht werden.');
  const inverse = commandFor(history.present, [...command.changes].reverse().map(c => ({ path: c.path, before: c.after, after: c.before, beforeExists: c.afterExists, afterExists: c.beforeExists })), actorId);
  return { present: applyProjectCommand(history.present, inverse), undoStack: history.undoStack.slice(0, -1), redoStack: [...history.redoStack, command] };
}
export function redo(history: ProjectHistory, actorId = 'local-dev'): ProjectHistory {
  const command = history.redoStack[history.redoStack.length - 1]; if (!command) return history;
  if (command.actorId !== actorId) throw new Error('Fremde Bearbeitungen können nicht lokal wiederholt werden.');
  const repeated = commandFor(history.present, command.changes, actorId);
  return { present: applyProjectCommand(history.present, repeated), undoStack: [...history.undoStack, repeated], redoStack: history.redoStack.slice(0, -1) };
}
