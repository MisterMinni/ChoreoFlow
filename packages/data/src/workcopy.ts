import { assertValidProject, type Project } from "@choreoflow/core";
import { createSyncId } from "./repository";
import type { AuthenticatedRpc } from "./team";
import type { ProjectRepository } from "./types";

export interface PendingWorkcopySave {
  commandId: string;
  baseRevision: number;
  snapshot: Project;
}
export interface CloudOrigin {
  userId: string;
  cloudProjectId: string;
  remoteProjectId: string;
  revision: number;
  pending?: PendingWorkcopySave;
}
export interface SavedCloudWorkcopy {
  id: string;
  revision: number;
  fingerprint: string;
}
export class CloudWorkcopyConflictError extends Error {
  constructor(cause?: unknown) {
    super(
      "Der Cloud-Stand wurde inzwischen geändert. Deine Arbeitskopie und die ausstehende Änderung bleiben erhalten. Bitte beide Stände vergleichen; es wurde nichts überschrieben.",
      { cause },
    );
    this.name = "CloudWorkcopyConflictError";
  }
}
const queues = new WeakMap<
  ProjectRepository,
  Map<string, Promise<SavedCloudWorkcopy>>
>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

function readOrigin(
  value: unknown,
  expectedUserId: string,
  localId: string,
): CloudOrigin {
  if (!value || typeof value !== "object")
    throw new Error("Diese lokale Arbeitskopie hat keine Cloud-Zuordnung.");
  const origin = value as CloudOrigin;
  if (origin.userId !== expectedUserId)
    throw new Error(
      "Diese Arbeitskopie gehört zu einem anderen Cloud-Konto. Melde dich mit dem ursprünglichen Konto an.",
    );
  if (
    !uuid.test(origin.userId) ||
    !uuid.test(origin.cloudProjectId) ||
    typeof origin.remoteProjectId !== "string" ||
    !origin.remoteProjectId ||
    origin.remoteProjectId === localId ||
    !Number.isSafeInteger(origin.revision) ||
    origin.revision < 1
  )
    throw new Error(
      "Die Cloud-Zuordnung der Arbeitskopie ist ungültig. Lokale Daten bleiben erhalten.",
    );
  if (origin.pending) {
    if (
      !uuid.test(origin.pending.commandId) ||
      origin.pending.baseRevision !== origin.revision ||
      origin.pending.snapshot?.id !== origin.remoteProjectId
    )
      throw new Error(
        "Die ausstehende Cloud-Änderung ist inkonsistent. Lokale Daten bleiben erhalten.",
      );
    assertValidProject(origin.pending.snapshot);
  }
  return clone(origin);
}

/** Serializes retries and new edits for one local working copy without consulting the latest cloud list. */
export function saveCloudWorkcopy(
  service: AuthenticatedRpc,
  localRepository: ProjectRepository,
  localProject: Project,
  expectedUserId: string,
): Promise<SavedCloudWorkcopy> {
  const snapshot = clone(localProject);
  const fingerprint = JSON.stringify(localProject);
  let queue = queues.get(localRepository);
  if (!queue) {
    queue = new Map();
    queues.set(localRepository, queue);
  }
  const previous = queue.get(snapshot.id) ?? Promise.resolve();
  const task = previous
    .catch(() => undefined)
    .then(() =>
      save(service, localRepository, snapshot, fingerprint, expectedUserId),
    );
  queue.set(snapshot.id, task);
  const cleanup = () => {
    if (queue!.get(snapshot.id) === task) queue!.delete(snapshot.id);
  };
  void task.then(cleanup, cleanup);
  return task;
}

async function save(
  service: AuthenticatedRpc,
  repository: ProjectRepository,
  localProject: Project,
  fingerprint: string,
  userId: string,
): Promise<SavedCloudWorkcopy> {
  assertValidProject(localProject);
  if (repository.identity.kind !== "local")
    throw new Error(
      "Eine Cloud-Arbeitskopie benötigt den getrennten lokalen Projektspeicher.",
    );
  if (!uuid.test(userId))
    throw new Error(
      "Für diese Arbeitskopie ist kein gültiges Konto angemeldet.",
    );
  const key = `origin:${localProject.id}`;
  let origin = readOrigin(
    await repository.getSetting(key),
    userId,
    localProject.id,
  );
  const outbound = clone(localProject);
  outbound.id = origin.remoteProjectId;
  outbound.audio.assets.forEach((asset) => {
    delete asset.localUri;
  });
  assertValidProject(outbound);

  const submit = async (pending: PendingWorkcopySave): Promise<void> => {
    let response: unknown;
    try {
      response = await service.authenticatedRpc(
        "save_project",
        {
          p_project_id: origin.cloudProjectId,
          p_base_revision: pending.baseRevision,
          p_command_id: pending.commandId,
          p_snapshot: pending.snapshot,
        },
        userId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("REVISION_CONFLICT") ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "40001")
      )
        throw new CloudWorkcopyConflictError(error);
      throw error;
    }
    const result = response as {
      project_id?: string;
      revision?: number;
    } | null;
    if (
      !result ||
      result.project_id !== origin.cloudProjectId ||
      !Number.isSafeInteger(result.revision) ||
      result.revision !== pending.baseRevision + 1
    )
      throw new Error(
        "Die Cloud-Antwort enthält keine passende Revision. Die ausstehende Änderung bleibt für einen sicheren erneuten Versuch erhalten.",
      );
    const acknowledged: CloudOrigin = {
      userId: origin.userId,
      cloudProjectId: origin.cloudProjectId,
      remoteProjectId: origin.remoteProjectId,
      revision: result.revision,
    };
    // Compare and acknowledge in one storage transaction. A different tab may
    // already have acknowledged this retry and persisted its next command.
    if (!(await repository.compareAndSetSetting(key, origin, acknowledged)))
      throw new CloudWorkcopyConflictError();
    origin = acknowledged;
  };

  if (origin.pending) {
    const pendingMatchesCurrent = same(origin.pending.snapshot, outbound);
    await submit(origin.pending);
    if (pendingMatchesCurrent)
      return {
        id: origin.cloudProjectId,
        revision: origin.revision,
        fingerprint,
      };
  }
  const pending: PendingWorkcopySave = {
    commandId: createSyncId(),
    baseRevision: origin.revision,
    snapshot: outbound,
  };
  const nextOrigin = { ...origin, pending };
  // Persist before sending: a crash, network error or account switch can retry the identical command.
  if (!(await repository.compareAndSetSetting(key, origin, nextOrigin)))
    throw new CloudWorkcopyConflictError();
  origin = nextOrigin;
  await submit(pending);
  return { id: origin.cloudProjectId, revision: origin.revision, fingerprint };
}
