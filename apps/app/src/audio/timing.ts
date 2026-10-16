import type { AudioClip } from '@choreoflow/core';
export const clipDuration = (clip: AudioClip): number => Math.max(0, clip.trimEndSeconds - clip.trimStartSeconds);
export const clipEnd = (clip: AudioClip): number => clip.startSeconds + clipDuration(clip);
export const clipSourceTime = (clip: AudioClip, timelineTime: number): number => clip.trimStartSeconds + Math.max(0, Math.min(clipDuration(clip), timelineTime - clip.startSeconds));
export const clipTimelineTime = (clip: AudioClip, sourceTime: number): number => clip.startSeconds + Math.max(0, Math.min(clipDuration(clip), sourceTime - clip.trimStartSeconds));
export function clipVolume(clip: AudioClip, timelineTime: number): number {
  const position = timelineTime - clip.startSeconds; const length = clipDuration(clip);
  if (position < 0 || position >= length) return 0;
  const fadeIn = clip.fadeInSeconds > 0 ? Math.min(1, position / clip.fadeInSeconds) : 1;
  const fadeOut = clip.fadeOutSeconds > 0 ? Math.min(1, (length - position) / clip.fadeOutSeconds) : 1;
  return Math.max(0, Math.min(1, clip.volume)) * fadeIn * fadeOut;
}
