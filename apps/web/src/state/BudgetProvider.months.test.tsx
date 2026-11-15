import { act, render, screen } from '@testing-library/react';
import { type ReactElement, StrictMode, useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAX_CENTS, createInitialState } from '@/lib/budget';
import type { BudgetState } from '@/lib/budget';
import { type BudgetBook, EMPTY_BOOK } from '@/lib/months';
import { BOOK, OCTOBER, SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import type { RenderWithBudgetOptions } from '@/test/renderWithBudget';
import { renderWithBudget } from '@/test/renderWithBudget';
import { type BudgetContextValue, BudgetProvider, TOTAL_TOO_LARGE_MESSAGE, useBudget } from './BudgetProvider';
import { BACKUP_KEY, STORAGE_KEY, parseStoredBudget, serializeBook } from './storage';

type Ready = Extract<BudgetContextValue, { status: 'ready' }>;
const probe: { latest: BudgetContextValue | null; renders: BudgetContextValue[] } = { latest: null, renders: [] };

function Probe(): ReactElement {
  const budget = useBudget();
  useEffect(() => {
    probe.latest = budget;
    probe.renders.push(budget);
  });
  return <p>{budget.status === 'ready' ? 'status: ready' : 'status: loading'}</p>;
}

function ready(): Ready {
  if (probe.latest === null || probe.latest.status !== 'ready') throw new Error('not ready');
  return probe.latest;
}

async function mount(options: RenderWithBudgetOptions = {}) {
  probe.latest = null;
  probe.renders = [];
  const result = renderWithBudget(<Probe />, options);
  await screen.findByText('status: ready');
  return result;
}

const V1_SCENARIO = JSON.stringify({ version: 1, state: SCENARIO });
const SEED_V1 = { [STORAGE_KEY]: V1_SCENARIO };
const RENT_DEC = { categoryId: 'suggested-rent', amountCents: 2000, note: '', date: '2026-12-03' };

afterEach(() => vi.restoreAllMocks());

describe('Migration without writing', () => {
  it('v1 SCENARIO shows as state, loadStatus loaded, no writes, byte-identical', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage });
    expect(ready().state).toEqual(SCENARIO);
    expect(ready().loadStatus).toBe('loaded');
    expect(ready().book).toEqual({ months: [SCENARIO] });
    expect(ready().savedDataReplaced).toBe(false);
    expect(storage.setItemCalls).toBe(0);
    await new Promise((r) => setTimeout(r, 20));
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(V1_SCENARIO);
  });

  it('viewMonth to the current month and the unrelated re-renders still never write v1', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage });
    act(() => ready().viewMonth('2026-11'));
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(V1_SCENARIO);
  });

  it('first change writes version 2 with exactly one month, income changed, all else intact', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage });
    act(() => ready().actions.setIncome(500));
    expect(storage.setItemCalls).toBe(2);
    expect(storage.dump()[BACKUP_KEY]).toBe(V1_SCENARIO);
    const raw = storage.dump()[STORAGE_KEY]!;
    expect(raw).toContain('"version":2');
    expect(JSON.parse(raw).version).toBe(2);
    const loaded = parseStoredBudget(raw);
    expect(loaded).toEqual({
      status: 'loaded',
      fromVersion: 2,
      book: { months: [{ ...SCENARIO, incomeCents: 500 }] },
    });
  });

  it('first change after migration keeps every category and expense (addExpense)', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage });
    act(() => {
      ready().actions.addExpense({ categoryId: 'suggested-transport', amountCents: 999, note: 'Bus', date: '2026-11-14' });
    });
    const { status, book } = parseStoredBudget(storage.dump()[STORAGE_KEY]!) as Extract<ReturnType<typeof parseStoredBudget>, { status: 'loaded' }>;
    expect(status).toBe('loaded');
    expect(book.months).toHaveLength(1);
    expect(book.months[0]!.categories).toEqual(SCENARIO.categories);
    expect(book.months[0]!.expenses).toEqual([...SCENARIO.expenses, { id: 'id-1', categoryId: 'suggested-transport', amountCents: 999, note: 'Bus', date: '2026-11-14' }]);
    expect(book.months[0]!.incomeCents).toBe(320000);
  });

  it('a no-op after migration still leaves the v1 value untouched', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage });
    act(() => ready().actions.deleteExpense('nope'));
    act(() => ready().actions.removeCategory('nope'));
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(V1_SCENARIO);
  });

  it('a failed first write after migration does not lose the in-memory data', async () => {
    const storage = createMemoryStorage(SEED_V1, { throwOnSet: true });
    await mount({ storage });
    act(() => ready().actions.setIncome(500));
    expect(ready().state).toEqual({ ...SCENARIO, incomeCents: 500 });
    expect(storage.dump()[STORAGE_KEY]).toBe(V1_SCENARIO);
  });
});

