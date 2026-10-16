import type { AtomicStore } from './types';

/** Explicit test adapter; never used as a silent fallback in the app. */
export class MemoryStore implements AtomicStore {
  private values = new Map<string, string>();
  async transact<T>(key: string, update: (stored: unknown | undefined) => { value: unknown; result: T }): Promise<T> {
    const previous = this.values.get(key);
    const next = update(previous === undefined ? undefined : JSON.parse(previous));
    this.values.set(key, JSON.stringify(next.value));
    return next.result;
  }
  async close(): Promise<void> { /* Keep explicit test-store contents available for reopening. */ }
}
