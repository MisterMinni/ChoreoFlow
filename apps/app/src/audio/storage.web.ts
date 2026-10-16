import * as DocumentPicker from 'expo-document-picker';
import { createId, type AudioAsset } from '@choreoflow/core';
import { LOCAL_AUDIO_PREFIX, validateAudioFile, validateDuration, type ImportedAudio, type ResolvedAudio } from './types';

interface StoredAudio { asset: AudioAsset; blob: Blob; waveform: number[] | null }
let opening: Promise<IDBDatabase> | undefined;
function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('choreoflow-media-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('audio', { keyPath: 'asset.id' });
    request.onerror = () => { opening = undefined; reject(request.error ?? new Error('Musikspeicher kann nicht geöffnet werden.')); };
    request.onsuccess = () => { request.result.onversionchange = () => { opening = undefined; request.result.close(); }; resolve(request.result); };
  });
  return opening;
}
async function read(id: string): Promise<StoredAudio | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('audio', 'readonly').objectStore('audio').get(id);
    request.onsuccess = () => resolve(request.result as StoredAudio | undefined); request.onerror = () => reject(request.error);
  });
}
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
  const waveform = await waveformOf(file, durationSeconds);
  const id = createId('audio');
  const asset: AudioAsset = { id, name: file.name, mimeType: file.type || `audio/${extension}`, durationSeconds, sizeBytes: file.size, localUri: `${LOCAL_AUDIO_PREFIX}${id}.${extension}` };
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('audio', 'readwrite'); transaction.objectStore('audio').add({ asset, blob: file, waveform } satisfies StoredAudio);
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error ?? new Error('Für diese Musik ist nicht genug Browserspeicher frei.')); transaction.onabort = () => reject(transaction.error ?? new Error('Musikimport wurde nicht gespeichert.'));
  });
  return { asset, waveform };
}
export async function pickAudio(): Promise<ImportedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'application/ogg'], multiple: false, base64: false });
  if (result.canceled) return null;
  const file = result.assets[0]?.file;
  if (!file) throw new Error('Der Browser hat keine lesbare Datei geliefert.');
  return importAudioFile(file);
}
export async function resolveAudio(asset: AudioAsset): Promise<ResolvedAudio> {
  if (!asset.localUri?.startsWith(LOCAL_AUDIO_PREFIX)) throw new Error('Diese Musik fehlt auf diesem Gerät. Importiere die Originaldatei erneut; die Choreografie kann lautlos abgespielt werden.');
  const stored = await read(asset.id);
  if (!stored?.blob) throw new Error('Die lokale Musikdatei fehlt. Bitte erneut importieren. Lautlose Wiedergabe bleibt möglich.');
  const uri = URL.createObjectURL(stored.blob); return { uri, release: () => URL.revokeObjectURL(uri) };
}
export async function getAudioWaveform(asset: AudioAsset): Promise<number[] | null> { return (await read(asset.id))?.waveform ?? null; }
