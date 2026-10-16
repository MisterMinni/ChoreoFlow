import { IndexedDbStore } from './store.web';

let store: IndexedDbStore | undefined;
const getStore = () => { store ??= new IndexedDbStore('choreoflow-auth-v1'); return store; };
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof indexedDB === 'undefined') return null;
    return getStore().transact(`session:${key}`, value => ({ value: value ?? null, result: typeof value === 'string' ? value : null }));
  },
  async setItem(key: string, value: string): Promise<void> {
    await getStore().transact(`session:${key}`, () => ({ value, result: null }));
  },
  async removeItem(key: string): Promise<void> {
    await getStore().transact(`session:${key}`, () => ({ value: null, result: null }));
  },
};
