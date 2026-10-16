import * as SecureStore from 'expo-secure-store';
import { createSyncId } from './repository';

interface Manifest { id: string; chunks: number }
const prefix = (key: string) => `choreoflow.${key.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
async function manifest(key: string): Promise<Manifest | null> {
  const value = await SecureStore.getItemAsync(prefix(key), options);
  if (!value) return null;
  const parsed = JSON.parse(value) as Manifest;
  if (!parsed.id || !Number.isInteger(parsed.chunks) || parsed.chunks < 1 || parsed.chunks > 100) throw new Error('Gesicherte Sitzung ist beschädigt.');
  return parsed;
}
async function clearChunks(key: string, previous: Manifest | null): Promise<void> {
  if (previous) for (let index = 0; index < previous.chunks; index++) await SecureStore.deleteItemAsync(`${prefix(key)}.${previous.id}.${index}`, options);
}
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const current = await manifest(key); if (!current) return null;
    const chunks = await Promise.all(Array.from({ length: current.chunks }, (_, index) => SecureStore.getItemAsync(`${prefix(key)}.${current.id}.${index}`, options)));
    if (chunks.some(chunk => chunk === null)) throw new Error('Gesicherte Sitzung ist unvollständig. Bitte erneut anmelden.');
    return chunks.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    // Supabase tokens can exceed individual Keychain size limits. Commit manifest last.
    const previous = await manifest(key);
    const characters = Array.from(value);
    const chunks = Array.from({ length: Math.max(1, Math.ceil(characters.length / 400)) }, (_, index) => characters.slice(index * 400, (index + 1) * 400).join(''));
    const current = { id: createSyncId(), chunks: chunks.length };
    if (current.chunks > 100) throw new Error('Sitzung überschreitet das lokale Größenlimit.');
    for (let index = 0; index < current.chunks; index++) await SecureStore.setItemAsync(`${prefix(key)}.${current.id}.${index}`, chunks[index]!, options);
    await SecureStore.setItemAsync(prefix(key), JSON.stringify(current), options);
    await clearChunks(key, previous);
  },
  async removeItem(key: string): Promise<void> {
    const previous = await manifest(key);
    await SecureStore.deleteItemAsync(prefix(key), options);
    await clearChunks(key, previous);
  },
};
