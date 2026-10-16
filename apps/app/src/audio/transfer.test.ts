import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import type { AudioAsset } from '@choreoflow/core';
import { BrowserAudioCache } from './cache.web';
import { audioBytesEqual, audioObjectPath, cachedAudioAsset, localAudioFilename, sniffAudioFormat, validateAudioBytes, validateDecodedDuration } from './transfer';
import { MAX_AUDIO_BYTES } from './types';

function text(bytes: Uint8Array, offset: number, value: string): void { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); }
function wav(seconds = 2): ArrayBuffer {
  const samples = Math.round(seconds * 8000), bytes = new Uint8Array(44 + samples * 2), view = new DataView(bytes.buffer);
  text(bytes, 0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(bytes, 8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(bytes, 36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(1000 * Math.sin(i / 13)), true);
  return bytes.buffer;
}
const assetFor = (bytes: ArrayBuffer, extra: Partial<AudioAsset> = {}): AudioAsset => ({ id: 'audio_original-123', name: 'Probe.wav', mimeType: 'audio/x-wav', durationSeconds: 2, sizeBytes: bytes.byteLength, ...extra });
const durationOfWav = async (blob: Blob): Promise<number> => { const view = new DataView(await blob.arrayBuffer()); return view.getUint32(40, true) / view.getUint32(28, true); };
function box(type: string, payload: Uint8Array): Uint8Array { const value = new Uint8Array(payload.length + 8); new DataView(value.buffer).setUint32(0, value.length); text(value, 4, type); value.set(payload, 8); return value; }
function mp4(handler = 'soun'): ArrayBuffer {
  const handle = new Uint8Array(12); text(handle, 8, handler);
  const boxes = [box('ftyp', new Uint8Array([77, 52, 65, 32, 0, 0, 0, 0])), box('moov', box('trak', box('mdia', box('hdlr', handle)))), box('mdat', new Uint8Array([1, 2, 3]))];
  const bytes = new Uint8Array(boxes.reduce((total, part) => total + part.length, 0)); let offset = 0;
  for (const part of boxes) { bytes.set(part, offset); offset += part.length; } return bytes.buffer;
}
test('audio headers distinguish supported formats and canonical MIME, with audio-only MP4 handlers', () => {
  const mp3 = new Uint8Array(417); mp3.set([255, 251, 144, 0]);
  const id3 = new Uint8Array(427); id3.set([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]); id3.set(mp3, 10);
  const aac = new Uint8Array(12); aac.set([255, 241, 80, 128, 1, 159, 252]);
  const flac = new Uint8Array(44); text(flac, 0, 'fLaC'); flac.set([128, 0, 0, 34], 4);
  const ogg = new Uint8Array(47); text(ogg, 0, 'OggS'); ogg[5] = 2; ogg[26] = 1; ogg[27] = 19; text(ogg, 28, 'OpusHead');
  const aiff = new Uint8Array(56), av = new DataView(aiff.buffer); text(aiff, 0, 'FORM'); av.setUint32(4, 48); text(aiff, 8, 'AIFFCOMM'); av.setUint32(16, 18); text(aiff, 38, 'SSND'); av.setUint32(42, 10);
  for (const [bytes, extension, mimeType] of [[wav(), 'wav', 'audio/wav'], [mp3.buffer, 'mp3', 'audio/mpeg'], [id3.buffer, 'mp3', 'audio/mpeg'], [aac.buffer, 'aac', 'audio/aac'], [flac.buffer, 'flac', 'audio/flac'], [ogg.buffer, 'ogg', 'audio/ogg'], [aiff.buffer, 'aiff', 'audio/aiff'], [mp4(), 'm4a', 'audio/mp4']] as const) assert.deepEqual(sniffAudioFormat(bytes), { extension, mimeType });
  assert.throws(() => sniffAudioFormat(mp4('vide')));
  assert.throws(() => sniffAudioFormat(mp4('text')));
  assert.throws(() => sniffAudioFormat(id3.buffer.slice(0, 10)));
  const impossibleTag = id3.slice(); impossibleTag[6] = 128; assert.throws(() => sniffAudioFormat(impossibleTag.buffer));
  const invalidOgg = ogg.slice(); text(invalidOgg, 28, 'theora!!'); assert.throws(() => sniffAudioFormat(invalidOgg.buffer));
  const truncated = wav().slice(0, 50); assert.throws(() => sniffAudioFormat(truncated));
});
test('byte validation rejects mismatched sizes, MIME, filenames, durations and non-audio payloads', () => {
  const bytes = wav(), asset = assetFor(bytes);
  assert.deepEqual(validateAudioBytes(asset, bytes), { extension: 'wav', mimeType: 'audio/wav' });
  assert.equal(validateAudioBytes({ ...asset, mimeType: 'application/octet-stream' }, bytes).mimeType, 'audio/wav');
  for (const change of [{ sizeBytes: bytes.byteLength + 1 }, { sizeBytes: 1.5 }, { mimeType: 'audio/mpeg' }, { name: 'fake.mp3' }, { name: 'fake.exe' }, { durationSeconds: 601 }, { durationSeconds: NaN }, { id: '../escape' }]) assert.throws(() => validateAudioBytes({ ...asset, ...change }, bytes));
  const fake = new TextEncoder().encode('<html>This is not audio but has a WAV filename.</html>').buffer;
  assert.throws(() => validateAudioBytes(assetFor(fake), fake));
  assert.throws(() => validateAudioBytes({ ...asset, sizeBytes: MAX_AUDIO_BYTES + 1 }, bytes));
  validateDecodedDuration(asset, 2.1);
  for (const value of [0, Infinity, NaN, 600.1, 3]) assert.throws(() => validateDecodedDuration(asset, value));
});
test('cloud paths are deterministic and reject traversal without changing the original asset ID', () => {
  const owner = 'B07A41A9-ADCB-42D8-BD93-82258E38760E', project = '800e33c6-49a8-4e8f-bcf6-826e8c68418c';
  assert.equal(audioObjectPath(owner, project, 'audio_A-b_1'), `${owner.toLowerCase()}/${project}/audio_A-b_1`);
  for (const id of ['', '../music', 'a/b', 'a\\b', '%2e%2e', 'a?x', 'a#x', 'a.wav', 'a\0b', 'a'.repeat(121)]) assert.throws(() => audioObjectPath(owner, project, id));
  assert.throws(() => audioObjectPath(`${owner}/..`, project, 'audio'));
  assert.throws(() => audioObjectPath(owner, 'wrong-project', 'audio'));
  const asset = assetFor(wav());
  const cached = cachedAudioAsset(asset, { extension: 'wav', mimeType: 'audio/wav' });
  assert.equal(cached.id, asset.id); assert.equal(localAudioFilename(cached), `${asset.id}.wav`);
  for (const localUri of ['file:///private/file.wav', 'choreoflow-audio://../file.wav', 'choreoflow-audio://different-id.wav', 'https://example.com/music.wav']) assert.throws(() => localAudioFilename({ ...asset, localUri }));
});
test('byte equality compares every byte and never alters either original', () => {
  const bytes = wav(), copy = bytes.slice(0); assert.equal(audioBytesEqual(bytes, copy), true);
  new Uint8Array(copy)[copy.byteLength - 1] ^= 1;
  assert.equal(audioBytesEqual(bytes, copy), false); assert.equal(audioBytesEqual(bytes, bytes.slice(1)), false);
});
test('IndexedDB restores original bytes, stable ID and canonical MIME across connection restart', async () => {
  const factory = new IDBFactory(), first = new BrowserAudioCache(durationOfWav, async () => [0.2, 0.9], () => factory);
  const bytes = wav(), asset = assetFor(bytes, { localUri: 'file:///another-device/music.wav' });
  const cached = await first.cacheAudioBytes(asset, bytes); await first.close();
  const reopened = new BrowserAudioCache(durationOfWav, undefined, () => factory);
  try {
    assert.deepEqual(cached, { ...asset, mimeType: 'audio/wav', localUri: `choreoflow-audio://${asset.id}.wav` });
    assert.deepEqual(await reopened.readAudioBytes(cached), bytes);
    assert.deepEqual((await reopened.read(asset.id))?.waveform, [0.2, 0.9]);
    assert.deepEqual(await reopened.cacheAudioBytes(asset, bytes.slice(0)), cached);
    assert.deepEqual((await reopened.read(asset.id))?.waveform, [0.2, 0.9]);
  } finally { await reopened.close(); }
});
test('IndexedDB concurrent different bytes with the same ID never overwrite the winner', async () => {
  const factory = new IDBFactory(), first = new BrowserAudioCache(durationOfWav, undefined, () => factory), second = new BrowserAudioCache(durationOfWav, undefined, () => factory);
  const one = wav(), two = one.slice(0); new Uint8Array(two)[100] ^= 1;
  try {
    const results = await Promise.allSettled([first.cacheAudioBytes(assetFor(one), one), second.cacheAudioBytes(assetFor(two), two)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const winner = results.findIndex(result => result.status === 'fulfilled'), expected = winner === 0 ? one : two;
    const stored = (await first.read(assetFor(one).id))!;
    assert.deepEqual(await stored.blob.arrayBuffer(), expected);
    await assert.rejects(first.cacheAudioBytes(assetFor(one), winner === 0 ? two : one), /nicht überschrieben/);
    assert.deepEqual(await first.readAudioBytes(stored.asset), expected);
  } finally { await first.close(); await second.close(); }
});
test('IndexedDB concurrent equal originals are idempotent', async () => {
  const factory = new IDBFactory(), first = new BrowserAudioCache(durationOfWav, undefined, () => factory), second = new BrowserAudioCache(durationOfWav, undefined, () => factory), bytes = wav();
  try {
    const [a, b] = await Promise.all([first.cacheAudioBytes(assetFor(bytes), bytes), second.cacheAudioBytes(assetFor(bytes), bytes.slice(0))]);
    assert.deepEqual(a, b); assert.deepEqual(await first.readAudioBytes(a), bytes);
  } finally { await first.close(); await second.close(); }
});
test('IndexedDB rejects unsupported or wrong decoder duration without persisting a partial asset', async () => {
  const bytes = wav(), asset = assetFor(bytes);
  for (const decoder of [async () => 601, async () => 10, async () => { throw new Error('Unsupported codec'); }]) {
    const cache = new BrowserAudioCache(decoder, undefined, () => new IDBFactory());
    try { await assert.rejects(cache.cacheAudioBytes(asset, bytes)); assert.equal(await cache.read(asset.id), undefined); }
    finally { await cache.close(); }
  }
});
test('IndexedDB snapshots in-flight input and detects missing or mismatched stored files', async () => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const cache = new BrowserAudioCache(async blob => { await wait; return durationOfWav(blob); }, undefined, () => new IDBFactory());
  const bytes = wav(), original = bytes.slice(0), asset = assetFor(bytes);
  try {
    const originalId = asset.id;
    const work = cache.cacheAudioBytes(asset, bytes); new Uint8Array(bytes)[100] ^= 1; asset.id = 'changed-during-transfer'; release();
    const cached = await work;
    assert.equal(cached.id, originalId);
    assert.deepEqual(await cache.readAudioBytes(cached), original);
    await assert.rejects(cache.readAudioBytes({ ...cached, sizeBytes: cached.sizeBytes + 1 }), /Größe/);
    await assert.rejects(cache.readAudioBytes({ ...cached, id: 'missing', localUri: 'choreoflow-audio://missing.wav' }), /fehlt/);
  } finally { await cache.close(); }
});
test('IndexedDB keeps valid originals when optional waveform generation is unavailable', async () => {
  const bytes = wav(), cache = new BrowserAudioCache(durationOfWav, async () => { throw new Error('No audio decoding context'); }, () => new IDBFactory());
  try {
    const asset = await cache.cacheAudioBytes(assetFor(bytes), bytes);
    assert.deepEqual(await cache.readAudioBytes(asset), bytes);
    assert.equal((await cache.read(asset.id))!.waveform, null);
  } finally { await cache.close(); }
});
