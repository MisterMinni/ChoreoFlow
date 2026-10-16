import { createPlatformStore } from './platform';
import { identityNamespace, LocalProjectRepository } from './repository';
import type { ProjectRepository, RepositoryIdentity } from './types';
export * from './types';
export { LocalProjectRepository, LocalConflictError, identityNamespace } from './repository';
export { CloudService, createCloudClient, getCloudService } from './cloud';
export type { PublicCloudConfig, CloudProject, SyncResult } from './cloud';
export { TeamService, teamErrorMessage } from './team';
export type { ProjectRole, MemberRole, ProjectAccess, ProjectTeam, TeamMember, TeamInvitation, CreatedInvitation } from './team';
export { saveCloudWorkcopy, CloudWorkcopyConflictError } from './workcopy';
export type { CloudOrigin, PendingWorkcopySave, SavedCloudWorkcopy } from './workcopy';

const repositories = new Map<string, ProjectRepository>();
let store: ReturnType<typeof createPlatformStore> | undefined;
export async function getRepository(options: { identity?: RepositoryIdentity } = {}): Promise<ProjectRepository> {
  const identity = options.identity ?? { kind: 'local' };
  const namespace = identityNamespace(identity);
  let repository = repositories.get(namespace);
  if (!repository) { store ??= createPlatformStore(); repository = new LocalProjectRepository(store, identity); repositories.set(namespace, repository); }
  await repository.load();
  return repository;
}
