import * as DocumentPicker from 'expo-document-picker';
import { createId, type AudioAsset } from '@choreoflow/core';
import { LOCAL_AUDIO_PREFIX, validateAudioFile, validateDuration, type ImportedAudio, type ResolvedAudio } from './types';
import { BrowserAudioCache } from './cache.web';
import { localAudioFilename, validateAudioBytes } from './transfer';
async function durationOf(blob: Blob): Promise<number> {
  const uri = URL.createObjectURL(blob); const audio = new Audio(); audio.preload = 'metadata';
  try {
    return await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Die Audio-Metadaten konnten nicht rechtzeitig geladen werden.')), 15000);
      audio.onloadedmetadata = () => { clearTimeout(timer); resolve(audio.duration); };
      audio.onerror = () => { clearTimeout(timer); reject(new Error('Der Browser kann dieses Audioformat nicht lesen. Bitte WAV oder MP3 versuchen.')); };
      audio.src = uri;
    });
  } finally { audio.onloadedmetadata = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(uri); }
}
async function waveformOf(blob: Blob, duration: number): Promise<number[] | null> {
  // Avoid large decoded buffers on low-memory devices. Import/playback still work.
  if (blob.size > 6 * 1024 * 1024 || duration > 180 || typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const samples = decoded.getChannelData(0); const count = 120; const block = Math.max(1, Math.floor(samples.length / count));
    return Array.from({ length: count }, (_, index) => {
      let peak = 0;
      for (let sample = index * block; sample < Math.min(samples.length, (index + 1) * block); sample++) peak = Math.max(peak, Math.abs(samples[sample]!));
      return peak;
    });
  } catch { return null; } finally { await context.close(); }
}
/** Exported for deterministic browser tests using generated WAV fixtures. */
export async function importAudioFile(file: File): Promise<ImportedAudio> {
  const extension = validateAudioFile(file.name, file.size, file.type);
  const durationSeconds = await durationOf(file); validateDuration(durationSeconds);
  const id = createId('audio');
  const asset: AudioAsset = { id, name: file.name, mimeType: file.type || `audio/${extension}`, durationSeconds, sizeBytes: file.size, localUri: `${LOCAL_AUDIO_PREFIX}${id}.${extension}` };
  const cached = await cacheAudioBytes(asset, await file.arrayBuffer());
  return { asset: cached, waveform: await getAudioWaveform(cached) };
}
export async function pickAudio(): Promise<ImportedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'application/ogg'], multiple: false, base64: false });
  if (result.canceled) return null;
  const file = result.assets[0]?.file;
  if (!file) throw new Error('Der Browser hat keine lesbare Datei geliefert.');
  return importAudioFile(file);
}
export async function resolveAudio(asset: AudioAsset): Promise<ResolvedAudio> {
  localAudioFilename(asset);
  const stored = await cache.read(asset.id);
  if (!stored?.blob) throw new Error('Die lokale Musikdatei fehlt. Bitte erneut importieren. Lautlose Wiedergabe bleibt möglich.');
  validateAudioBytes(asset, await stored.blob.arrayBuffer());
  const uri = URL.createObjectURL(stored.blob); return { uri, release: () => URL.revokeObjectURL(uri) };
}
const cache = new BrowserAudioCache(durationOf, waveformOf);
export async function getAudioWaveform(asset: AudioAsset): Promise<number[] | null> { return (await cache.read(asset.id))?.waveform ?? null; }
export const readAudioBytes = (asset: AudioAsset): Promise<ArrayBuffer> => cache.readAudioBytes(asset);
export const cacheAudioBytes = (asset: AudioAsset, bytes: ArrayBuffer): Promise<AudioAsset> => cache.cacheAudioBytes(asset, bytes);