describe('Migration of an older month', () => {
  it('v1 November data with today 2026-12-02: December copy, nothing written', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage, today: '2026-12-02' });
    const r = ready();
    expect(r.viewedMonth).toBe('2026-12');
    expect(r.currentMonth).toBe('2026-12');
    expect(r.state.month).toBe('2026-12');
    expect(r.state.incomeCents).toBe(320000);
    expect(r.state.categories).toEqual(SCENARIO.categories);
    expect(r.state.expenses).toEqual([]);
    expect(r.isViewedMonthStored).toBe(false);
    expect(r.copiedFromMonth).toBe('2026-11');
    expect(r.months).toEqual(['2026-11', '2026-12']);
    expect(r.book).toEqual({ months: [SCENARIO] });
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(V1_SCENARIO);
  });

  it('then the first change writes v2 with both November (intact) and December', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage, today: '2026-12-02' });
    act(() => ready().actions.setIncome(1));
    const loaded = parseStoredBudget(storage.dump()[STORAGE_KEY]!);
    if (loaded.status !== 'loaded') throw new Error('not loaded');
    expect(loaded.fromVersion).toBe(2);
    expect(loaded.book.months).toHaveLength(2);
    expect(loaded.book.months[0]).toEqual(SCENARIO);
    expect(loaded.book.months[1]).toEqual({ ...createInitialState('2026-12'), incomeCents: 1, categories: SCENARIO.categories });
  });

  it('clock moved back before the only stored month: current month empty, nothing written', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage, today: '2026-10-05' });
    expect(ready().state).toEqual(createInitialState('2026-10'));
    expect(ready().copiedFromMonth).toBeNull();
    expect(ready().months).toEqual(['2026-10', '2026-11']);
    expect(storage.setItemCalls).toBe(0);
  });
});

