import { describe, expect, it } from 'vitest';

import { BOOK, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import {
  BACKUP_KEY,
  STORAGE_KEY,
  type StorageLike,
  backUpStoredBudget,
  needsBackup,
  parseStoredBudget,
  removeBackup,
  serializeBook,
} from './storage';

const V1 = JSON.stringify({ version: 1, state: SCENARIO });

function recording(initial: Record<string, string>, throwOn: Partial<Record<'get' | 'set' | 'remove', boolean>> = {}) {
  const inner = createMemoryStorage(initial);
  const sets: Array<[string, string]> = [];
  const storage: StorageLike & { dump(): Record<string, string>; sets: Array<[string, string]> } = {
    sets,
    getItem(key) {
      if (throwOn.get === true) throw new Error('get denied');
      return inner.getItem(key);
    },
    setItem(key, value) {
      if (throwOn.set === true) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      sets.push([key, value]);
      inner.setItem(key, value);
    },
    removeItem(key) {
      if (throwOn.remove === true) throw new Error('remove denied');
      inner.removeItem(key);
    },
    dump: () => inner.dump(),
  };
  return storage;
}

describe('BACKUP_KEY', () => {
  it('BACKUP_KEY === budget-kit:budget:backup', () => {
    expect(BACKUP_KEY).toBe('budget-kit:budget:backup');
  });
});

describe('needsBackup', () => {
  it('is true for corrupt text, an unsupported version and version 1 data', () => {
    expect(needsBackup(parseStoredBudget('not json'))).toBe(true);
    expect(needsBackup(parseStoredBudget('{"version":3}'))).toBe(true);
    expect(needsBackup(parseStoredBudget(V1))).toBe(true);
  });

  it('is false for empty storage, version 2 data and unavailable storage', () => {
    expect(needsBackup(parseStoredBudget(null))).toBe(false);
    expect(needsBackup(parseStoredBudget(serializeBook(BOOK)))).toBe(false);
    expect(needsBackup({ status: 'unavailable' })).toBe(false);
  });
});

describe('backUpStoredBudget', () => {
  it('writes the copy, then reports present without a second write', () => {
    const s = recording({ [STORAGE_KEY]: 'x' });
    expect(backUpStoredBudget(s)).toBe('written');
    expect(s.dump()[BACKUP_KEY]).toBe('x');
    expect(backUpStoredBudget(s)).toBe('present');
    expect(s.sets.filter(([k]) => k === BACKUP_KEY)).toHaveLength(1);
  });

  it('never overwrites an existing backup and makes no write', () => {
    const s = recording({ [STORAGE_KEY]: 'x', [BACKUP_KEY]: 'old' });
    expect(backUpStoredBudget(s)).toBe('present');
    expect(s.dump()[BACKUP_KEY]).toBe('old');
    expect(s.sets).toHaveLength(0);
  });

  it('an empty-string backup counts as present', () => {
    const s = recording({ [STORAGE_KEY]: 'x', [BACKUP_KEY]: '' });
    expect(backUpStoredBudget(s)).toBe('present');
    expect(s.dump()[BACKUP_KEY]).toBe('');
  });

  it('reports nothing-stored for empty storage and writes nothing', () => {
    const s = recording({});
    expect(backUpStoredBudget(s)).toBe('nothing-stored');
    expect(s.sets).toHaveLength(0);
  });

  it('reports failed for null storage', () => {
    expect(backUpStoredBudget(null)).toBe('failed');
  });

  it('reports failed, without throwing, when setItem throws', () => {
    const s = recording({ [STORAGE_KEY]: 'x' }, { set: true });
    expect(() => backUpStoredBudget(s)).not.toThrow();
    expect(backUpStoredBudget(s)).toBe('failed');
    expect(s.dump()[BACKUP_KEY]).toBeUndefined();
  });

  it('reports failed, without throwing or writing, when getItem throws', () => {
    const s = recording({ [STORAGE_KEY]: 'x' }, { get: true });
    expect(() => backUpStoredBudget(s)).not.toThrow();
    expect(backUpStoredBudget(s)).toBe('failed');
    expect(s.sets).toHaveLength(0);
  });
});

describe('backUpStoredBudget is byte-identical', () => {
  const tricky =
    '  {"state":' +
    JSON.stringify({ ...SCENARIO, categories: [{ id: 'c', name: 'Café ☕ "x"', plannedCents: 1 }] }) +
    ',"version":1}\n';
  for (const [name, raw] of [
    ['V1', V1],
    ['reordered, padded, non-ASCII text with a trailing newline', tricky],
    ['not json', 'not json'],
    ['the empty string', ''],
  ] as const) {
    it(`copies ${name} exactly`, () => {
      const s = recording({ [STORAGE_KEY]: raw });
      expect(backUpStoredBudget(s)).toBe('written');
      expect(s.dump()[BACKUP_KEY] === raw).toBe(true);
    });
  }
});

describe('removeBackup', () => {
  it('removes the key and returns true, leaving the main key', () => {
    const s = recording({ [STORAGE_KEY]: 'x', [BACKUP_KEY]: 'b' });
    expect(removeBackup(s)).toBe(true);
    expect(s.dump()).toEqual({ [STORAGE_KEY]: 'x' });
  });

  it('returns true when there is nothing to remove', () => {
    expect(removeBackup(recording({}))).toBe(true);
  });

  it('returns false for null storage', () => {
    expect(removeBackup(null)).toBe(false);
  });

  it('returns false and does not throw when removeItem throws', () => {
    const s = recording({ [BACKUP_KEY]: 'b' }, { remove: true });
    expect(() => removeBackup(s)).not.toThrow();
    expect(removeBackup(s)).toBe(false);
  });
});
