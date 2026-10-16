import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { createAudioPlayer, type AudioStatus } from 'expo-audio';
import { createId, type AudioAsset } from '@choreoflow/core';
import { LOCAL_AUDIO_PREFIX, validateAudioFile, validateDuration, type ImportedAudio, type ResolvedAudio } from './types';

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
  const directory = new Directory(Paths.document, 'choreoflow-audio'); directory.create({ intermediates: true, idempotent: true });
  const id = createId('audio'); const filename = `${id}.${extension}`; const target = new File(directory, filename);
  await source.copy(target);
  if (!target.exists || target.size !== source.size) throw new Error('Die Musikdatei wurde nicht vollständig in den App-Speicher kopiert.');
  return { asset: { id, name: selected.name, mimeType: selected.mimeType || source.type || `audio/${extension}`, durationSeconds, sizeBytes: target.size, localUri: `${LOCAL_AUDIO_PREFIX}${filename}` }, waveform: null };
}
export async function resolveAudio(asset: AudioAsset): Promise<ResolvedAudio> {
  const filename = asset.localUri?.startsWith(LOCAL_AUDIO_PREFIX) ? asset.localUri.slice(LOCAL_AUDIO_PREFIX.length) : '';
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) throw new Error('Diese Musik fehlt auf diesem Gerät. Bitte Originaldatei erneut importieren; lautlose Wiedergabe bleibt möglich.');
  const file = new File(Paths.document, 'choreoflow-audio', filename);
  if (!file.exists) throw new Error('Die lokale Musikdatei fehlt. Bitte erneut importieren.');
  return { uri: file.uri, release: () => undefined };
}
export async function getAudioWaveform(_asset: AudioAsset): Promise<number[] | null> { return null; }