describe('New month stored on first change only', () => {
  it('BOOK with today 2026-12-02: shows a copy, writes nothing on load', async () => {
    const r = await mount({ book: BOOK, today: '2026-12-02' });
    expect(r.storage.setItemCalls).toBe(0);
    expect(r.readStoredBook()?.months).toHaveLength(2);
    expect(ready().state.expenses).toEqual([]);
    expect(ready().state.categories).toEqual(SCENARIO.categories);
    expect(ready().copiedFromMonth).toBe('2026-11');
    expect(ready().isViewedMonthStored).toBe(false);
  });

  it('addExpense stores December (5 copied categories + 1 expense), November unchanged', async () => {
    const r = await mount({ book: BOOK, today: '2026-12-02' });
    act(() => ready().actions.addExpense(RENT_DEC));
    const stored = r.readStoredBook()!;
    expect(stored.months.map((m) => m.month)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(stored.months[0]).toEqual(OCTOBER);
    expect(stored.months[1]).toEqual(SCENARIO);
    expect(stored.months[2]!.categories).toEqual(SCENARIO.categories);
    expect(stored.months[2]!.incomeCents).toBe(320000);
    expect(stored.months[2]!.expenses).toEqual([{ id: 'id-1', ...RENT_DEC }]);
    expect(ready().isViewedMonthStored).toBe(true);
    expect(ready().copiedFromMonth).toBeNull();
  });

  it('no-op on the unstored month stores nothing and does not write', async () => {
    const r = await mount({ book: BOOK, today: '2026-12-02' });
    const before = ready().state;
    act(() => ready().actions.deleteExpense('nope'));
    act(() => ready().actions.removeCategory('nope'));
    expect(r.storage.setItemCalls).toBe(0);
    expect(r.readStoredBook()?.months).toHaveLength(2);
    expect(ready().state).toBe(before);
    expect(ready().isViewedMonthStored).toBe(false);
  });

  it('every kind of first change stores the new month (setIncome, addCategory, updateCategory, removeCategory)', async () => {
    for (const run of [
      (a: Ready['actions']) => a.setIncome(5),
      (a: Ready['actions']) => a.addCategory({ name: 'Pets', plannedCents: 1 }),
      (a: Ready['actions']) => a.updateCategory('suggested-rent', { plannedCents: 1 }),
      (a: Ready['actions']) => a.removeCategory('suggested-rent'),
    ]) {
      const r = await mount({ book: BOOK, today: '2026-12-02' });
      act(() => run(ready().actions));
      expect(r.storage.setItemCalls).toBe(1);
      expect(r.readStoredBook()!.months.map((m) => m.month)).toEqual(['2026-10', '2026-11', '2026-12']);
      expect(r.readStoredBook()!.months[1]).toEqual(SCENARIO);
      r.unmount();
    }
  });

  it('a clock month between stored months copies from the earlier one only', async () => {
    const book: BudgetBook = { months: [OCTOBER, { ...SCENARIO, month: '2027-02', incomeCents: 7, expenses: [] }] };
    await mount({ book, today: '2026-12-02' });
    expect(ready().state.incomeCents).toBe(300000);
    expect(ready().copiedFromMonth).toBe('2026-10');
    expect(ready().months).toEqual(['2026-10', '2026-12', '2027-02']);
  });
});

describe('Months are independent / past months editable', () => {
  it('editing a category in October leaves November alone', async () => {
    const r = await mount({ book: BOOK });
    act(() => ready().viewMonth('2026-10'));
    act(() => ready().actions.updateCategory('suggested-groceries', { name: 'Food' }));
    const stored = r.readStoredBook()!;
    expect(stored.months[0]!.categories.find((c) => c.id === 'suggested-groceries')!.name).toBe('Food');
    expect(stored.months[1]).toEqual(SCENARIO);
    expect(stored.months[1]!.categories.find((c) => c.id === 'suggested-groceries')!.name).toBe('Groceries');
    expect(ready().state.categories.find((c) => c.id === 'suggested-groceries')!.name).toBe('Food');
  });

  it('income and expense changes in the viewed month do not touch other months', async () => {
    const r = await mount({ book: BOOK });
    act(() => ready().actions.setIncome(42));
    act(() => ready().viewMonth('2026-10'));
    act(() => ready().actions.deleteExpense('o2'));
    const stored = r.readStoredBook()!;
    expect(stored.months[1]).toEqual({ ...SCENARIO, incomeCents: 42 });
    expect(stored.months[0]).toEqual({ ...OCTOBER, expenses: [OCTOBER.expenses[0]] });
  });

  it('October expense dated in October is stored there; dated in November throws and changes nothing', async () => {
    const r = await mount({ book: BOOK });
    act(() => ready().viewMonth('2026-10'));
    act(() => {
      ready().actions.addExpense({ categoryId: 'suggested-rent', amountCents: 100, note: '', date: '2026-10-20' });
    });
    expect(r.readStoredBook()!.months[0]!.expenses.at(-1)).toEqual({ id: 'id-1', categoryId: 'suggested-rent', amountCents: 100, note: '', date: '2026-10-20' });
    expect(r.readStoredBook()!.months[1]).toEqual(SCENARIO);
    const calls = r.storage.setItemCalls;
    const before = ready().state;
    expect(() => ready().actions.addExpense({ categoryId: 'suggested-rent', amountCents: 100, note: '', date: '2026-11-01' })).toThrow(RangeError);
    expect(r.storage.setItemCalls).toBe(calls);
    expect(ready().state).toBe(before);
  });
});

describe('viewMonth', () => {
  it('never writes, follows viewedMonth, and keeps generation', async () => {
    const r = await mount({ book: BOOK });
    act(() => ready().viewMonth('2026-10'));
    expect(ready().viewedMonth).toBe('2026-10');
    expect(ready().state).toEqual(OCTOBER);
    expect(ready().state.month).toBe('2026-10');
    expect(ready().isViewedMonthStored).toBe(true);
    expect(ready().copiedFromMonth).toBeNull();
    expect(ready().generation).toBe(0);
    act(() => ready().viewMonth('2026-11'));
    expect(ready().state).toEqual(SCENARIO);
    expect(r.storage.setItemCalls).toBe(0);
  });

  it('does not touch storage at all (no reads)', async () => {
    const r = await mount({ book: BOOK });
    const gets = r.storage.getItemCalls;
    act(() => ready().viewMonth('2026-10'));
    expect(r.storage.getItemCalls).toBe(gets);
  });

  it('throws RangeError for a month not in months, and leaves the view alone', async () => {
    const r = await mount({ book: BOOK });
    expect(() => ready().viewMonth('2026-09')).toThrow(RangeError);
    expect(() => ready().viewMonth('2026-12')).toThrow(RangeError);
    expect(() => ready().viewMonth('garbage')).toThrow(RangeError);
    expect(ready().viewedMonth).toBe('2026-11');
    expect(r.storage.setItemCalls).toBe(0);
  });

  it('allows an unstored current month (shown as a copy) and returns to it', async () => {
    const r = await mount({ book: BOOK, today: '2026-12-02' });
    act(() => ready().viewMonth('2026-10'));
    expect(ready().state).toEqual(OCTOBER);
    act(() => ready().viewMonth('2026-12'));
    expect(ready().isViewedMonthStored).toBe(false);
    expect(ready().state.month).toBe('2026-12');
    expect(r.storage.setItemCalls).toBe(0);
  });

  it('a future month is rejected even when the viewed month is a later stored one', async () => {
    await mount({ book: { months: [OCTOBER, SCENARIO] }, today: '2026-10-05' });
    // November is stored (in the future of the clock) so it is available; December is not.
    expect(ready().months).toEqual(['2026-10', '2026-11']);
    expect(() => ready().viewMonth('2026-12')).toThrow(RangeError);
    act(() => ready().viewMonth('2026-11'));
    expect(ready().state).toEqual(SCENARIO);
  });

  it('viewing the already-viewed month is a harmless no-op (same state object)', async () => {
    await mount({ book: BOOK });
    const before = ready().state;
    act(() => ready().viewMonth('2026-11'));
    expect(ready().state).toBe(before);
  });

  it('viewMonth and actions are stable across views and changes', async () => {
    await mount({ book: BOOK });
    const { viewMonth, actions } = ready();
    act(() => ready().viewMonth('2026-10'));
    act(() => ready().actions.setIncome(9));
    act(() => ready().viewMonth('2026-11'));
    expect(ready().viewMonth).toBe(viewMonth);
    expect(ready().actions).toBe(actions);
  });

  it('data actions apply to the viewed month after switching back and forth', async () => {
    const r = await mount({ book: BOOK });
    act(() => ready().viewMonth('2026-10'));
    act(() => ready().viewMonth('2026-11'));
    act(() => ready().actions.setIncome(11));
    expect(r.readStoredBook()!.months.map((m) => m.incomeCents)).toEqual([300000, 11]);
  });
});

describe('deleteAllData', () => {
  it('empties the book, returns to the current month, bumps generation, writes an empty v2 book', async () => {
    const r = await mount({ book: BOOK });
    act(() => ready().viewMonth('2026-10'));
    act(() => ready().actions.deleteAllData());
    expect(r.readStoredBook()).toEqual({ months: [] });
    expect(r.storage.dump()[STORAGE_KEY]).toBe('{"version":2,"book":{"months":[]}}');
    expect(ready().viewedMonth).toBe('2026-11');
    expect(ready().state).toEqual(createInitialState('2026-11'));
    expect(ready().generation).toBe(1);
    expect(ready().months).toEqual(['2026-11']);
    expect(ready().book).toEqual({ months: [] });
    expect(ready().isViewedMonthStored).toBe(false);
    expect(ready().copiedFromMonth).toBeNull();
    r.refresh();
    await screen.findByText('status: ready');
    expect(ready().state).toEqual(createInitialState('2026-11'));
    expect(ready().months).toEqual(['2026-11']);
    expect(ready().generation).toBe(0);
    expect(ready().loadStatus).toBe('loaded');
  });

  it('generation increments every time, other actions do not change it', async () => {
    await mount({ book: BOOK });
    act(() => ready().actions.setIncome(1));
    expect(ready().generation).toBe(0);
    act(() => ready().actions.deleteAllData());
    act(() => ready().actions.deleteAllData());
    expect(ready().generation).toBe(2);
  });

  it('works on unavailable storage (in memory) and on throwing storage', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeBook(BOOK) }, { throwOnSet: true });
    await mount({ storage });
    act(() => ready().actions.deleteAllData());
    expect(ready().book).toEqual({ months: [] });
    expect(ready().generation).toBe(1);
    expect(storage.dump()[STORAGE_KEY]).toBe(serializeBook(BOOK));
  });

  it('after deleteAllData the next change starts from an empty book', async () => {
    const r = await mount({ book: BOOK });
    act(() => ready().actions.deleteAllData());
    act(() => ready().actions.setIncome(5));
    expect(r.readStoredBook()).toEqual({ months: [{ ...createInitialState('2026-11'), incomeCents: 5 }] });
  });

  it('on a stored v1 value it replaces it with an empty v2 book', async () => {
    const storage = createMemoryStorage(SEED_V1);
    await mount({ storage });
    act(() => ready().actions.deleteAllData());
    expect(storage.dump()[STORAGE_KEY]).toBe('{"version":2,"book":{"months":[]}}');
  });
});

