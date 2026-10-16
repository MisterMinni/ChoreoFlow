import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { createAudioPlayer, type AudioStatus } from 'expo-audio';
import { createId, type AudioAsset } from '@choreoflow/core';
import { LOCAL_AUDIO_PREFIX, validateAudioFile, validateDuration, type ImportedAudio, type ResolvedAudio } from './types';
import { audioBytesEqual, cachedAudioAsset, localAudioFilename, validateAudioBytes, validateDecodedDuration } from './transfer';

async function durationOf(uri: string): Promise<number> {
  const player = createAudioPlayer({ uri }, { updateInterval: 100 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let subscription: { remove(): void } | undefined;
  try {
    return await new Promise<number>((resolve, reject) => {
      const inspect = (status: AudioStatus & { error?: string }) => {
        if (status.error) reject(new Error('Das Gerät kann dieses Audioformat nicht lesen.'));
        else if (status.isLoaded && status.duration > 0) resolve(status.duration);
      };
      subscription = player.addListener('playbackStatusUpdate', inspect);
      if (player.isLoaded && player.duration > 0) resolve(player.duration);
      timer = setTimeout(() => reject(new Error('Die Audio-Metadaten konnten nicht rechtzeitig gelesen werden.')), 15000);
    });
  } finally { if (timer) clearTimeout(timer); subscription?.remove(); player.remove(); }
}
export async function pickAudio(): Promise<ImportedAudio | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'application/ogg'], multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const selected = result.assets[0]; if (!selected) throw new Error('Es wurde keine Musikdatei ausgewählt.');
  const source = new File(selected.uri);
  const extension = validateAudioFile(selected.name, source.size || selected.size || 0, selected.mimeType || source.type);
  const durationSeconds = await durationOf(source.uri); validateDuration(durationSeconds);
  const asset: AudioAsset = { id: createId('audio'), name: selected.name, mimeType: selected.mimeType || source.type || `audio/${extension}`, durationSeconds, sizeBytes: source.size };
  return { asset: await cacheAudioBytes(asset, await source.arrayBuffer()), waveform: null };
}
export async function resolveAudio(asset: AudioAsset): Promise<ResolvedAudio> {
  const filename = localAudioFilename(asset);
  const file = new File(Paths.document, 'choreoflow-audio', filename);
  if (!file.exists) throw new Error('Die lokale Musikdatei fehlt. Bitte erneut importieren.');
  return { uri: file.uri, release: () => undefined };
}
export async function getAudioWaveform(_asset: AudioAsset): Promise<number[] | null> { return null; }
export async function readAudioBytes(asset: AudioAsset): Promise<ArrayBuffer> {
  const file = new File(Paths.document, 'choreoflow-audio', localAudioFilename(asset));
  if (!file.exists) throw new Error('Die lokale Musikdatei fehlt. Bitte erneut importieren.');
  validateAudioFile(asset.name, file.size, asset.mimeType);
  if (file.size !== asset.sizeBytes) throw new Error('Die gespeicherte Musikdatei hat eine abweichende Größe.');
  const bytes = await file.arrayBuffer(); validateAudioBytes(asset, bytes); return bytes;
}
const pending = new Map<string, Promise<void>>();
export async function cacheAudioBytes(asset: AudioAsset, input: ArrayBuffer): Promise<AudioAsset> {
  asset = { ...asset };
  const format = validateAudioBytes(asset, input), bytes = input.slice(0);
  const work = (pending.get(asset.id) ?? Promise.resolve()).then(async () => {
    const directory = new Directory(Paths.document, 'choreoflow-audio'); directory.create({ intermediates: true, idempotent: true });
    let existing: File | undefined;
    // Include legacy filename aliases; changing the extension cannot evade ID collision checks.
    for (const extension of ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff']) {
      const file = new File(directory, `${asset.id}.${extension}`);
      if (!file.exists) continue;
      if (file.size !== bytes.byteLength || !audioBytesEqual(await file.arrayBuffer(), bytes)) throw new Error('Für diese Musikkennung ist bereits eine andere Originaldatei gespeichert. Sie wurde nicht überschrieben.');
      existing ??= file;
    }
    const cached = cachedAudioAsset(asset, format);
    if (existing) {
      validateDecodedDuration(asset, await durationOf(existing.uri));
      return { ...cached, localUri: `${LOCAL_AUDIO_PREFIX}${existing.name}` };
    }
    const target = new File(directory, `${asset.id}.${format.extension}`);
    const temporary = new File(directory, `${createId('transfer')}.${format.extension}`);
    const temporaryUri = temporary.uri;
    let ownsTemporary = false;
    try {
      temporary.create({ overwrite: false });
      ownsTemporary = true;
      await temporary.write(bytes);
      if (temporary.size !== bytes.byteLength || !audioBytesEqual(await temporary.arrayBuffer(), bytes)) throw new Error('Die Musikdatei wurde nicht vollständig gespeichert.');
      validateDecodedDuration(asset, await durationOf(temporary.uri));
      // Expo 58 supports explicit no-overwrite relocation. The final file is
      // exposed only after all bytes and decoder metadata have been checked.
      try { await temporary.move(target, { overwrite: false }); }
      catch (error) {
        if (!target.exists || target.size !== bytes.byteLength || !audioBytesEqual(await target.arrayBuffer(), bytes)) throw error;
      }
      return cached;
    } finally {
      // move() changes temporary.uri; retain the original path so cleanup can
      // never remove the final, successfully restored original.
      const leftover = new File(temporaryUri); if (ownsTemporary && leftover.exists) leftover.delete();
    }
  });
  const settled = work.then(() => undefined, () => undefined); pending.set(asset.id, settled);
  try { return await work; } finally { if (pending.get(asset.id) === settled) pending.delete(asset.id); }
}
