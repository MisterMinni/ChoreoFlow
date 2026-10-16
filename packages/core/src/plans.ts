export type PlanId = 'free' | 'pro';
export interface PlanLimits {
  activeProjects: number | null; reusableCasts: number | null; cloudStorageBytes: number;
  additionalEditors: number; historyDays: number; videoHeight: 720 | 1080;
  videoWatermark: boolean; detailedPdf: boolean;
}
export const PLAN_LIMITS: Readonly<Record<PlanId, Readonly<PlanLimits>>> = Object.freeze({
  free: Object.freeze({ activeProjects: 3, reusableCasts: 3, cloudStorageBytes: 100 * 1024 * 1024, additionalEditors: 0, historyDays: 0, videoHeight: 720, videoWatermark: true, detailedPdf: false }),
  pro: Object.freeze({ activeProjects: null, reusableCasts: null, cloudStorageBytes: 1024 * 1024 * 1024, additionalEditors: 4, historyDays: 30, videoHeight: 1080, videoWatermark: false, detailedPdf: true }),
});
/** Technical import limits are shared by all plans. */
export const TECHNICAL_LIMITS = Object.freeze({ people: 100, formations: 200, importBytes: 10 * 1024 * 1024, durationSeconds: 3600, audioAssets: 100, props: 100, notes: 1000 });
export function canCreateProject(plan: PlanId, activeOwnedProjects: number): boolean { const max = PLAN_LIMITS[plan].activeProjects; return max === null || activeOwnedProjects < max; }
export function canCreateCast(plan: PlanId, ownedCasts: number): boolean { const max = PLAN_LIMITS[plan].reusableCasts; return max === null || ownedCasts < max; }
export function canUpload(plan: PlanId, currentBytes: number, additionalBytes: number): boolean { return additionalBytes >= 0 && currentBytes >= 0 && currentBytes + additionalBytes <= PLAN_LIMITS[plan].cloudStorageBytes; }
/** Export, local recovery, read access and own-data retrieval remain unconditional. */
export function planAfterDowngrade(projectIds: string[], keepActiveIds: string[]): { active: string[]; readOnly: string[] } {
  const active = [...new Set(keepActiveIds)].filter(id => projectIds.includes(id)).slice(0, PLAN_LIMITS.free.activeProjects!);
  return { active, readOnly: projectIds.filter(id => !active.includes(id)) };
}
