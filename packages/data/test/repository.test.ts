import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { commitProject, createDemoProject, createHistory, undo } from '@choreoflow/core';
import { LocalConflictError, LocalProjectRepository } from '../src/repository';
import { MemoryStore } from '../src/memory-store';
import { IndexedDbStore } from '../src/store.web';
import type { AtomicStore } from '../src/types';

const cloudUser = { kind: 'cloud' as const, userId: 'b07a41a9-adcb-42d8-bd93-82258e38760e' };
const anotherUser = { kind: 'cloud' as const, userId: '800e33c6-49a8-4e8f-bcf6-826e8c68418c' };
const editName = (history: ReturnType<typeof createHistory>, name: string) => commitProject(history, { ...history.present, name });

for (const [name, makeStore] of [
  ['memory', () => new MemoryStore()],
  ['IndexedDB', () => new IndexedDbStore('test-choreoflow', new IDBFactory())],
] as const) {
  test(`${name}: setting compare-and-set is atomic between independent repositories`, async () => {
    const store = makeStore();
    const first = new LocalProjectRepository(store), second = new LocalProjectRepository(store);
    try {
      type Setting = { revision: number; pending: string | null };
      const initial: Setting = { revision: 7, pending: null };
      const pendingA: Setting = { revision: 7, pending: 'command-a' };
      const pendingB: Setting = { revision: 7, pending: 'command-b' };
      assert.equal(await first.compareAndSetSetting('origin:test', undefined, initial), true);
      const outcomes = await Promise.all([
        first.compareAndSetSetting('origin:test', initial, pendingA),
        second.compareAndSetSetting('origin:test', initial, pendingB),
      ]);
      assert.equal(outcomes.filter(Boolean).length, 1);
      const winner = outcomes[0] ? pendingA : pendingB;
      assert.deepEqual(await second.getSetting('origin:test'), winner);
      const before = await first.load();
      assert.equal(await first.compareAndSetSetting('origin:test', initial, { revision: 8, pending: null }), false);
      assert.deepEqual(await second.load(), before);
      assert.equal(await second.compareAndSetSetting('origin:test', winner, { revision: 8, pending: null }), true);
      assert.deepEqual(await first.getSetting('origin:test'), { revision: 8, pending: null });
    } finally { await store.close?.(); }
  });
  test(`${name}: deleting the last project never recreates demo data`, async () => {
    const store = makeStore(); let seeds = 0;
    const seed = () => { seeds++; return [createDemoProject('line')]; };
    const first = new LocalProjectRepository(store, { kind: 'local' }, seed);
    const initial = await first.list(); assert.equal(initial.length, 1);
    await first.remove(initial[0]!.present.id);
    const reopened = new LocalProjectRepository(store, { kind: 'local' }, seed);
    assert.deepEqual(await reopened.list(), []); assert.equal(seeds, 1);
    await store.close?.();
  });
  test(`${name}: edit, undo, settings and outbox survive repository restart`, async () => {
    const store = makeStore(); const repository = new LocalProjectRepository(store);
    const [initial] = await repository.list(); const edited = editName(initial!, 'Persisted rehearsal');
    await repository.save(edited); await repository.setSetting('theme', 'dark');
    const reopened = new LocalProjectRepository(store); const [saved] = await reopened.list();
    assert.deepEqual(saved, edited); assert.equal(await reopened.getSetting('theme'), 'dark');
    const state = await reopened.load();
    assert.equal(state.outbox.length, 1); assert.equal(state.outbox[0]!.actor.kind, 'local');
    assert.deepEqual(state.projects[0], state.histories[state.projects[0]!.id]!.present);
    await reopened.save(undo(saved!));
    assert.equal((await reopened.list())[0]!.present.name, initial!.present.name);
    await store.close?.();
  });
  test(`${name}: two editors cannot silently overwrite one another`, async () => {
    const store = makeStore(); const first = new LocalProjectRepository(store); const second = new LocalProjectRepository(store);
    const [firstVersion] = await first.list(); const [secondVersion] = await second.list();
    await first.save(editName(firstVersion!, 'First edit'));
    await assert.rejects(second.save(editName(secondVersion!, 'Stale edit')), LocalConflictError);
    assert.equal((await second.list())[0]!.present.name, 'First edit');
    assert.equal((await first.pending()).length, 1); await store.close?.();
  });
  test(`${name}: background reads cannot clear a stale editor conflict`, async () => {
    const store = makeStore(); const first = new LocalProjectRepository(store); const second = new LocalProjectRepository(store);
    const [firstVersion] = await first.list(); const [secondVersion] = await second.list();
    await first.save(editName(firstVersion!, 'Important change from another tab'));
    const rejected = commitProject(secondVersion!, { ...secondVersion!.present, stage: { ...secondVersion!.present.stage, width: 13 } });
    await assert.rejects(second.save(rejected), LocalConflictError);
    await second.getSetting('theme'); await second.listCasts(); await second.pending(); await second.load();
    const laterDraft = commitProject(rejected, { ...rejected.present, stage: { ...rejected.present.stage, width: 14 } });
    await assert.rejects(second.save(laterDraft), LocalConflictError);
    assert.equal((await first.list())[0]!.present.name, 'Important change from another tab');
    assert.equal((await first.pending()).length, 1);
    const [reloaded] = await second.list();
    await second.save(editName(reloaded!, 'Edit after explicit reload'));
    assert.equal((await first.list())[0]!.present.name, 'Edit after explicit reload');
    await store.close?.();
  });
  for (const download of ['already acknowledged', 'new remote revision'] as const) {
    test(`${name}: ${download} download cannot clear a stale editor conflict`, async () => {
      const store = makeStore();
      try {
        const staleEditor = new LocalProjectRepository(store, cloudUser);
        const otherEditor = new LocalProjectRepository(store, cloudUser);
        const project = createDemoProject('line');
        await staleEditor.acceptRemote(project, 1, 'cloud-project-a');
        const [staleVersion] = await staleEditor.list();
        const [otherVersion] = await otherEditor.list();
        const newer = editName(otherVersion!, 'Important work from another editor');
        const rejectedDraft = commitProject(staleVersion!, {
          ...staleVersion!.present,
          stage: { ...staleVersion!.present.stage, width: 13 },
        });
        if (download === 'already acknowledged') {
          await otherEditor.save(newer);
          const [entry] = await otherEditor.pending();
          await otherEditor.acknowledge(entry!.id, 2);
          await assert.rejects(staleEditor.save(rejectedDraft), LocalConflictError);
        }
        // A background download returns no editor history. Neither persisting a
        // new revision nor accepting the same acknowledged revision reloads it.
        await staleEditor.acceptRemote(newer.present, 2, 'cloud-project-a');
        await assert.rejects(staleEditor.save(rejectedDraft), LocalConflictError);
        const laterDraft = commitProject(rejectedDraft, {
          ...rejectedDraft.present,
          stage: { ...rejectedDraft.present.stage, width: 14 },
        });
        assert.equal(laterDraft.present.revision, newer.present.revision + 1);
        await assert.rejects(staleEditor.save(laterDraft), LocalConflictError);
        const preserved = await staleEditor.load();
        assert.deepEqual(preserved.projects[0], newer.present);
        assert.deepEqual(preserved.histories[project.id], download === 'already acknowledged' ? newer : createHistory(newer.present));
        assert.equal(preserved.cloudRevisions[project.id], 2);
        assert.deepEqual(preserved.outbox, []);

        // Returning the current editor history explicitly establishes the new
        // baseline, so an edit after reloading can be persisted normally.
        const [reloaded] = await staleEditor.list();
        const next = editName(reloaded!, 'Edit after explicit reload');
        await staleEditor.save(next);
        assert.deepEqual((await staleEditor.load()).histories[project.id], next);
        const [entry] = await staleEditor.pending();
        assert.equal(entry!.baseRevision, 2);
        assert.deepEqual(entry!.snapshot, next.present);
      } finally { await store.close?.(); }
    });
  }
  test(`${name}: identities isolate projects, credentials are not part of the workspace`, async () => {
    const store = makeStore();
    const local = new LocalProjectRepository(store); const cloud = new LocalProjectRepository(store, cloudUser); const other = new LocalProjectRepository(store, anotherUser);
    assert.equal((await local.list()).length, 1); assert.equal((await cloud.list()).length, 0);
    await cloud.save(createHistory(createDemoProject('line')));
    assert.equal((await cloud.list()).length, 1); assert.equal((await other.list()).length, 0);
    const state = await cloud.load(); assert.match(state.cloudProjectIds['demo-line']!, /^[0-9a-f-]{36}$/);
    assert.ok(state.outbox[0]!.snapshot); assert.equal('access_token' in state, false);
    await store.close?.();
  });
  test(`${name}: failed transaction preserves history and outbox together`, async () => {
    const underlying = makeStore(); let fail = false;
    const store: AtomicStore = { transact: (key, update) => underlying.transact(key, value => { const next = update(value); if (fail) throw new Error('Storage quota'); return next; }) };
    const repository = new LocalProjectRepository(store); const [initial] = await repository.list();
    fail = true; await assert.rejects(repository.save(editName(initial!, 'Must not persist')), /Storage quota/); fail = false;
    assert.deepEqual((await repository.list())[0], initial); assert.equal((await repository.pending()).length, 0);
    await underlying.close?.();
  });
  test(`${name}: unknown storage versions fail without replacing stored data`, async () => {
    const store = makeStore();
    await store.transact('local:development', () => ({ value: { schemaVersion: 99, important: 'keep me' }, result: null }));
    const repository = new LocalProjectRepository(store);
    await assert.rejects(repository.load(), /Speicherversion/);
    const preserved = await store.transact('local:development', value => ({ value, result: value }));
    assert.deepEqual(preserved, { schemaVersion: 99, important: 'keep me' }); await store.close?.();
  });
  test(`${name}: delayed downloads cannot roll back a newer acknowledged project`, async () => {
    const store = makeStore(); const repository = new LocalProjectRepository(store, cloudUser);
    const first = createDemoProject('line');
    await repository.acceptRemote(first, 1, 'cloud-project-a');
    const [loaded] = await repository.list();
    const edited = commitProject(loaded!, {
      ...loaded!.present,
      name: 'Newer acknowledged work',
      audio: { assets: [{ id: 'local-audio', name: 'Rehearsal.wav', mimeType: 'audio/wav', durationSeconds: 10, sizeBytes: 2000, localUri: 'file:///private/rehearsal.wav' }], clips: [] },
    });
    await repository.save(edited);
    const [entry] = await repository.pending(); await repository.acknowledge(entry!.id, 2);
    await assert.rejects(repository.acceptRemote(first, 1, 'cloud-project-a'), LocalConflictError);
    assert.deepEqual((await repository.list())[0], edited);
    assert.equal((await repository.load()).cloudRevisions[first.id], 2);
    // Uploads strip device-local paths. Re-downloading that same revision must
    // preserve this device's original media reference and undo history.
    const remoteSnapshot = structuredClone(edited.present); delete remoteSnapshot.audio.assets[0]!.localUri;
    await repository.acceptRemote(remoteSnapshot, 2, 'cloud-project-a');
    assert.deepEqual((await repository.list())[0], edited);
    await store.close?.();
  });
}

test('IndexedDB persists across actual database connection close/reopen', async () => {
  const factory = new IDBFactory(); const firstStore = new IndexedDbStore('restart', factory); const first = new LocalProjectRepository(firstStore);
  const [history] = await first.list(); await first.save(editName(history!, 'After reopening')); await firstStore.close();
  const secondStore = new IndexedDbStore('restart', factory); const second = new LocalProjectRepository(secondStore);
  assert.equal((await second.list())[0]!.present.name, 'After reopening'); await secondStore.close();
});

test('acknowledgements retain later edits and advance their server base revision', async () => {
  const repository = new LocalProjectRepository(new MemoryStore(), cloudUser);
  const first = createHistory(createDemoProject('line')); await repository.save(first);
  await repository.save(editName(first, 'Later edit'));
  const [firstEntry, secondEntry] = await repository.pending();
  await repository.acknowledge(firstEntry!.id, 1);
  const remaining = await repository.pending(); assert.equal(remaining.length, 1);
  assert.equal(remaining[0]!.id, secondEntry!.id); assert.equal(remaining[0]!.baseRevision, 1); assert.equal(remaining[0]!.snapshot!.name, 'Later edit');
  await assert.rejects(repository.acceptRemote(first.present, 1), LocalConflictError);
});
