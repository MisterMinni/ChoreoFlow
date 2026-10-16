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
  async listProjects(expectedUserId?: string): Promise<CloudProject[]> { return this.projectsFor(await this.verifiedAccount(expectedUserId)); }
  /** Each operation is bound to the verified caller, even during an account switch. */
  async authenticatedRpc<T = unknown>(name: string, args: Record<string, unknown>, expectedUserId: string): Promise<T> {
    const account = await this.verifiedAccount(expectedUserId); await this.requireCurrentAccount(account);
    const { data, error } = await this.client.rpc(name, args).setHeader('Authorization', `Bearer ${account.accessToken}`);
    fail(error); await this.requireCurrentAccount(account); return data as T;
  }
  async getProject(id: string, expectedUserId: string): Promise<CloudProject> {
    const account = await this.verifiedAccount(expectedUserId); await this.requireCurrentAccount(account);
    const { data, error } = await this.client.from('projects').select('id,owner_id,title,snapshot,revision,archived_at').eq('id', id).single().setHeader('Authorization', `Bearer ${account.accessToken}`);
    fail(error); await this.requireCurrentAccount(account);
    const row = data as CloudProject;
    if (!row || row.archived_at || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('Dieses Cloud-Projekt ist nicht verfügbar.');
    assertValidProject(row.snapshot); return row;
  }
  async uploadMedia(path: string, bytes: ArrayBuffer, mimeType: string, expectedUserId: string): Promise<void> {
    if (!Number.isSafeInteger(bytes.byteLength) || bytes.byteLength < 1 || bytes.byteLength > 20 * 1024 * 1024) throw new Error('Musikdateien dürfen höchstens 20 MB groß sein.');
    const account = await this.verifiedAccount(expectedUserId); await this.requireCurrentAccount(account);
    const { error } = await this.client.storage.from('project-media').upload(path, bytes, {
      contentType: mimeType, upsert: false, cacheControl: '0', headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    await this.requireCurrentAccount(account);
    if (error) {
      // A lost acknowledgement may leave the immutable object present. Retry
      // succeeds only if the server's original bytes are exactly the same.
      if (error.message.includes('already exists') || ('statusCode' in error && ['409', 'Duplicate'].includes(String(error.statusCode)))) {
        const existing = await this.downloadMedia(path, bytes.byteLength, expectedUserId);
        const a = new Uint8Array(existing), b = new Uint8Array(bytes);
        if (a.length !== b.length || a.some((value, index) => value !== b[index])) throw new Error('Unter dieser Musikkennung liegt eine andere Datei. Die vorhandene Musik wurde nicht überschrieben.');
      } else fail(error);
    }
  }
  async downloadMedia(path: string, expectedBytes: number, expectedUserId: string): Promise<ArrayBuffer> {
    if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > 20 * 1024 * 1024) throw new Error('Ungültige Größe der Musikdatei.');
    const account = await this.verifiedAccount(expectedUserId); await this.requireCurrentAccount(account);
    // storage-js forwards fetch parameters unchanged; the real-SDK regression
    // test checks this explicit header survives its fetchWithAuth wrapper.
    const parameters = { headers: { Authorization: `Bearer ${account.accessToken}` }, cache: 'no-store' as const };
    const { data, error } = await this.client.storage.from('project-media').download(path, {}, parameters);
    fail(error); await this.requireCurrentAccount(account);
    if (!data || data.size !== expectedBytes) throw new Error('Die Cloud-Musik ist unvollständig oder passt nicht zum Projekt.');
    const bytes = await data.arrayBuffer(); await this.requireCurrentAccount(account); return bytes;
  }
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
