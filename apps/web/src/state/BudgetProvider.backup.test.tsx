import { act, render, screen } from '@testing-library/react';
import { type ReactElement, StrictMode, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_CENTS } from '@/lib/budget';
import type { BudgetState } from '@/lib/budget';
import { BOOK, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { renderWithBudget } from '@/test/renderWithBudget';
import { type BudgetContextValue, BudgetProvider, TOTAL_TOO_LARGE_MESSAGE, useBudget } from './BudgetProvider';
import { BACKUP_KEY, STORAGE_KEY, type StorageLike, parseStoredBudget, serializeBook } from './storage';

type Ready = Extract<BudgetContextValue, { status: 'ready' }>;
const probe: { latest: BudgetContextValue | null } = { latest: null };

function Probe(): ReactElement {
  const budget = useBudget();
  useEffect(() => {
    probe.latest = budget;
  });
  return (
    <div>
      <p>{budget.status === 'ready' ? 'status: ready' : 'status: loading'}</p>
      {budget.status === 'ready' ? (
        <p data-testid="out">{`${budget.state.incomeCents}|${budget.loadStatus}|${String(budget.savedDataReplaced)}`}</p>
      ) : null}
    </div>
  );
}

function ready(): Ready {
  if (probe.latest === null || probe.latest.status !== 'ready') throw new Error('not ready');
  return probe.latest;
}

const V1 = JSON.stringify({ version: 1, state: SCENARIO });
const V3 = '{"version":3,"book":{}}';
const EMPTY_V2 = '{"version":2,"book":{"months":[]}}';

type Call = { op: 'set' | 'remove'; key: string };

interface LogStorage extends StorageLike {
  dump(): Record<string, string>;
  calls: Call[];
  sets(key?: string): Call[];
  failSet: (key: string, value: string, data: Record<string, string>) => boolean;
  failRemove: boolean;
}

function logStorage(initial: Record<string, string> = {}): LogStorage {
  const inner = createMemoryStorage(initial);
  const s: LogStorage = {
    calls: [],
    failSet: () => false,
    failRemove: false,
    sets: (key) => s.calls.filter((c) => c.op === 'set' && (key === undefined || c.key === key)),
    getItem: (key) => inner.getItem(key),
    setItem(key, value) {
      s.calls.push({ op: 'set', key });
      if (s.failSet(key, value, inner.dump())) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      inner.setItem(key, value);
    },
    removeItem(key) {
      s.calls.push({ op: 'remove', key });
      if (s.failRemove) throw new Error('remove denied');
      inner.removeItem(key);
    },
    dump: () => inner.dump(),
  };
  return s;
}

async function mount(storage: StorageLike | null, strict = false) {
  probe.latest = null;
  const tree = (
    <BudgetProvider storage={storage} getToday={() => '2026-11-14'}>
      <Probe />
    </BudgetProvider>
  );
  const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  await screen.findByText('status: ready');
  return view;
}

function storedState(storage: { dump(): Record<string, string> }): BudgetState {
  const loaded = parseStoredBudget(storage.dump()[STORAGE_KEY] ?? null);
  if (loaded.status !== 'loaded') throw new Error('main key is not loadable');
  const month = loaded.book.months.find((m) => m.month === '2026-11');
  if (month === undefined) throw new Error('no current month stored');
  return month;
}

afterEach(() => vi.restoreAllMocks());

describe('nothing on load', () => {
  for (const [name, raw] of [
    ['version 1', V1],
    ['not json', 'not json'],
    ['an unsupported version', V3],
  ] as const) {
    it(`${name}: no writes, no backup key, even after viewMonth`, async () => {
      const storage = logStorage({ [STORAGE_KEY]: raw });
      await mount(storage);
      await new Promise((r) => setTimeout(r, 20));
      expect(storage.sets()).toHaveLength(0);
      expect(storage.dump()).toEqual({ [STORAGE_KEY]: raw });
      const other = ready().months.find((m) => m !== ready().viewedMonth);
      if (other !== undefined) act(() => ready().viewMonth(other));
      expect(storage.calls).toHaveLength(0);
      expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
    });
  }

  it('does not attempt a backup when storage is unavailable (null or throwing reads)', async () => {
    const nullView = await mount(null);
    expect(() => act(() => ready().actions.setIncome(5))).not.toThrow();
    nullView.unmount();
    const storage = createMemoryStorage({ [STORAGE_KEY]: V1 }, { throwOnGet: true });
    await mount(storage);
    expect(ready().loadStatus).toBe('unavailable');
    act(() => ready().actions.setIncome(5));
    expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
  });
});

describe('first change from version 1', () => {
  it('writes the backup (=== V1) first, then version 2; a second change writes only the main key', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    await mount(storage);
    act(() => ready().actions.setIncome(500));
    expect(storage.calls).toEqual([
      { op: 'set', key: BACKUP_KEY },
      { op: 'set', key: STORAGE_KEY },
    ]);
    expect(storage.dump()[BACKUP_KEY] === V1).toBe(true);
    const saved = storedState(storage);
    expect(saved.incomeCents).toBe(500);
    expect(saved.categories).toEqual(SCENARIO.categories);
    expect(saved.expenses).toEqual(SCENARIO.expenses);
    expect(JSON.parse(storage.dump()[STORAGE_KEY]!).version).toBe(2);

    act(() => ready().actions.setIncome(600));
    expect(storage.sets(BACKUP_KEY)).toHaveLength(1);
    expect(storage.sets(STORAGE_KEY)).toHaveLength(2);
    expect(storage.dump()[BACKUP_KEY] === V1).toBe(true);
    expect(storedState(storage).incomeCents).toBe(600);
  });
});

