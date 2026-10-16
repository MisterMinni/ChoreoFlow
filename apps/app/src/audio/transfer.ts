import type { AudioAsset } from '@choreoflow/core';
import { LOCAL_AUDIO_PREFIX, MAX_AUDIO_BYTES, validateAudioFile, validateDuration } from './types';

export interface AudioFormat { extension: 'wav' | 'mp3' | 'm4a' | 'aac' | 'ogg' | 'flac' | 'aiff'; mimeType: string }
const formats: Record<AudioFormat['extension'], AudioFormat> = {
  wav: { extension: 'wav', mimeType: 'audio/wav' }, mp3: { extension: 'mp3', mimeType: 'audio/mpeg' },
  m4a: { extension: 'm4a', mimeType: 'audio/mp4' }, aac: { extension: 'aac', mimeType: 'audio/aac' },
  ogg: { extension: 'ogg', mimeType: 'audio/ogg' }, flac: { extension: 'flac', mimeType: 'audio/flac' },
  aiff: { extension: 'aiff', mimeType: 'audio/aiff' },
};
const aliases: Record<string, string> = {
  'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
  'audio/mp3': 'audio/mpeg', 'audio/mpeg3': 'audio/mpeg', 'audio/x-mp3': 'audio/mpeg',
  'audio/m4a': 'audio/mp4', 'audio/x-m4a': 'audio/mp4', 'video/mp4': 'audio/mp4',
  'audio/x-aac': 'audio/aac', 'audio/aacp': 'audio/aac', 'application/ogg': 'audio/ogg',
  'audio/x-flac': 'audio/flac', 'audio/x-aiff': 'audio/aiff', 'audio/aif': 'audio/aiff',
};
export function canonicalAudioMimeType(mimeType: string): string {
  const mime = mimeType.toLowerCase().split(';')[0]!.trim();
  return aliases[mime] ?? mime;
}
export function assertAudioAssetId(id: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$/.test(id)) throw new Error('Ungültige Musikkennung.');
}
export function audioObjectPath(ownerId: string, cloudProjectId: string, assetId: string): string {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(ownerId) || !uuid.test(cloudProjectId)) throw new Error('Ungültige Konto- oder Cloudprojektkennung.');
  assertAudioAssetId(assetId);
  return `${ownerId.toLowerCase()}/${cloudProjectId.toLowerCase()}/${assetId}`;
}
export function audioBytesEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a), right = new Uint8Array(b);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
}
const textAt = (bytes: Uint8Array, start: number, value: string): boolean => start >= 0 && start + value.length <= bytes.length && Array.from(value).every((char, i) => bytes[start + i] === char.charCodeAt(0));
const invalidFormat = (): never => { throw new Error('Der Dateiinhalt ist keine unterstützte Audiodatei oder ist beschädigt.'); };

