import type { Cast, Project, ProjectHistory } from '@choreoflow/core';

export type RepositoryIdentity = { kind: 'local' } | { kind: 'cloud'; userId: string };
export type ThemePreference = 'system' | 'light' | 'dark';
export interface OutboxEntry {
  id: string;
  projectId: string;
  actor: RepositoryIdentity;
  operation: 'save' | 'remove';
  baseRevision: number;
  snapshot?: Project;
  createdAt: string;
}
export interface SyncConflict { projectId: string; message: string; detectedAt: string }
export interface AppState {
  schemaVersion: 1;
  revision: number;
  identity: RepositoryIdentity;
  projects: Project[];
  histories: Record<string, ProjectHistory>;
  casts: Cast[];
  theme: ThemePreference;
  settings: Record<string, unknown>;
  outbox: OutboxEntry[];
  cloudRevisions: Record<string, number>;
  cloudProjectIds: Record<string, string>;
  conflicts: SyncConflict[];
}
export interface SaveOptions { expectedRevision?: number }
export interface ProjectRepository {
  readonly identity: RepositoryIdentity;
  load(): Promise<AppState>;
  list(): Promise<ProjectHistory[]>;
  save(history: ProjectHistory, options?: SaveOptions): Promise<void>;
  remove(projectId: string): Promise<void>;
  getSetting<T = unknown>(key: string): Promise<T | undefined>;
  setSetting<T>(key: string, value: T): Promise<void>;
  setTheme(theme: ThemePreference): Promise<void>;
  listCasts(): Promise<Cast[]>;
  saveCast(cast: Cast): Promise<void>;
  removeCast(castId: string): Promise<void>;
  pending(): Promise<OutboxEntry[]>;
  acknowledge(entryId: string, cloudRevision: number): Promise<void>;
  recordConflict(projectId: string, message: string): Promise<void>;
  acceptRemote(project: Project, cloudRevision: number, cloudProjectId?: string): Promise<void>;
}
/** Reducers are synchronous so IndexedDB cannot auto-close mid-transaction. */
export interface AtomicStore {
  transact<T>(key: string, update: (stored: unknown | undefined) => { value: unknown; result: T }): Promise<T>;
  close?(): Promise<void>;
}