describe('first change from invalid data', () => {
  for (const raw of ['not json', V3]) {
    it(`backs up ${raw} byte for byte and sets savedDataReplaced`, async () => {
      const storage = logStorage({ [STORAGE_KEY]: raw });
      await mount(storage);
      expect(ready().savedDataReplaced).toBe(false);
      act(() => ready().actions.setIncome(1));
      expect(storage.dump()[BACKUP_KEY] === raw).toBe(true);
      expect(storage.sets(BACKUP_KEY)).toHaveLength(1);
      expect(storedState(storage).incomeCents).toBe(1);
      expect(ready().savedDataReplaced).toBe(true);
    });
  }
});

describe('never for version 2, empty or unavailable', () => {
  it('version 2 data and empty storage are never backed up across several changes', async () => {
    const seeds: Record<string, string>[] = [{ [STORAGE_KEY]: serializeBook(BOOK) }, {}];
    for (const seed of seeds) {
      const storage = logStorage(seed);
      const view = await mount(storage);
      act(() => ready().actions.setIncome(1));
      act(() => ready().actions.addCategory({ name: 'Pets', plannedCents: 100 }));
      act(() => ready().actions.setIncome(2));
      expect(storage.sets(BACKUP_KEY)).toHaveLength(0);
      expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
      view.unmount();
    }
  });

  it('null storage: changes work and nothing is thrown', async () => {
    await mount(null);
    expect(() => {
      act(() => ready().actions.setIncome(1));
      act(() => ready().actions.setIncome(2));
    }).not.toThrow();
  });
});

describe('existing backup kept', () => {
  it('an earlier backup is not overwritten and the save proceeds', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1, [BACKUP_KEY]: 'older' });
    await mount(storage);
    act(() => ready().actions.setIncome(500));
    expect(storage.dump()[BACKUP_KEY]).toBe('older');
    expect(storage.sets(BACKUP_KEY)).toHaveLength(0);
    expect(storedState(storage).incomeCents).toBe(500);
  });
});

