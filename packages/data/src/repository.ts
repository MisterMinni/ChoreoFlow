import { assertValidProject, createDemoProject, createHistory } from '@choreoflow/core';
import type { Cast, Project, ProjectHistory } from '@choreoflow/core';
import type { AppState, AtomicStore, ProjectRepository, RepositoryIdentity, SaveOptions, ThemePreference } from './types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const safeKey = (key: string): void => { if (!key || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Ungültige Speicherkennung.'); };
/** UUIDs identify commands/projects; they are never used as access tokens. */
export function createSyncId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 15) | 64; bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function identityNamespace(identity: RepositoryIdentity): string {
  if (identity.kind === 'local') return 'local:development';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.userId)) throw new Error('Ungültige Kontoidentität.');
  return `cloud:${identity.userId}`;
}
export class LocalConflictError extends Error {
  constructor() { super('Das Projekt wurde in einer anderen Ansicht geändert. Deine Arbeit bleibt erhalten; bitte beide Stände vergleichen.'); this.name = 'LocalConflictError'; }
}
function initialState(identity: RepositoryIdentity, seed: () => Project[]): AppState {
  const projects = identity.kind === 'local' ? seed() : [];
  return { schemaVersion: 1, revision: 0, identity: clone(identity), projects, histories: Object.fromEntries(projects.map(project => [project.id, createHistory(project)])), casts: [], theme: 'system', settings: {}, outbox: [], cloudRevisions: {}, cloudProjectIds: {}, conflicts: [] };
}
function readState(value: unknown, identity: RepositoryIdentity): AppState {
  if (!value || typeof value !== 'object') throw new Error('Lokaler Speicher ist beschädigt. Er wurde nicht überschrieben.');
  const state = value as AppState;
  if (state.schemaVersion !== 1) throw new Error('Nicht unterstützte Speicherversion. Bitte die App aktualisieren; gespeicherte Daten bleiben erhalten.');
  if (!same(state.identity, identity) || !Array.isArray(state.projects) || !Array.isArray(state.outbox) || !state.histories || !state.settings || !state.cloudProjectIds || !state.cloudRevisions || !Array.isArray(state.casts)) throw new Error('Lokaler Speicher ist inkonsistent und wurde nicht überschrieben.');
  for (const project of state.projects) {
    safeKey(project.id); assertValidProject(project);
    const history = state.histories[project.id];
    if (!history || !Array.isArray(history.undoStack) || !Array.isArray(history.redoStack) || !same(history.present, project)) throw new Error('Projekt und Wiederherstellung sind inkonsistent.');
  }
  return state;
}

