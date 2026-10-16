import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertValidProject } from '@choreoflow/core';
import type { Project } from '@choreoflow/core';
import { authStorage } from './auth-storage';
import type { ProjectRepository } from './types';

export interface PublicCloudConfig { url?: string; publishableKey?: string }
export interface CloudProject { id: string; owner_id: string; title: string; snapshot: Project; revision: number; archived_at: string | null }
export interface SyncResult { uploaded: number; remaining: number; conflicts: string[] }
interface VerifiedAccount { userId: string; accessToken: string }
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
  private async verifiedAccount(expectedUserId?: string): Promise<VerifiedAccount> {
    const { data: { session }, error } = await this.client.auth.getSession(); fail(error);
    if (!session) throw new Error('Für diesen Cloud-Speicher ist kein Konto angemeldet.');
    // getSession supplies a token, not trusted authorization. Validate that exact
    // token, then pin it to each request instead of consulting mutable Auth state.
    const { data: { user }, error: userError } = await this.client.auth.getUser(session.access_token); fail(userError);
    if (!user || (expectedUserId !== undefined && user.id !== expectedUserId)) throw new Error('Das angemeldete Konto passt nicht zum lokalen Cloud-Speicher.');
    return { userId: user.id, accessToken: session.access_token };
  }
  private async requireCurrentAccount(account: VerifiedAccount): Promise<void> {
    const { data: { session }, error } = await this.client.auth.getSession(); fail(error);
    if (!session || session.user.id !== account.userId) throw new Error('Das Konto wurde gewechselt oder abgemeldet. Ausstehende Änderungen bleiben erhalten.');
  }
  private async projectsFor(account: VerifiedAccount): Promise<CloudProject[]> {
    await this.requireCurrentAccount(account);
    const { data, error } = await this.client.from('projects').select('id,owner_id,title,snapshot,revision,archived_at').is('archived_at', null).order('updated_at', { ascending: false }).setHeader('Authorization', `Bearer ${account.accessToken}`); fail(error);
    await this.requireCurrentAccount(account);
    const rows = (data ?? []) as CloudProject[]; rows.forEach(row => assertValidProject(row.snapshot)); return rows;
  }
  async listProjects(): Promise<CloudProject[]> { return this.projectsFor(await this.verifiedAccount()); }
  sync(repository: ProjectRepository): Promise<SyncResult> {
    const active = this.syncing.get(repository); if (active) return active;
    const work = this.flush(repository).finally(() => this.syncing.delete(repository)); this.syncing.set(repository, work); return work;
  }
  private async flush(repository: ProjectRepository): Promise<SyncResult> {
    if (repository.identity.kind !== 'cloud') throw new Error('Lokale Testidentitäten werden nicht mit einem Cloud-Konto synchronisiert.');
    const account = await this.verifiedAccount(repository.identity.userId);
    let uploaded = 0;
    const conflicts: string[] = [];
    const initial = await repository.pending();
    // A finite initial batch keeps ongoing editing from creating an endless flush.
    for (const initialEntry of initial) {
      const state = await repository.load();
      const entry = state.outbox.find(item => item.id === initialEntry.id);
      if (!entry || conflicts.includes(entry.projectId)) continue;
      if (entry.actor.kind !== 'cloud' || entry.actor.userId !== account.userId) throw new Error('Outbox und Konto stimmen nicht überein.');
      const cloudId = state.cloudProjectIds[entry.projectId];
      if (!cloudId) throw new Error('Cloud-Zuordnung fehlt; lokale Daten bleiben erhalten.');
      await this.requireCurrentAccount(account);
      let response;
      if (entry.operation === 'remove') {
        if (entry.baseRevision === 0) { await repository.acknowledge(entry.id, 0); continue; }
        response = await this.client.rpc('archive_project', { p_project_id: cloudId, p_archived: true }).setHeader('Authorization', `Bearer ${account.accessToken}`);
      } else {
        if (!entry.snapshot) throw new Error('Outbox-Snapshot fehlt.');
        assertValidProject(entry.snapshot);
        const snapshot = cloudSnapshot(entry.snapshot);
        response = entry.baseRevision === 0
          ? await this.client.rpc('create_project', { p_project_id: cloudId, p_title: snapshot.name, p_snapshot: snapshot }).setHeader('Authorization', `Bearer ${account.accessToken}`)
          : await this.client.rpc('save_project', { p_project_id: cloudId, p_base_revision: entry.baseRevision, p_command_id: entry.id, p_snapshot: snapshot }).setHeader('Authorization', `Bearer ${account.accessToken}`);
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
    await this.requireCurrentAccount(account);
    return { uploaded, remaining: (await repository.pending()).length, conflicts };
  }
  async download(repository: ProjectRepository): Promise<number> {
    if (repository.identity.kind !== 'cloud') throw new Error('Cloud-Projekte benötigen einen getrennten Kontospeicher.');
    const account = await this.verifiedAccount(repository.identity.userId);
    const projects = await this.projectsFor(account); let downloaded = 0;
    for (const row of projects) { await this.requireCurrentAccount(account); await repository.acceptRemote(row.snapshot, row.revision, row.id); downloaded++; }
    await this.requireCurrentAccount(account);
    return downloaded;
  }
  async publishProject(cloudProjectId: string, revision: number, expectedUserId?: string) {
    const account = await this.verifiedAccount(expectedUserId); await this.requireCurrentAccount(account);
    const { data, error } = await this.client.rpc('publish_project', { p_project_id: cloudProjectId, p_base_revision: revision, p_include_media: false }).setHeader('Authorization', `Bearer ${account.accessToken}`); fail(error); await this.requireCurrentAccount(account); return data;
  }
  async createShareLink(publicationId: string, expiresAt?: string, expectedUserId?: string) {
    const account = await this.verifiedAccount(expectedUserId); await this.requireCurrentAccount(account);
    const { data, error } = await this.client.rpc('create_share_link', { p_publication_id: publicationId, ...(expiresAt ? { p_expires_at: expiresAt } : {}) }).setHeader('Authorization', `Bearer ${account.accessToken}`); fail(error); await this.requireCurrentAccount(account); return data;
  }
  async readShare(token: string) {
    const { data, error } = await this.client.rpc('read_share', { p_token: token }); fail(error); return data;
  }
  async revokeShareLink(linkId: string, expectedUserId?: string): Promise<void> {
    const account = await this.verifiedAccount(expectedUserId); await this.requireCurrentAccount(account);
    const { error } = await this.client.rpc('revoke_share_link', { p_link_id: linkId }).setHeader('Authorization', `Bearer ${account.accessToken}`); fail(error);
  }
}
