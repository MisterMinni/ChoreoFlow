import type { AtomicStore } from './types';

const STORE_NAME = 'workspace';
export class IndexedDbStore implements AtomicStore {
  private opening: Promise<IDBDatabase> | undefined;
  constructor(private readonly databaseName = 'choreoflow-local-v1', private readonly factory: IDBFactory = indexedDB) {}
  private open(): Promise<IDBDatabase> {
    this.opening ??= new Promise((resolve, reject) => {
      const request = this.factory.open(this.databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onerror = () => reject(request.error ?? new Error('Lokaler Speicher konnte nicht geöffnet werden.'));
      request.onblocked = () => reject(new Error('Eine andere Ansicht blockiert die Speichermigration. Bitte alte Ansichten schließen.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
    return this.opening;
  }
  async transact<T>(key: string, update: (stored: unknown | undefined) => { value: unknown; result: T }): Promise<T> {
    const database = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      let result: T;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          const next = update(request.result === undefined ? undefined : JSON.parse(request.result as string));
          result = next.result;
          const serialized = JSON.stringify(next.value);
          if (serialized !== request.result) store.put(serialized, key);
        } catch (error) { failure = error; transaction.abort(); }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(failure ?? transaction.error ?? new Error('Speichern fehlgeschlagen.'));
      transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Speichern wurde abgebrochen.'));
    });
  }
  async close(): Promise<void> { if (this.opening) (await this.opening).close(); this.opening = undefined; }
}