export class LocalProjectRepository implements ProjectRepository {
  readonly identity: RepositoryIdentity;
  private readonly namespace: string;
  private observedRevisions = new Map<string, number>();
  constructor(private readonly store: AtomicStore, identity: RepositoryIdentity = { kind: 'local' }, private readonly seed: () => Project[] = () => [createDemoProject('show')]) {
    this.identity = clone(identity); this.namespace = identityNamespace(identity);
  }
  private transaction<T>(update: (state: AppState) => T, mutate = true): Promise<T> {
    return this.store.transact(this.namespace, stored => {
      const state = stored === undefined ? initialState(this.identity, this.seed) : readState(stored, this.identity);
      const result = update(state);
      if (mutate) state.revision += 1;
      return { value: state, result: clone(result) };
    });
  }
  async load(): Promise<AppState> {
    return this.transaction(state => state, false);
  }
  async list(): Promise<ProjectHistory[]> {
    const state = await this.load();
    // Only returning editor histories advances the observed baseline. Settings,
    // outbox and cast reads must not make an unsaved stale editor look current.
    this.observedRevisions = new Map(state.projects.map(project => [project.id, project.revision]));
    return state.projects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(project => state.histories[project.id]!);
  }
  async save(history: ProjectHistory, options: SaveOptions = {}): Promise<void> {
    assertValidProject(history.present); safeKey(history.present.id);
    if (!Array.isArray(history.undoStack) || !Array.isArray(history.redoStack)) throw new Error('Ungültiger Wiederherstellungsstand.');
    const incoming = clone(history);
    const expected = options.expectedRevision ?? this.observedRevisions.get(incoming.present.id);
    await this.transaction(state => {
      const current = state.histories[incoming.present.id];
      if (current && same(current, incoming)) return null;
      if ((!current && expected !== undefined) || (current && ((expected !== undefined && current.present.revision !== expected) || incoming.present.revision !== current.present.revision + 1))) throw new LocalConflictError();
      state.histories[incoming.present.id] = incoming;
      state.projects = [...state.projects.filter(project => project.id !== incoming.present.id), incoming.present];
      if (!state.cloudProjectIds[incoming.present.id]) state.cloudProjectIds[incoming.present.id] = createSyncId();
      // Development-only edits never need duplicate project-sized cloud snapshots.
      state.outbox.push({ id: createSyncId(), projectId: incoming.present.id, actor: clone(this.identity), operation: 'save', baseRevision: state.cloudRevisions[incoming.present.id] ?? 0, ...(this.identity.kind === 'cloud' ? { snapshot: clone(incoming.present) } : {}), createdAt: new Date().toISOString() });
      return null;
    });
    this.observedRevisions.set(incoming.present.id, incoming.present.revision);
  }
  async remove(projectId: string): Promise<void> {
    safeKey(projectId);
    await this.transaction(state => {
      if (!state.histories[projectId]) return null;
      state.projects = state.projects.filter(project => project.id !== projectId); delete state.histories[projectId];
      state.outbox.push({ id: createSyncId(), projectId, actor: clone(this.identity), operation: 'remove', baseRevision: state.cloudRevisions[projectId] ?? 0, createdAt: new Date().toISOString() });
      return null;
    });
    this.observedRevisions.delete(projectId);
  }
  async getSetting<T = unknown>(key: string): Promise<T | undefined> {
    safeKey(key); const state = await this.load();
    return (key === 'theme' ? state.theme : state.settings[key]) as T | undefined;
  }
  async setSetting<T>(key: string, value: T): Promise<void> {
    safeKey(key);
    if (key === 'theme') { await this.setTheme(value as ThemePreference); return; }
    await this.transaction(state => { state.settings[key] = clone(value); return null; });
  }
  async setTheme(theme: ThemePreference): Promise<void> {
    if (!['system', 'light', 'dark'].includes(theme)) throw new Error('Unbekanntes Erscheinungsbild.');
    await this.transaction(state => { state.theme = theme; return null; });
  }
  async listCasts(): Promise<Cast[]> { return (await this.load()).casts; }
  async saveCast(cast: Cast): Promise<void> {
    safeKey(cast.id);
    if (!cast.name.trim() || !Array.isArray(cast.people) || !Array.isArray(cast.groups) || cast.people.length > 100) throw new Error('Ungültige Besetzung.');
    await this.transaction(state => { state.casts = [...state.casts.filter(item => item.id !== cast.id), clone(cast)]; return null; });
  }
  async removeCast(castId: string): Promise<void> { await this.transaction(state => { state.casts = state.casts.filter(cast => cast.id !== castId); return null; }); }
  async pending() { return (await this.load()).outbox; }
  async acknowledge(entryId: string, cloudRevision: number): Promise<void> {
    await this.transaction(state => {
      const entry = state.outbox.find(item => item.id === entryId);
      if (!entry) return null;
      state.outbox = state.outbox.filter(item => item.id !== entryId);
      state.cloudRevisions[entry.projectId] = cloudRevision;
      state.outbox.forEach(item => { if (item.projectId === entry.projectId) item.baseRevision = cloudRevision; });
      state.conflicts = state.conflicts.filter(item => item.projectId !== entry.projectId);
      return null;
    });
  }
  async recordConflict(projectId: string, message: string): Promise<void> {
    await this.transaction(state => { state.conflicts = [...state.conflicts.filter(item => item.projectId !== projectId), { projectId, message, detectedAt: new Date().toISOString() }]; return null; });
  }
  async acceptRemote(project: Project, cloudRevision: number, cloudProjectId?: string): Promise<void> {
    assertValidProject(project); safeKey(project.id);
    if (!Number.isSafeInteger(cloudRevision) || cloudRevision < 1) throw new Error('Ungültige Cloud-Revision.');
    // Downloads persist data without returning an editor history. Advancing the
    // observed baseline here would let a still-stale editor overwrite that data.
    await this.transaction(state => {
      if (state.outbox.some(entry => entry.projectId === project.id)) throw new LocalConflictError();
      if (cloudProjectId && state.cloudProjectIds[project.id] && state.cloudProjectIds[project.id] !== cloudProjectId) throw new Error('Zwei Cloud-Projekte verwenden dieselbe interne Projektkennung. Kein lokaler Stand wurde ersetzt.');
      // A download may finish after a newer upload/download was acknowledged.
      // Never roll it back, or erase undo/media metadata for the same revision.
      if ((state.cloudRevisions[project.id] ?? 0) > cloudRevision) throw new LocalConflictError();
      if (state.cloudRevisions[project.id] === cloudRevision) return null;
      state.histories[project.id] = createHistory(project);
      state.projects = [...state.projects.filter(item => item.id !== project.id), clone(project)];
      state.cloudRevisions[project.id] = cloudRevision;
      if (cloudProjectId) state.cloudProjectIds[project.id] = cloudProjectId;
      return null;
    });
  }
}
