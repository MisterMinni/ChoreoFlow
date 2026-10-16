import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { commitProject, createDemoProject, createHistory } from '@choreoflow/core';
import { CloudService, createCloudClient } from '../src/cloud';
import { LocalProjectRepository } from '../src/repository';
import { MemoryStore } from '../src/memory-store';

const identity = { kind: 'cloud' as const, userId: 'b07a41a9-adcb-42d8-bd93-82258e38760e' };
function client(rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>, userId = identity.userId) {
  return {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: userId }, access_token: `test:${userId}` } }, error: null }),
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
    },
    rpc: (name: string, args: Record<string, unknown>) => ({
      setHeader() { return this; },
      then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return rpc(name, args).then(resolve, reject); },
    }),
  } as unknown as SupabaseClient;
}

const otherId = '800e33c6-49a8-4e8f-bcf6-826e8c68418c';
function sdkClient(fetcher: typeof fetch) {
  const auth = { userId: identity.userId as string | null, version: 1 };
  const sdk = createClient('https://example.supabase.co', 'sb_publishable_synthetic_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetcher },
  });
  sdk.auth.getSession = (async () => ({ data: { session: auth.userId ? { user: { id: auth.userId }, access_token: `${auth.userId}:${auth.version}` } : null }, error: null })) as typeof sdk.auth.getSession;
  sdk.auth.getUser = (async (token?: string) => ({ data: { user: { id: token ? token.split(':')[0] : auth.userId } }, error: null })) as typeof sdk.auth.getUser;
  return { sdk, auth };
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

test('a switched account cannot receive another account\'s pending snapshot', async () => {
  const repository = new LocalProjectRepository(new MemoryStore(), identity);
  await repository.save(createHistory(createDemoProject('line')));
  const requests: string[] = [];
  const service = new CloudService(client(async () => { requests.push(otherId); return { data: { revision: 1 }, error: null }; }));
  // Account switch after the batch's initial check but before its first RPC.
  const pending = repository.pending.bind(repository);
  repository.pending = async () => {
    const entries = await pending();
    service.client.auth.getUser = (async () => ({ data: { user: { id: otherId } }, error: null })) as typeof service.client.auth.getUser;
    service.client.auth.getSession = (async () => ({ data: { session: { user: { id: otherId }, access_token: `test:${otherId}` } }, error: null })) as typeof service.client.auth.getSession;
    return entries;
  };
  await assert.rejects(service.sync(repository), /Konto/);
  assert.deepEqual(requests, []);
  assert.equal((await pending()).length, 1);
});

test('real SDK request pins the verified token even when account changes after the guard', async () => {
  const sent: string[] = [];
  const { sdk, auth } = sdkClient(async (_input, init) => {
    sent.push(new Headers(init?.headers).get('Authorization')!);
    return new Response(JSON.stringify({ revision: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const originalRpc = sdk.rpc.bind(sdk);
  sdk.rpc = ((...args: Parameters<typeof sdk.rpc>) => {
    auth.userId = otherId;
    return originalRpc(...args);
  }) as typeof sdk.rpc;
  const repository = new LocalProjectRepository(new MemoryStore(), identity);
  const first = createHistory(createDemoProject('line'));
  await repository.save(first);
  await repository.save(commitProject(first, { ...first.present, name: 'Still belongs to A' }));
  await assert.rejects(new CloudService(sdk).sync(repository), /Konto/);
  assert.deepEqual(sent, [`Bearer ${identity.userId}:1`]);
  const remaining = await repository.pending();
  assert.equal(remaining.length, 1); assert.equal(remaining[0]!.snapshot!.name, 'Still belongs to A');
  assert.equal(remaining[0]!.baseRevision, 1);
});

test('refresh keeps the same account, logout retains commands, and login retries the same command', async () => {
  const requests: { token: string; body: Record<string, unknown> }[] = [];
  const { sdk, auth } = sdkClient(async (_input, init) => {
    requests.push({ token: new Headers(init?.headers).get('Authorization')!, body: JSON.parse(init!.body as string) });
    if (requests.length === 1) {
      auth.version = 2; // Normal refresh during a batch must not switch identities.
      return new Response(JSON.stringify({ revision: 1 }), { status: 200 });
    }
    if (requests.length === 2) {
      auth.userId = null;
      return new Response(JSON.stringify({ code: 'PGRST301', message: 'Session expired' }), { status: 401 });
    }
    return new Response(JSON.stringify({ revision: 2 }), { status: 200 });
  });
  const repository = new LocalProjectRepository(new MemoryStore(), identity);
  const first = createHistory(createDemoProject('line'));
  await repository.save(first); await repository.save(commitProject(first, { ...first.present, name: 'Second' }));
  const service = new CloudService(sdk);
  await assert.rejects(service.sync(repository), /Session expired/);
  const pending = await repository.pending(); assert.equal(pending.length, 1);
  await assert.rejects(service.sync(repository), /Konto/); assert.equal(requests.length, 2);
  auth.userId = identity.userId;
  assert.deepEqual(await service.sync(repository), { uploaded: 1, remaining: 0, conflicts: [] });
  assert.equal(requests[0]!.token, `Bearer ${identity.userId}:1`);
  assert.equal(requests[1]!.token, `Bearer ${identity.userId}:1`);
  assert.equal(requests[2]!.token, `Bearer ${identity.userId}:2`);
  assert.deepEqual(requests[1]!.body, requests[2]!.body);
  assert.equal(requests[2]!.body.p_command_id, pending[0]!.id);
});

test('download cannot import a switched account response into the previous namespace', async () => {
  const project = createDemoProject('line'); const tokens: string[] = [];
  const { sdk, auth } = sdkClient(async (_input, init) => {
    tokens.push(new Headers(init?.headers).get('Authorization')!);
    auth.userId = otherId; // Sign-in changes while the read is in flight.
    return new Response(JSON.stringify([{ id: 'cloud-project-a', snapshot: project, revision: 1 }]), { status: 200 });
  });
  const repository = new LocalProjectRepository(new MemoryStore(), identity);
  await assert.rejects(new CloudService(sdk).download(repository), /Konto/);
  assert.deepEqual(await repository.list(), []);
  assert.deepEqual(tokens, [`Bearer ${identity.userId}:1`]);
});

test('stored session identity is not trusted without validating its exact access token', async () => {
  let requests = 0;
  const { sdk } = sdkClient(async () => { requests++; return new Response('{}', { status: 200 }); });
  sdk.auth.getSession = (async () => ({ data: { session: { user: { id: identity.userId }, access_token: `${otherId}:1` } }, error: null })) as typeof sdk.auth.getSession;
  const repository = new LocalProjectRepository(new MemoryStore(), identity);
  await repository.save(createHistory(createDemoProject('line')));
  await assert.rejects(new CloudService(sdk).sync(repository), /Konto/);
  assert.equal(requests, 0); assert.equal((await repository.pending()).length, 1);
});

test('publication and share mutations require the account captured by their caller', async () => {
  const requests: string[] = [];
  const { sdk, auth } = sdkClient(async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ id: 'publication-a' }), { status: 200 });
  });
  const service = new CloudService(sdk);
  await service.publishProject('project-a', 1, identity.userId);
  assert.equal(requests.length, 1);
  auth.userId = otherId;
  await assert.rejects(service.createShareLink('publication-a', undefined, identity.userId), /Konto/);
  await assert.rejects(service.publishProject('project-a', 1, identity.userId), /Konto/);
  await assert.rejects(service.revokeShareLink('link-a', identity.userId), /Konto/);
  assert.equal(requests.length, 1);
});
