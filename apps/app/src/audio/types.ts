import type { AudioAsset } from '@choreoflow/core';
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 600;
export const LOCAL_AUDIO_PREFIX = 'choreoflow-audio://';
export interface ResolvedAudio { uri: string; release(): void }
export interface ImportedAudio { asset: AudioAsset; waveform: number[] | null }
export function validateAudioFile(name: string, size: number, mimeType: string): string {
  const extension = name.toLowerCase().split('.').at(-1) ?? '';
  if (!['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff'].includes(extension)) throw new Error('Bitte eine Audiodatei wählen: MP3, WAV, M4A, AAC, OGG, FLAC oder AIFF. Das Gerät muss das Format unterstützen.');
  if (mimeType && !mimeType.startsWith('audio/') && !['application/octet-stream', 'application/ogg', 'video/mp4'].includes(mimeType)) throw new Error('Die ausgewählte Datei ist keine unterstützte Audiodatei.');
  if (!Number.isFinite(size) || size <= 0 || size > MAX_AUDIO_BYTES) throw new Error('Die Audiodatei muss zwischen 1 Byte und 20 MB groß sein.');
  return extension;
}
export function validateDuration(duration: number): void {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_AUDIO_SECONDS) throw new Error('Die Musik muss eine lesbare Dauer von höchstens 10 Minuten haben.');
}