describe('no-op and throwing actions make no backup', () => {
  it('deleteExpense of an unknown id touches nothing', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    await mount(storage);
    act(() => ready().actions.deleteExpense('nope'));
    expect(storage.calls).toHaveLength(0);
    expect(storage.dump()).toEqual({ [STORAGE_KEY]: V1 });
  });

  it('removeCategory and updateCategory of unknown ids touch nothing, then a real change backs up', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    await mount(storage);
    act(() => {
      ready().actions.removeCategory('nope');
      ready().actions.updateCategory('nope', { name: 'x' });
    });
    expect(storage.calls).toHaveLength(0);
    act(() => ready().actions.setIncome(1));
    expect(storage.dump()[BACKUP_KEY]).toBe(V1);
  });

  it('an addExpense that makes a total too large throws and touches nothing', async () => {
    const big: BudgetState = {
      month: '2026-11',
      incomeCents: 0,
      categories: [{ id: 'c', name: 'C', plannedCents: 1 }],
      expenses: Array.from({ length: 90 }, (_v, i) => ({
        id: `e${i}`,
        categoryId: 'c',
        amountCents: MAX_CENTS,
        note: '',
        date: '2026-11-01',
      })),
    };
    const raw = JSON.stringify({ version: 1, state: big });
    const storage = logStorage({ [STORAGE_KEY]: raw });
    await mount(storage);
    let message = '';
    try {
      act(() => {
        ready().actions.addExpense({ categoryId: 'c', amountCents: MAX_CENTS, note: '', date: '2026-11-02' });
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(storage.calls).toHaveLength(0);
    expect(storage.dump()).toEqual({ [STORAGE_KEY]: raw });
  });
});

describe('backup fails, save goes on', () => {
  it('a backup quota failure does not block or show anything, and is not retried', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    storage.failSet = (key) => key === BACKUP_KEY;
    await mount(storage);
    const before = screen.getByTestId('out').textContent;
    expect(() => act(() => ready().actions.setIncome(500))).not.toThrow();
    expect(storedState(storage).incomeCents).toBe(500);
    expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
    expect(screen.getByTestId('out').textContent).toBe(before?.replace(String(SCENARIO.incomeCents), '500').replace('false', 'false'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(storage.sets(BACKUP_KEY)).toHaveLength(1);
    act(() => ready().actions.setIncome(600));
    expect(storage.sets(BACKUP_KEY)).toHaveLength(1);
    expect(storedState(storage).incomeCents).toBe(600);
  });
});

describe('backup takes the space', () => {
  it('removes the backup and retries the main save once, in that exact order', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    storage.failSet = (key, value, data) => {
      const total = Object.entries(data).reduce((sum, [k, v]) => sum + (k === key ? 0 : v.length), 0) + value.length;
      return total > V1.length * 2;
    };
    await mount(storage);
    act(() => ready().actions.setIncome(500));
    expect(storage.calls).toEqual([
      { op: 'set', key: BACKUP_KEY },
      { op: 'set', key: STORAGE_KEY },
      { op: 'remove', key: BACKUP_KEY },
      { op: 'set', key: STORAGE_KEY },
    ]);
    expect(storedState(storage).incomeCents).toBe(500);
    expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
    // Saved, so the backup is not tried again.
    act(() => ready().actions.setIncome(600));
    expect(storage.sets(BACKUP_KEY)).toHaveLength(1);
  });
});

describe('failed first save', () => {
  it('keeps the backup pending and retries it with the original text, not the version 2 text', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    let down = true;
    storage.failSet = () => down;
    await mount(storage);
    act(() => ready().actions.setIncome(1));
    expect(storage.dump()).toEqual({ [STORAGE_KEY]: V1 });
    down = false;
    storage.calls.length = 0;
    act(() => ready().actions.setIncome(2));
    expect(storage.calls).toEqual([
      { op: 'set', key: BACKUP_KEY },
      { op: 'set', key: STORAGE_KEY },
    ]);
    expect(storage.dump()[BACKUP_KEY] === V1).toBe(true);
    expect(storedState(storage).incomeCents).toBe(2);
    act(() => ready().actions.setIncome(3));
    expect(storage.sets(BACKUP_KEY)).toHaveLength(1);
  });
});

