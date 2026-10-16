export const SCHEMA_VERSION = 1 as const;
export type Id = string;
/** Metres; x right, y upstage, z above floor. Audience looks toward positive y. */
export interface Vec3 { x: number; y: number; z: number }
export interface Person { id: Id; name: string; label: string; color: string; radius: number }
export interface Group { id: Id; name: string; personIds: Id[]; color: string }
export interface Cast { id: Id; name: string; revision: number; people: Person[]; groups: Group[] }
export interface Stage { width: number; depth: number; gridSize: number }
export interface Formation {
  id: Id; name: string; holdSeconds: number;
  positions: Record<Id, Vec3>;
  /** Degrees around z. 0 faces audience (negative y); positive turns counterclockwise. */
  facing: Record<Id, number>;
}
export type Easing = 'linear' | 'ease-in-out';
export type MotionPath =
  | { type: 'line' }
  | { type: 'arc'; control: Vec3 }
  | { type: 'cubic'; control1: Vec3; control2: Vec3 }
  | { type: 'polyline'; points: Vec3[] };
export type FacingMotion =
  | { type: 'fixed'; degrees: number }
  | { type: 'along-path' }
  | { type: 'interpolate'; fromDegrees: number; angleDegrees: number };
interface MotionTiming { delaySeconds: number; durationSeconds: number; easing: Easing }
export interface IndividualMotion extends MotionTiming {
  id: Id; type: 'individual'; personId: Id; path: MotionPath; facing?: FacingMotion;
}
export interface GroupMotion extends MotionTiming {
  id: Id; type: 'group'; personIds: Id[]; pivot: Vec3;
  /** Explicit unwrapped angle: 360/-360/720 must never be normalised away. */
  angleDegrees: number; translation: Vec3; scale: { x: number; y: number };
  /** Optional centre path from pivot to pivot + translation. */
  path?: MotionPath;
  /** Index-ordered fan from -fanDegrees/2 to +fanDegrees/2. */
  fanDegrees?: number;
  /** Additional delay by person; total motion must still fit the transition. */
  staggerSeconds?: Record<Id, number>;
  rotateFacing: boolean;
}
export type Motion = IndividualMotion | GroupMotion;
export interface Transition {
  id: Id; fromFormationId: Id; toFormationId: Id; durationSeconds: number; motions: Motion[];
}
export interface TempoMark { id: Id; timeSeconds: number; bpm: number }
export interface TempoMap { countOffsetSeconds: number; marks: TempoMark[] }
export interface AudioAsset { id: Id; name: string; mimeType: string; durationSeconds: number; sizeBytes: number; localUri?: string }
export interface AudioClip { id: Id; assetId: Id; startSeconds: number; trimStartSeconds: number; trimEndSeconds: number; fadeInSeconds: number; fadeOutSeconds: number; volume: number }
export interface AudioTrack { assets: AudioAsset[]; clips: AudioClip[] }
export interface Prop { id: Id; name: string; position: Vec3; size: Vec3; rotationDegrees: number; startSeconds: number; endSeconds: number }
export interface LiftContact { personA: Id; personB: Id }
export interface LiftPhase { id: Id; type: 'setup' | 'raise' | 'hold' | 'lower'; startSeconds: number; endSeconds: number; heights: Record<Id, number>; contacts: LiftContact[] }
export interface Lift { id: Id; name: string; roles: { personId: Id; role: 'base' | 'flyer' | 'spotter' }[]; phases: LiftPhase[]; note: string }
export interface ProjectNote { id: Id; text: string; timeSeconds?: number }
export interface Marker { id: Id; name: string; timeSeconds: number }
export interface Project {
  schemaVersion: typeof SCHEMA_VERSION; id: Id; name: string; revision: number;
  createdAt: string; updatedAt: string; stage: Stage;
  /** Embedded snapshot; editing a reusable cast never mutates an existing project. */
  castSource?: { id: Id; revision: number };
  people: Person[]; groups: Group[]; formations: Formation[]; transitions: Transition[];
  tempo: TempoMap; audio: AudioTrack; props: Prop[]; lifts: Lift[]; notes: ProjectNote[]; markers: Marker[];
}
export interface ScenePerson { personId: Id; position: Vec3; facingDeg: number }
export interface Scene { timeSeconds: number; durationSeconds: number; formationId: Id | null; transitionId: Id | null; progress: number; people: ScenePerson[] }
export interface Folder { id: Id; name: string; parentId: Id | null }
export type ProjectRole = 'owner' | 'editor' | 'reader';
export interface ProjectMember { userId: Id; role: ProjectRole }
export interface Publication { id: Id; projectId: Id; revision: number; createdAt: string; snapshot: Project; includeMusic: boolean }