describe('First run', () => {
  it('empty storage: initial state, empty book, one month, no copy, loadStatus empty, nothing written', async () => {
    const r = await mount();
    expect(ready().state).toEqual(createInitialState('2026-11'));
    expect(ready().book).toEqual({ months: [] });
    expect(ready().months).toEqual(['2026-11']);
    expect(ready().copiedFromMonth).toBeNull();
    expect(ready().loadStatus).toBe('empty');
    expect(ready().isViewedMonthStored).toBe(false);
    expect(ready().generation).toBe(0);
    expect(r.storage.setItemCalls).toBe(0);
    expect(r.readStoredBook()).toBeNull();
  });

  it('first change stores one month with no categories', async () => {
    const r = await mount();
    act(() => ready().actions.setIncome(100));
    expect(r.readStoredBook()).toEqual({ months: [{ ...createInitialState('2026-11'), incomeCents: 100 }] });
  });
});

describe('loading never writes', () => {
  it('v2 BOOK, with a different clock month, in StrictMode', async () => {
    for (const today of ['2026-11-14', '2026-12-02', '2026-09-30', '2027-01-01']) {
      const storage = createMemoryStorage({ [STORAGE_KEY]: serializeBook(BOOK) });
      probe.latest = null;
      const view = render(
        <StrictMode>
          <BudgetProvider storage={storage} getToday={() => today}>
            <Probe />
          </BudgetProvider>
        </StrictMode>,
      );
      await screen.findByText('status: ready');
      await new Promise((r) => setTimeout(r, 10));
      expect(storage.setItemCalls).toBe(0);
      expect(storage.dump()[STORAGE_KEY]).toBe(serializeBook(BOOK));
      view.unmount();
    }
  });

  it('invalid data: not written until a change, then savedDataReplaced', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2, book: { months: [OCTOBER, OCTOBER] } }) });
    await mount({ storage });
    expect(ready().loadStatus).toBe('invalid');
    expect(ready().book).toEqual({ months: [] });
    expect(ready().state).toEqual(createInitialState('2026-11'));
    expect(ready().savedDataReplaced).toBe(false);
    expect(storage.setItemCalls).toBe(0);
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(true);
  });

  it('a v2 value with one invalid month loads nothing from the other months and stays byte-identical', async () => {
    const raw = JSON.stringify({ version: 2, book: { months: [OCTOBER, { ...SCENARIO, incomeCents: 1.5 }] } });
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    await mount({ storage });
    expect(ready().loadStatus).toBe('invalid');
    expect(ready().book).toEqual({ months: [] });
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });

  it('unsupported version: invalid, byte-identical until the first change', async () => {
    const raw = JSON.stringify({ version: 3, book: { months: [] } });
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    await mount({ storage });
    expect(ready().loadStatus).toBe('invalid');
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(true);
  });

  it('deleteAllData over invalid data counts as replacing it (savedDataReplaced true)', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'junk' });
    await mount({ storage });
    act(() => ready().actions.deleteAllData());
    expect(ready().savedDataReplaced).toBe(true);
    expect(storage.dump()[STORAGE_KEY]).toBe('{"version":2,"book":{"months":[]}}');
  });

  it('savedDataReplaced stays false for loaded v1 and v2 data after changes', async () => {
    const first = await mount({ storage: createMemoryStorage(SEED_V1) });
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(false);
    first.unmount();
    await mount({ book: BOOK });
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(false);
  });

  it('unavailable storage: ready with an empty book, changes work in memory', async () => {
    const storage = createMemoryStorage({}, { throwOnGet: true });
    await mount({ storage });
    expect(ready().loadStatus).toBe('unavailable');
    act(() => ready().actions.setIncome(7));
    expect(ready().state.incomeCents).toBe(7);
  });
});

