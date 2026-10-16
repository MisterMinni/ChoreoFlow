import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertValidProject } from '@choreoflow/core';
import type { Project } from '@choreoflow/core';
import { authStorage } from './auth-storage';
import type { ProjectRepository } from './types';

export interface PublicCloudConfig { url?: string; publishableKey?: string }
export interface CloudProject { id: string; owner_id: string; title: string; snapshot: Project; revision: number; archived_at: string | null }
export interface SyncResult { uploaded: number; remaining: number; conflicts: string[] }
export function createCloudClient(config: PublicCloudConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
}): SupabaseClient | null {
  if (!config.url || !config.publishableKey) return null;
  if (!config.publishableKey.startsWith('sb_publishable_')) throw new Error('Für die App ist ausschließlich ein Supabase-Publishable-Key zulässig.');
  const url = new URL(config.url);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Cloud-Anmeldung benötigt HTTPS.');
  return createClient(config.url, config.publishableKey, {
    auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
  });
}
function fail(error: { message: string } | null): void { if (error) throw new Error(error.message); }
function cloudSnapshot(project: Project): Project {
  const snapshot = JSON.parse(JSON.stringify(project)) as Project;
  // Device-local file locations are not portable media references.
  snapshot.audio.assets.forEach(asset => { delete asset.localUri; });
  return snapshot;
}

let configuredService: CloudService | null | undefined;
export function getCloudService(): CloudService | null {
  if (configuredService === undefined) {
    const client = createCloudClient(); configuredService = client ? new CloudService(client) : null;
  }
  return configuredService;
}

export class CloudService {
  private syncing = new Map<ProjectRepository, Promise<SyncResult>>();
  constructor(readonly client: SupabaseClient) {}
  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password }); fail(error); return data;
  }
  async signUp(email: string, password: string, emailRedirectTo?: string) {
    const { data, error } = await this.client.auth.signUp({ email: email.trim(), password, options: emailRedirectTo ? { emailRedirectTo } : undefined }); fail(error); return data;
  }
  async signOut(): Promise<void> { const { error } = await this.client.auth.signOut(); fail(error); }
  async currentUser() { const { data, error } = await this.client.auth.getUser(); fail(error); return data.user; }
  async listProjects(): Promise<CloudProject[]> {
    const { data, error } = await this.client.from('projects').select('id,owner_id,title,snapshot,revision,archived_at').is('archived_at', null).order('updated_at', { ascending: false }); fail(error);
    const rows = (data ?? []) as CloudProject[]; rows.forEach(row => assertValidProject(row.snapshot)); return rows;
  }
  sync(repository: ProjectRepository): Promise<SyncResult> {
    const active = this.syncing.get(repository); if (active) return active;
    const work = this.flush(repository).finally(() => this.syncing.delete(repository)); this.syncing.set(repository, work); return work;
  }
  private async flush(repository: ProjectRepository): Promise<SyncResult> {
    if (repository.identity.kind !== 'cloud') throw new Error('Lokale Testidentitäten werden nicht mit einem Cloud-Konto synchronisiert.');
    const user = await this.currentUser();
    if (!user || user.id !== repository.identity.userId) throw new Error('Das angemeldete Konto passt nicht zum lokalen Cloud-Speicher.');
    let uploaded = 0;
    const conflicts: string[] = [];
    const initial = await repository.pending();
    // A finite initial batch keeps ongoing editing from creating an endless flush.
    for (const initialEntry of initial) {
      const state = await repository.load();
      const entry = state.outbox.find(item => item.id === initialEntry.id);
      if (!entry || conflicts.includes(entry.projectId)) continue;
      if (entry.actor.kind !== 'cloud' || entry.actor.userId !== user.id) throw new Error('Outbox und Konto stimmen nicht überein.');
      const cloudId = state.cloudProjectIds[entry.projectId];
      if (!cloudId) throw new Error('Cloud-Zuordnung fehlt; lokale Daten bleiben erhalten.');
      let response;
      if (entry.operation === 'remove') {
        if (entry.baseRevision === 0) { await repository.acknowledge(entry.id, 0); continue; }
        response = await this.client.rpc('archive_project', { p_project_id: cloudId, p_archived: true });
      } else {
        if (!entry.snapshot) throw new Error('Outbox-Snapshot fehlt.');
        assertValidProject(entry.snapshot);
        const snapshot = cloudSnapshot(entry.snapshot);
        response = entry.baseRevision === 0
          ? await this.client.rpc('create_project', { p_project_id: cloudId, p_title: snapshot.name, p_snapshot: snapshot })
          : await this.client.rpc('save_project', { p_project_id: cloudId, p_base_revision: entry.baseRevision, p_command_id: entry.id, p_snapshot: snapshot });
      }
      if (response.error) {
        if (response.error.code === '40001' || response.error.message.includes('REVISION_CONFLICT')) {
          conflicts.push(entry.projectId); await repository.recordConflict(entry.projectId, 'Ein anderer Bearbeiter hat den Cloud-Stand verändert. Lokale Änderungen und Outbox bleiben erhalten.'); continue;
        }
        throw new Error(response.error.message);
      }
      const data = response.data as { revision?: number } | null;
      if (!data || !Number.isInteger(data.revision) || data.revision! < 1) throw new Error('Cloud-Antwort enthält keine gültige Revision; Outbox bleibt erhalten.');
      await repository.acknowledge(entry.id, data.revision!); uploaded++;
    }
    return { uploaded, remaining: (await repository.pending()).length, conflicts };
  }
  async download(repository: ProjectRepository): Promise<number> {
    if (repository.identity.kind !== 'cloud') throw new Error('Cloud-Projekte benötigen einen getrennten Kontospeicher.');
    const user = await this.currentUser();
    if (user?.id !== repository.identity.userId) throw new Error('Falsches Konto für diesen Speicher.');
    const projects = await this.listProjects(); let downloaded = 0;
    for (const row of projects) { await repository.acceptRemote(row.snapshot, row.revision, row.id); downloaded++; }
    return downloaded;
  }
  async publishProject(cloudProjectId: string, revision: number) {
    const { data, error } = await this.client.rpc('publish_project', { p_project_id: cloudProjectId, p_base_revision: revision, p_include_media: false }); fail(error); return data;
  }
  async createShareLink(publicationId: string, expiresAt?: string) {
    const { data, error } = await this.client.rpc('create_share_link', { p_publication_id: publicationId, ...(expiresAt ? { p_expires_at: expiresAt } : {}) }); fail(error); return data;
  }
  async readShare(token: string) {
    const { data, error } = await this.client.rpc('read_share', { p_token: token }); fail(error); return data;
  }
  async revokeShareLink(linkId: string): Promise<void> {
    const { error } = await this.client.rpc('revoke_share_link', { p_link_id: linkId }); fail(error);
  }
}
