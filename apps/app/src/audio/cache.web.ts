import type { AudioAsset } from '@choreoflow/core';
import { audioBytesEqual, cachedAudioAsset, localAudioFilename, validateAudioBytes, validateDecodedDuration } from './transfer';

export interface StoredAudio { asset: AudioAsset; blob: Blob; waveform: number[] | null }
/** The actual IndexedDB adapter; decoder injection keeps storage tests independent of browser media support. */
export class BrowserAudioCache {
  private opening: Promise<IDBDatabase> | undefined;
  constructor(private readonly durationOf: (blob: Blob) => Promise<number>, private readonly waveformOf: (blob: Blob, duration: number) => Promise<number[] | null> = async () => null, private readonly factory: () => IDBFactory = () => indexedDB, private readonly databaseName = 'choreoflow-media-v1') {}
  private open(): Promise<IDBDatabase> {
    this.opening ??= new Promise((resolve, reject) => {
      const request = this.factory().open(this.databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('audio', { keyPath: 'asset.id' });
      request.onerror = () => { this.opening = undefined; reject(request.error ?? new Error('Musikspeicher kann nicht geöffnet werden.')); };
      request.onblocked = () => { this.opening = undefined; reject(new Error('Eine andere Ansicht blockiert den Musikspeicher.')); };
      request.onsuccess = () => { request.result.onversionchange = () => { this.opening = undefined; request.result.close(); }; resolve(request.result); };
    });
    return this.opening;
  }
  async read(id: string): Promise<StoredAudio | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('audio', 'readonly');
      const request = transaction.objectStore('audio').get(id);
      transaction.oncomplete = () => resolve(request.result as StoredAudio | undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Musikspeicher konnte nicht gelesen werden.'));
    });
  }
  async readAudioBytes(asset: AudioAsset): Promise<ArrayBuffer> {
    localAudioFilename(asset);
    const stored = await this.read(asset.id);
    if (!stored?.blob) throw new Error('Die lokale Musikdatei fehlt. Bitte erneut importieren.');
    const bytes = await stored.blob.arrayBuffer();
    validateAudioBytes(asset, bytes);
    return bytes;
  }
  async cacheAudioBytes(asset: AudioAsset, input: ArrayBuffer): Promise<AudioAsset> {
    asset = { ...asset };
    const format = validateAudioBytes(asset, input);
    // Copy before awaiting the decoder: callers cannot mutate an in-flight transfer.
    const bytes = input.slice(0), cached = cachedAudioAsset(asset, format);
    const blob = new Blob([bytes], { type: format.mimeType });
    const duration = await this.durationOf(blob); validateDecodedDuration(asset, duration);
    const waveform = await this.waveformOf(blob, duration).catch(() => null);
    const db = await this.open();
    const existing = await new Promise<StoredAudio | undefined>((resolve, reject) => {
      const transaction = db.transaction('audio', 'readwrite'), store = transaction.objectStore('audio');
      const request = store.get(asset.id);
      request.onsuccess = () => {
        // A single transaction arbitrates concurrent imports from other tabs.
        // Never put(): a competing asset with this ID must remain untouched.
        if (!request.result) store.add({ asset: cached, blob, waveform } satisfies StoredAudio);
      };
      transaction.oncomplete = () => resolve(request.result as StoredAudio | undefined);
      transaction.onerror = () => reject(transaction.error ?? new Error('Für diese Musik ist nicht genug Browserspeicher frei.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Musik wurde nicht gespeichert.'));
    });
    if (existing && !audioBytesEqual(await existing.blob.arrayBuffer(), bytes)) throw new Error('Für diese Musikkennung ist bereits eine andere Originaldatei gespeichert. Sie wurde nicht überschrieben.');
    return cached;
  }
  async close(): Promise<void> { if (this.opening) (await this.opening).close(); this.opening = undefined; }
}
