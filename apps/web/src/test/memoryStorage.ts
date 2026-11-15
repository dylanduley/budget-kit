import type { StorageLike } from '@/state/storage';

export interface MemoryStorageOptions {
  throwOnGet?: boolean;
  throwOnSet?: boolean;
}

export type MemoryStorage = StorageLike & {
  dump(): Record<string, string>;
  setItemCalls: number;
  getItemCalls: number;
};

export function createMemoryStorage(
  initial: Record<string, string> = {},
  options: MemoryStorageOptions = {},
): MemoryStorage {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    setItemCalls: 0,
    getItemCalls: 0,
    getItem(key) {
      this.getItemCalls += 1;
      if (options.throwOnGet === true) throw new DOMException('Access denied', 'SecurityError');
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      this.setItemCalls += 1;
      if (options.throwOnSet === true) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    dump() {
      return Object.fromEntries(data);
    },
  };
}
