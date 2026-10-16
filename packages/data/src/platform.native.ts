import { SqliteStore } from './store.native';
export const createPlatformStore = () => new SqliteStore();
