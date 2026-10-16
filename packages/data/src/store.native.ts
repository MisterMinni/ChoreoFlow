import * as SQLite from 'expo-sqlite';
import type { AtomicStore } from './types';

/** Native adapter only. Browser builds resolve store.web.ts and never load SQLite/WASM. */
export class SqliteStore implements AtomicStore {
  private opening: Promise<SQLite.SQLiteDatabase> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly databaseName = 'choreoflow-local-v1.db') {}
  private open(): Promise<SQLite.SQLiteDatabase> {
    this.opening ??= (async () => {
      const database = await SQLite.openDatabaseAsync(this.databaseName);
      await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
      await database.withExclusiveTransactionAsync(async transaction => {
        const version = await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if ((version?.user_version ?? 0) > 1) throw new Error('Dieser lokale Speicher benötigt eine neuere App-Version.');
        if ((version?.user_version ?? 0) === 0) {
          await transaction.execAsync('CREATE TABLE workspace (namespace TEXT PRIMARY KEY NOT NULL, state_json TEXT NOT NULL); PRAGMA user_version = 1;');
        }
      });
      return database;
    })();
    return this.opening;
  }
  transact<T>(key: string, update: (stored: unknown | undefined) => { value: unknown; result: T }): Promise<T> {
    const task = this.queue.then(async () => {
      const database = await this.open();
      let result: T;
      await database.withExclusiveTransactionAsync(async transaction => {
        const row = await transaction.getFirstAsync<{ state_json: string }>('SELECT state_json FROM workspace WHERE namespace = ?', key);
        const next = update(row ? JSON.parse(row.state_json) : undefined);
        const serialized = JSON.stringify(next.value);
        if (serialized !== row?.state_json) await transaction.runAsync('INSERT INTO workspace(namespace, state_json) VALUES (?, ?) ON CONFLICT(namespace) DO UPDATE SET state_json = excluded.state_json', key, serialized);
        result = next.result;
      });
      return result!;
    });
    this.queue = task.catch(() => undefined);
    return task;
  }
  async close(): Promise<void> { await this.queue; if (this.opening) await (await this.opening).closeAsync(); this.opening = undefined; }
}