describe('totals safety per month', () => {
  function big(n: number, month: string): BudgetState {
    return {
      month,
      incomeCents: 0,
      categories: Array.from({ length: n }, (_v, i) => ({ id: `c${i}`, name: `n${i}`, plannedCents: MAX_CENTS })),
      expenses: [],
    };
  }

  it('a stored book where one month cannot be totalled is invalid as a whole', async () => {
    const raw = JSON.stringify({ version: 2, book: { months: [OCTOBER, big(91, '2026-11')] } });
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    await mount({ storage });
    expect(ready().loadStatus).toBe('invalid');
    expect(ready().book).toEqual({ months: [] });
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });

  it('addCategory overflow throws the exact message and changes nothing', async () => {
    const book: BudgetBook = { months: [OCTOBER, big(90, '2026-11')] };
    const r = await mount({ book });
    const before = ready().state;
    const raw = r.storage.dump()[STORAGE_KEY];
    let thrown: unknown;
    try {
      ready().actions.addCategory({ name: 'Extra', plannedCents: MAX_CENTS });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(RangeError);
    expect((thrown as RangeError).message).toBe(TOTAL_TOO_LARGE_MESSAGE);
    expect(TOTAL_TOO_LARGE_MESSAGE).toBe('That change would make a total too large.');
    expect(ready().state).toBe(before);
    expect(r.storage.setItemCalls).toBe(0);
    expect(r.storage.dump()[STORAGE_KEY]).toBe(raw);
  });

  it('overflow on an unstored month copied from a near-limit month throws and stores nothing', async () => {
    const book: BudgetBook = { months: [big(90, '2026-11')] };
    const r = await mount({ book, today: '2026-12-02' });
    expect(ready().state.categories).toHaveLength(90);
    expect(ready().isViewedMonthStored).toBe(false);
    expect(() => ready().actions.addCategory({ name: 'Extra', plannedCents: MAX_CENTS })).toThrow(TOTAL_TOO_LARGE_MESSAGE);
    expect(r.storage.setItemCalls).toBe(0);
    expect(r.readStoredBook()!.months).toHaveLength(1);
    expect(ready().isViewedMonthStored).toBe(false);
  });

  it('an overflow in one month does not block changes in another', async () => {
    const book: BudgetBook = { months: [OCTOBER, big(90, '2026-11')] };
    const r = await mount({ book });
    act(() => ready().viewMonth('2026-10'));
    act(() => ready().actions.addCategory({ name: 'Extra', plannedCents: MAX_CENTS }));
    expect(r.readStoredBook()!.months[0]!.categories).toHaveLength(6);
  });

  it('a reducer error (duplicate name) propagates and writes nothing', async () => {
    const r = await mount({ book: BOOK });
    expect(() => ready().actions.addCategory({ name: 'Rent', plannedCents: 1 })).toThrow();
    expect(r.storage.setItemCalls).toBe(0);
  });
});

describe('ids, identity and hydration', () => {
  it('addCategory and addExpense return the generated ids', async () => {
    await mount({ book: BOOK });
    let a = '';
    let b = '';
    act(() => {
      a = ready().actions.addCategory({ name: 'Pets', plannedCents: 1 });
      b = ready().actions.addExpense({ categoryId: 'suggested-rent', amountCents: 5, note: '', date: '2026-11-02' });
    });
    expect([a, b]).toEqual(['id-1', 'id-2']);
  });

  it('state is the same object across re-renders from an unrelated parent state change', async () => {
    let bump: () => void = () => undefined;
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeBook(BOOK) });
    function Parent(): ReactElement {
      const [n, setN] = useState(0);
      useEffect(() => {
        bump = () => setN((x) => x + 1);
      }, []);
      return (
        <BudgetProvider storage={storage} getToday={() => '2026-12-02'}>
          <p>{n}</p>
          <Probe />
        </BudgetProvider>
      );
    }
    probe.latest = null;
    render(<Parent />);
    await screen.findByText('status: ready');
    const first = ready().state;
    act(() => bump());
    act(() => bump());
    expect(ready().state).toBe(first);
    expect(ready().book).toBe(ready().book);
  });

  it('state and value are stable with no change, but state changes identity after a real change', async () => {
    await mount({ book: BOOK });
    const before = ready().state;
    act(() => ready().actions.setIncome(1));
    expect(ready().state).not.toBe(before);
    const after = ready().state;
    act(() => ready().actions.deleteExpense('nope'));
    expect(ready().state).toBe(after);
  });

  it('first render is loading (hydration-safe) and getToday/createId are not called during render', async () => {
    const getToday = vi.fn(() => '2026-11-14');
    const createId = vi.fn(() => 'x');
    const statuses: string[] = [];
    function Spy(): ReactElement {
      const b = useBudget();
      statuses.push(b.status);
      return <p>{b.status}</p>;
    }
    const { renderToString } = await import('react-dom/server');
    const html = renderToString(
      <BudgetProvider storage={createMemoryStorage({ [STORAGE_KEY]: serializeBook(BOOK) })} getToday={getToday} createId={createId}>
        <Spy />
      </BudgetProvider>,
    );
    expect(html).toContain('loading');
    expect(getToday).not.toHaveBeenCalled();
    expect(createId).not.toHaveBeenCalled();
    expect(statuses).toEqual(['loading']);
  });

  it('useBudget throws outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(Error);
  });
});

describe('renderWithBudget helper with a book', () => {
  it('seeds without writing, readStored is today’s month, readStoredBook is BOOK', async () => {
    const r = await mount({ book: BOOK });
    expect(r.storage.setItemCalls).toBe(0);
    expect(r.readStored()).toEqual(SCENARIO);
    expect(r.readStoredBook()).toEqual(BOOK);
    expect(EMPTY_BOOK.months).toHaveLength(0);
  });
});