describe('StrictMode', () => {
  it('zero writes on load; one addCategory writes each key exactly once; no console noise', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    await mount(storage, true);
    await new Promise((r) => setTimeout(r, 20));
    expect(storage.sets()).toHaveLength(0);
    act(() => {
      ready().actions.addCategory({ name: 'Pets', plannedCents: 100 });
    });
    expect(storage.sets(BACKUP_KEY)).toHaveLength(1);
    expect(storage.sets(STORAGE_KEY)).toHaveLength(1);
    expect(storage.dump()[BACKUP_KEY] === V1).toBe(true);
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('delete all data removes the backup', () => {
  it('(a) after a backup was written, leaves exactly the empty book', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    await mount(storage);
    act(() => ready().actions.setIncome(5));
    expect(storage.dump()[BACKUP_KEY]).toBe(V1);
    act(() => ready().actions.deleteAllData());
    expect(storage.dump()).toEqual({ [STORAGE_KEY]: EMPTY_V2 });
  });

  it('(b) removes a backup from an earlier session over version 2 data', async () => {
    const storage = logStorage({ [STORAGE_KEY]: serializeBook(BOOK), [BACKUP_KEY]: 'older' });
    await mount(storage);
    act(() => ready().actions.deleteAllData());
    expect(storage.dump()).toEqual({ [STORAGE_KEY]: EMPTY_V2 });
  });

  it('(c) as the first change makes no backup, and later changes make none either', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1 });
    await mount(storage);
    act(() => ready().actions.deleteAllData());
    expect(storage.sets(BACKUP_KEY)).toHaveLength(0);
    expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
    act(() => ready().actions.setIncome(7));
    expect(storage.sets(BACKUP_KEY)).toHaveLength(0);
    expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
  });

  it('removes the backup even when the empty-book save fails', async () => {
    const storage = logStorage({ [STORAGE_KEY]: V1, [BACKUP_KEY]: 'older' });
    storage.failSet = () => true;
    await mount(storage);
    expect(() => act(() => ready().actions.deleteAllData())).not.toThrow();
    expect(storage.dump()[BACKUP_KEY]).toBeUndefined();
  });

  it('a throwing removeItem does not throw, saves the empty book and shows no error', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = logStorage({ [STORAGE_KEY]: serializeBook(BOOK), [BACKUP_KEY]: 'older' });
    storage.failRemove = true;
    await mount(storage);
    expect(() => act(() => ready().actions.deleteAllData())).not.toThrow();
    expect(storage.dump()[STORAGE_KEY]).toBe(EMPTY_V2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('savedDataReplaced is unchanged', () => {
  it('stays false for version 1, becomes true for invalid data, and is false when the save fails', async () => {
    const v1 = logStorage({ [STORAGE_KEY]: V1 });
    const view = await mount(v1);
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(false);
    view.unmount();

    const bad = logStorage({ [STORAGE_KEY]: 'not json' });
    bad.failSet = () => true;
    const view2 = await mount(bad);
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(false);
    view2.unmount();
  });
});

describe('the public context is unchanged', () => {
  it('has exactly the documented keys and seven actions', async () => {
    const view = renderWithBudget(<Probe />, { storage: createMemoryStorage({ [STORAGE_KEY]: V1 }) });
    await screen.findByText('status: ready');
    expect(Object.keys(ready()).sort()).toEqual(
      [
        'status', 'state', 'book', 'viewedMonth', 'months', 'isViewedMonthStored', 'copiedFromMonth', 'today',
        'currentMonth', 'generation', 'loadStatus', 'savedDataReplaced', 'viewMonth', 'actions',
      ].sort(),
    );
    expect(Object.keys(ready().actions).sort()).toEqual(
      ['setIncome', 'addCategory', 'updateCategory', 'removeCategory', 'addExpense', 'deleteExpense', 'deleteAllData'].sort(),
    );
    view.unmount();
  });
});
