import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { commitProject, createDemoProject, createHistory } from '@choreoflow/core';
import { CloudService, createCloudClient } from '../src/cloud';
import { LocalProjectRepository } from '../src/repository';
import { MemoryStore } from '../src/memory-store';

const identity = { kind: 'cloud' as const, userId: 'b07a41a9-adcb-42d8-bd93-82258e38760e' };
function client(rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>, userId = identity.userId) {
  return { auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) }, rpc } as unknown as SupabaseClient;
}
test('missing cloud configuration does not block local use; privileged keys are rejected', () => {
  assert.equal(createCloudClient({}), null);
  assert.throws(() => createCloudClient({ url: 'https://example.supabase.co', publishableKey: 'sb_secret_wrong' }), /Publishable/);
});
test('local identity and mismatched accounts never upload their outbox', async () => {
  let calls = 0; const service = new CloudService(client(async () => { calls++; return {}; }));
  await assert.rejects(service.sync(new LocalProjectRepository(new MemoryStore())), /Testidentitäten/);
  const wrong = new CloudService(client(async () => { calls++; return {}; }, '800e33c6-49a8-4e8f-bcf6-826e8c68418c'));
  await assert.rejects(wrong.sync(new LocalProjectRepository(new MemoryStore(), identity)), /Konto/); assert.equal(calls, 0);
});
test('snapshot uploads use stable cloud IDs and sequential compare-and-swap revisions', async () => {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const service = new CloudService(client(async (name, args) => { calls.push({ name, args }); return { data: { revision: calls.length }, error: null }; }));
  const repository = new LocalProjectRepository(new MemoryStore(), identity); const first = createHistory(createDemoProject('line'));
  await repository.save(first); await repository.save(commitProject(first, { ...first.present, name: 'Second' }));
  const result = await service.sync(repository); assert.deepEqual(result, { uploaded: 2, remaining: 0, conflicts: [] });
  assert.equal(calls[0]!.name, 'create_project'); assert.equal(calls[1]!.name, 'save_project');
  assert.equal(calls[0]!.args.p_project_id, calls[1]!.args.p_project_id); assert.equal(calls[1]!.args.p_base_revision, 1);
  assert.match(calls[1]!.args.p_command_id as string, /^[0-9a-f-]{36}$/);
});
test('network failure retains command ID and payload for an idempotent retry', async () => {
  const repository = new LocalProjectRepository(new MemoryStore(), identity); await repository.save(createHistory(createDemoProject('line')));
  const original = await repository.pending(); let fail = true; const payloads: unknown[] = [];
  const service = new CloudService(client(async (_name, args) => { payloads.push(args); if (fail) throw new Error('Offline'); return { data: { revision: 1 }, error: null }; }));
  await assert.rejects(service.sync(repository), /Offline/); assert.deepEqual(await repository.pending(), original);
  fail = false; await service.sync(repository); assert.deepEqual(payloads[0], payloads[1]);
});
test('revision conflicts preserve unsynced edits and are recorded for resolution', async () => {
  const repository = new LocalProjectRepository(new MemoryStore(), identity); await repository.save(createHistory(createDemoProject('line')));
  const service = new CloudService(client(async () => ({ data: null, error: { code: '40001', message: 'REVISION_CONFLICT' } })));
  const result = await service.sync(repository); assert.equal(result.uploaded, 0); assert.equal(result.remaining, 1);
  assert.deepEqual(result.conflicts, ['demo-line']); assert.equal((await repository.load()).conflicts.length, 1);
});