/** Container/header check only. A platform decoder must still verify playability and duration. */
export function sniffAudioFormat(buffer: ArrayBuffer): AudioFormat {
  const b = new Uint8Array(buffer), view = new DataView(buffer);
  if (b.length < 12 || b.length > MAX_AUDIO_BYTES) return invalidFormat();
  if (textAt(b, 0, 'RIFF') && textAt(b, 8, 'WAVE')) {
    const end = view.getUint32(4, true) + 8;
    if (end > b.length || end < 44) return invalidFormat();
    let fmt = false, data = false;
    for (let at = 12; at + 8 <= end;) {
      const size = view.getUint32(at + 4, true), next = at + 8 + size;
      if (next > end) return invalidFormat();
      if (textAt(b, at, 'fmt ') && size >= 16) fmt = true;
      if (textAt(b, at, 'data') && size > 0) data = true;
      at = next + (size % 2);
    }
    if (fmt && data) return formats.wav;
    return invalidFormat();
  }
  if (textAt(b, 0, 'FORM') && (textAt(b, 8, 'AIFF') || textAt(b, 8, 'AIFC'))) {
    const end = view.getUint32(4) + 8;
    if (end > b.length || end < 38) return invalidFormat();
    let common = false, sound = false;
    for (let at = 12; at + 8 <= end;) {
      const size = view.getUint32(at + 4), next = at + 8 + size;
      if (next > end) return invalidFormat();
      if (textAt(b, at, 'COMM') && size >= 18) common = true;
      if (textAt(b, at, 'SSND') && size > 8) sound = true;
      at = next + (size % 2);
    }
    if (common && sound) return formats.aiff;
    return invalidFormat();
  }
  if (textAt(b, 0, 'fLaC')) {
    // The first FLAC metadata block must be a 34-byte STREAMINFO block.
    if (b.length > 42 && (b[4]! & 127) === 0 && b[5] === 0 && b[6] === 0 && b[7] === 34) return formats.flac;
    return invalidFormat();
  }
  if (textAt(b, 0, 'OggS')) {
    if (b.length < 28 || b[4] !== 0 || !(b[5]! & 2)) return invalidFormat();
    const count = b[26]!, start = 27 + count;
    if (!count || start >= b.length) return invalidFormat();
    const size = b.slice(27, start).reduce((sum, value) => sum + value, 0);
    if (start + size > b.length) return invalidFormat();
    if ((size >= 19 && textAt(b, start, 'OpusHead')) || (size >= 30 && textAt(b, start, '\x01vorbis'))) return formats.ogg;
    return invalidFormat();
  }
  if (textAt(b, 4, 'ftyp')) {
    let audio = false, video = false, media = false;
    const boxes = (start: number, end: number, depth: number): void => {
      if (depth > 4) return invalidFormat();
      for (let at = start; at < end;) {
        if (at + 8 > end) return invalidFormat();
        let size = view.getUint32(at), header = 8;
        if (size === 1) {
          if (at + 16 > end || view.getUint32(at + 8) !== 0) return invalidFormat();
          size = view.getUint32(at + 12); header = 16;
        } else if (size === 0) size = end - at;
        if (size < header || at + size > end) return invalidFormat();
        if (textAt(b, at + 4, 'mdat') && size > header) media = true;
        if (textAt(b, at + 4, 'hdlr') && size >= header + 12) {
          audio ||= textAt(b, at + header + 8, 'soun'); video ||= textAt(b, at + header + 8, 'vide');
        }
        if (['moov', 'trak', 'mdia'].some(type => textAt(b, at + 4, type))) boxes(at + header, at + size, depth + 1);
        at += size;
      }
    };
    boxes(0, b.length, 0);
    if (audio && !video && media) return formats.m4a;
    return invalidFormat();
  }
  let start = 0;
  if (textAt(b, 0, 'ID3')) {
    if (![2, 3, 4].includes(b[3]!) || b.slice(6, 10).some(value => value >= 128)) return invalidFormat();
    start = 10 + ((b[6]! << 21) | (b[7]! << 14) | (b[8]! << 7) | b[9]!) + (b[3] === 4 && (b[5]! & 16) ? 10 : 0);
  }
  if (start + 7 > b.length || b[start] !== 255) return invalidFormat();
  // ADTS has layer=00, whereas MPEG audio reserves that value.
  if ((b[start + 1]! & 246) === 240 && ((b[start + 2]! >> 2) & 15) < 13) {
    const length = ((b[start + 3]! & 3) << 11) | (b[start + 4]! << 3) | (b[start + 5]! >> 5);
    if (length >= 7 && start + length <= b.length) return formats.aac;
  }
  const version = (b[start + 1]! >> 3) & 3, layer = (b[start + 1]! >> 1) & 3;
  const bitrate = b[start + 2]! >> 4, rate = (b[start + 2]! >> 2) & 3;
  if ((b[start + 1]! & 224) === 224 && version !== 1 && layer === 1 && bitrate > 0 && bitrate < 15 && rate !== 3) return formats.mp3;
  return invalidFormat();
}
export function validateAudioBytes(asset: AudioAsset, bytes: ArrayBuffer): AudioFormat {
  assertAudioAssetId(asset.id);
  const extension = validateAudioFile(asset.name, asset.sizeBytes, asset.mimeType);
  if (!Number.isSafeInteger(asset.sizeBytes) || bytes.byteLength !== asset.sizeBytes) throw new Error('Die Musikdatei ist unvollständig oder ihre Größe stimmt nicht mit dem Projekt überein.');
  validateDuration(asset.durationSeconds);
  const format = sniffAudioFormat(bytes);
  if ((extension === 'aif' ? 'aiff' : extension) !== format.extension) throw new Error('Dateiendung und Audioinhalt stimmen nicht überein.');
  const mime = canonicalAudioMimeType(asset.mimeType);
  if (mime && mime !== 'application/octet-stream' && mime !== format.mimeType) throw new Error('MIME-Typ und Audioinhalt stimmen nicht überein.');
  return { ...format };
}
export function validateDecodedDuration(asset: AudioAsset, duration: number): void {
  validateDuration(duration);
  if (Math.abs(duration - asset.durationSeconds) > Math.max(0.25, asset.durationSeconds * 0.001)) throw new Error('Die gelesene Musikdauer stimmt nicht mit dem Projekt überein.');
}
export function cachedAudioAsset(asset: AudioAsset, format: AudioFormat): AudioAsset {
  return { ...asset, mimeType: format.mimeType, localUri: `${LOCAL_AUDIO_PREFIX}${asset.id}.${format.extension}` };
}
export function localAudioFilename(asset: AudioAsset): string {
  assertAudioAssetId(asset.id);
  const filename = asset.localUri?.startsWith(LOCAL_AUDIO_PREFIX) ? asset.localUri.slice(LOCAL_AUDIO_PREFIX.length) : '';
  if (!['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff'].some(ext => filename === `${asset.id}.${ext}`)) throw new Error('Diese Musik fehlt auf diesem Gerät. Bitte die Originaldatei wiederherstellen.');
  return filename;
}
