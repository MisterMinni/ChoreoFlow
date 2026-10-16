import assert from "node:assert/strict";
import { test } from "node:test";
import {
  commitProject,
  createDemoProject,
  createHistory,
  type Project,
} from "@choreoflow/core";
import { LocalProjectRepository } from "../src/repository";
import { MemoryStore } from "../src/memory-store";
import {
  CloudWorkcopyConflictError,
  saveCloudWorkcopy,
  type CloudOrigin,
} from "../src/workcopy";
import type { AuthenticatedRpc } from "../src/team";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "33333333-3333-4333-8333-333333333333";
const cloudProjectId = "22222222-2222-4222-8222-222222222222";
const source = createDemoProject("line");
const initialOrigin: CloudOrigin = {
  userId,
  cloudProjectId,
  remoteProjectId: source.id,
  revision: 7,
};
async function fixture(id = "local-workcopy-one") {
  const repository = new LocalProjectRepository(
    new MemoryStore(),
    { kind: "local" },
    () => [],
  );
  const project = { ...source, id };
  await repository.save(createHistory(project));
  await repository.setSetting(`origin:${id}`, initialOrigin);
  return { repository, project, key: `origin:${id}` };
}
const response = (args: Record<string, unknown>) => ({
  project_id: cloudProjectId,
  revision: Number(args.p_base_revision) + 1,
  duplicate: false,
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("independent repositories cannot replace another tab's pending command from a stale origin", async () => {
  const store = new MemoryStore();
  const first = new LocalProjectRepository(store, { kind: "local" }, () => []);
  const second = new LocalProjectRepository(store, { kind: "local" }, () => []);
  const project = { ...source, id: "shared-workcopy" };
  const key = `origin:${project.id}`;
  await first.setSetting(key, initialOrigin);
  const read = deferred(), resumeStaleRead = deferred(), accepted = deferred(), finishFirst = deferred();
  const originalRead = second.getSetting.bind(second);
  let pauseRead = true;
  second.getSetting = async <T>(settingKey: string) => {
    const value = await originalRead<T>(settingKey);
    if (pauseRead && settingKey === key) {
      pauseRead = false;
      read.resolve();
      await resumeStaleRead.promise;
    }
    return value;
  };
  const requests: Record<string, unknown>[] = [];
  const service: AuthenticatedRpc = {
    async authenticatedRpc(_name, args) {
      requests.push(structuredClone(args));
      if (requests.length > 1) throw new Error("REVISION_CONFLICT");
      accepted.resolve();
      await finishFirst.promise;
      return response(args);
    },
  };
  const losing = saveCloudWorkcopy(service, second, { ...project, name: "Stale tab" }, userId);
  const rejected = assert.rejects(losing, CloudWorkcopyConflictError);
  await read.promise;
  const winning = saveCloudWorkcopy(service, first, project, userId);
  const winningResult = winning.then(value => ({ value }), error => ({ error }));
  await accepted.promise;
  resumeStaleRead.resolve();
  try {
    await rejected;
    assert.equal(requests.length, 1, "the stale tab must fail before submitting another command");
    assert.equal((await first.getSetting<CloudOrigin>(key))!.pending!.commandId, requests[0]!.p_command_id);
  } finally { finishFirst.resolve(); }
  const result = await winningResult;
  assert.ok("value" in result);
  assert.deepEqual(await first.getSetting(key), { ...initialOrigin, revision: 8 });
});

test("workcopy sends the remote root ID but never changes the local project or account", async () => {
  const { repository, project, key } = await fixture();
  project.audio = {
    assets: [
      {
        id: "song",
        name: "Local.wav",
        mimeType: "audio/wav",
        durationSeconds: 2,
        sizeBytes: 2000,
        localUri: "file:///private/song.wav",
      },
    ],
    clips: [],
  };
  const fingerprint = JSON.stringify(project);
  const service: AuthenticatedRpc = {
    async authenticatedRpc(name, args, expectedUserId) {
      assert.equal(name, "save_project");
      assert.equal(expectedUserId, userId);
      assert.equal(args.p_project_id, cloudProjectId);
      assert.equal(args.p_base_revision, 7);
      const snapshot = args.p_snapshot as Project;
      assert.equal(snapshot.id, source.id);
      assert.equal(snapshot.audio.assets[0]!.localUri, undefined);
      const stored = (await repository.getSetting<CloudOrigin>(key))!;
      assert.equal(stored.pending!.commandId, args.p_command_id);
      assert.deepEqual(stored.pending!.snapshot, snapshot);
      return response(args);
    },
  };
  assert.deepEqual(
    await saveCloudWorkcopy(service, repository, project, userId),
    { id: cloudProjectId, revision: 8, fingerprint },
  );
  assert.equal(JSON.stringify(project), fingerprint);
  assert.equal((await repository.list())[0]!.present.id, project.id);
  assert.deepEqual(await repository.getSetting(key), {
    ...initialOrigin,
    revision: 8,
  });
});

test("a delayed acknowledgement cannot erase a newer pending command from another repository", async () => {
  const store = new MemoryStore();
  const first = new LocalProjectRepository(store, { kind: "local" }, () => []);
  const second = new LocalProjectRepository(store, { kind: "local" }, () => []);
  const project = { ...source, id: "shared-ack-workcopy" };
  const key = `origin:${project.id}`;
  await first.setSetting(key, initialOrigin);
  const ackReached = deferred(), finishAck = deferred();
  const originalCompare = first.compareAndSetSetting.bind(first);
  first.compareAndSetSetting = async (settingKey, expected, value) => {
    if (settingKey === key && !(value as CloudOrigin).pending) {
      ackReached.resolve();
      await finishAck.promise;
    }
    return originalCompare(settingKey, expected, value);
  };
  const requests: Record<string, unknown>[] = [];
  let confirmedCommand: unknown;
  const service: AuthenticatedRpc = {
    async authenticatedRpc(_name, args) {
      requests.push(structuredClone(args));
      if (confirmedCommand === undefined) confirmedCommand = args.p_command_id;
      if (args.p_command_id === confirmedCommand) return response(args);
      throw new Error("Offline after the next command was persisted");
    },
  };
  const delayed = saveCloudWorkcopy(service, first, project, userId);
  const rejected = assert.rejects(delayed, CloudWorkcopyConflictError);
  await ackReached.promise;
  const newer = { ...project, name: "Other tab's newer draft" };
  let pendingBeforeAck: CloudOrigin | undefined;
  try {
    await assert.rejects(saveCloudWorkcopy(service, second, newer, userId), /Offline/);
    pendingBeforeAck = await second.getSetting<CloudOrigin>(key);
    assert.equal(pendingBeforeAck!.revision, 8);
    assert.equal(pendingBeforeAck!.pending!.snapshot.name, newer.name);
    assert.notEqual(pendingBeforeAck!.pending!.commandId, confirmedCommand);
    assert.equal(requests[0]!.p_command_id, requests[1]!.p_command_id);
    assert.equal(requests[2]!.p_base_revision, 8);
  } finally { finishAck.resolve(); }
  await rejected;
  assert.deepEqual(await first.getSetting(key), pendingBeforeAck);
  // The retry must still use the preserved command, never a freshly healed base.
  await assert.rejects(saveCloudWorkcopy(service, second, newer, userId), /Offline/);
  assert.deepEqual(requests[3], requests[2]);
});

test("wrong account is rejected before requests and leaves origin and draft untouched", async () => {
  const { repository, project, key } = await fixture();
  let calls = 0;
  const service: AuthenticatedRpc = {
    async authenticatedRpc() {
      calls++;
      throw new Error("Unexpected request");
    },
  };
  await assert.rejects(
    saveCloudWorkcopy(service, repository, project, otherId),
    /anderen Cloud-Konto/,
  );
  assert.equal(calls, 0);
  assert.deepEqual(await repository.getSetting(key), initialOrigin);
  assert.equal((await repository.list())[0]!.present.id, project.id);
});

test("offline retry sends the identical stored command before a newer local snapshot", async () => {
  const { repository, project, key } = await fixture();
  const calls: Record<string, unknown>[] = [];
  const service: AuthenticatedRpc = {
    async authenticatedRpc(_name, args) {
      calls.push(structuredClone(args));
      if (calls.length === 1) throw new Error("Offline");
      return response(args);
    },
  };
  await assert.rejects(
    saveCloudWorkcopy(service, repository, project, userId),
    /Offline/,
  );
  const pending = (await repository.getSetting<CloudOrigin>(key))!.pending!;
  const newer = commitProject(createHistory(project), {
    ...project,
    name: "Newer local work",
  }).present;
  const result = await saveCloudWorkcopy(service, repository, newer, userId);
  assert.deepEqual(calls[1], calls[0]);
  assert.equal(calls[1]!.p_command_id, pending.commandId);
  assert.equal(calls[2]!.p_base_revision, 8);
  assert.notEqual(calls[2]!.p_command_id, pending.commandId);
  assert.equal((calls[2]!.p_snapshot as Project).name, "Newer local work");
  assert.equal(result.revision, 9);
  assert.equal(result.fingerprint, JSON.stringify(newer));
  assert.deepEqual(await repository.getSetting(key), {
    ...initialOrigin,
    revision: 9,
  });
});

test("failed local acknowledgement retries the same successful remote command only once", async () => {
  const { repository, project, key } = await fixture();
  const originalCompare = repository.compareAndSetSetting.bind(repository);
  let failAck = true;
  repository.compareAndSetSetting = async (settingKey, expected, value) => {
    if (failAck && settingKey === key && !(value as CloudOrigin).pending)
      throw new Error("Storage quota");
    return originalCompare(settingKey, expected, value);
  };
  const commands: unknown[] = [];
  const service: AuthenticatedRpc = {
    async authenticatedRpc(_name, args) {
      commands.push(structuredClone(args));
      return response(args);
    },
  };
  await assert.rejects(
    saveCloudWorkcopy(service, repository, project, userId),
    /Storage quota/,
  );
  assert.ok((await repository.getSetting<CloudOrigin>(key))!.pending);
  failAck = false;
  assert.equal(
    (await saveCloudWorkcopy(service, repository, project, userId)).revision,
    8,
  );
  assert.deepEqual(commands[1], commands[0]);
  assert.equal(commands.length, 2);
  assert.equal(
    (await repository.getSetting<CloudOrigin>(key))!.pending,
    undefined,
  );
});

test("a second restored copy stays on its own stale base and preserves its conflict", async () => {
  const first = await fixture("copy-a"),
    second = await fixture("copy-b");
  let serverRevision = 7;
  const service: AuthenticatedRpc = {
    async authenticatedRpc(_name, args) {
      if (args.p_base_revision !== serverRevision)
        throw new Error("REVISION_CONFLICT");
      serverRevision++;
      return { project_id: cloudProjectId, revision: serverRevision };
    },
  };
  await saveCloudWorkcopy(service, first.repository, first.project, userId);
  await assert.rejects(
    saveCloudWorkcopy(service, second.repository, second.project, userId),
    CloudWorkcopyConflictError,
  );
  const conflict = (await second.repository.getSetting<CloudOrigin>(
    second.key,
  ))!;
  assert.equal(conflict.revision, 7);
  assert.equal(conflict.pending!.baseRevision, 7);
  const command = conflict.pending!.commandId;
  await assert.rejects(
    saveCloudWorkcopy(service, second.repository, second.project, userId),
    CloudWorkcopyConflictError,
  );
  assert.equal(
    (await second.repository.getSetting<CloudOrigin>(second.key))!.pending!
      .commandId,
    command,
  );
  assert.equal((await second.repository.list())[0]!.present.id, "copy-b");
  assert.equal(serverRevision, 8);
});

test("parallel saves for one copy serialize their requests and revision acknowledgements", async () => {
  const { repository, project } = await fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bases: unknown[] = [];
  const service: AuthenticatedRpc = {
    async authenticatedRpc(_name, args) {
      bases.push(args.p_base_revision);
      if (bases.length === 1) await gate;
      return response(args);
    },
  };
  const first = saveCloudWorkcopy(service, repository, project, userId);
  const newer = commitProject(createHistory(project), {
    ...project,
    name: "Queued work",
  }).present;
  const second = saveCloudWorkcopy(service, repository, newer, userId);
  // The gate is released only after the first request enters the stub.
  while (bases.length === 0)
    await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(bases, [7]);
  release();
  const results = await Promise.all([first, second]);
  assert.deepEqual(bases, [7, 8]);
  assert.deepEqual(
    results.map((result) => result.revision),
    [8, 9],
  );
});

test("unexpected server revision keeps the pending command instead of acknowledging unrelated data", async () => {
  const { repository, project, key } = await fixture();
  const service: AuthenticatedRpc = {
    async authenticatedRpc() {
      return { project_id: cloudProjectId, revision: 99 };
    },
  };
  await assert.rejects(
    saveCloudWorkcopy(service, repository, project, userId),
    /passende Revision/,
  );
  const stored = (await repository.getSetting<CloudOrigin>(key))!;
  assert.equal(stored.revision, 7);
  assert.ok(stored.pending);
});
