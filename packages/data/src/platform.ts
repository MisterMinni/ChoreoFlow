import { IndexedDbStore } from './store.web';
export function createPlatformStore() {
  if (typeof indexedDB === 'undefined') throw new Error('Persistenter Speicher ist nicht verfügbar. Die App speichert nicht stillschweigend nur im Arbeitsspeicher.');
  return new IndexedDbStore();
}
