import { act, cleanup, render, screen } from '@testing-library/react';
import { StrictMode, type ReactElement, useEffect } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type BudgetState, MAX_CENTS, createInitialState } from '@/lib/budget';
import { SCENARIO } from '@/test/fixtures';
import { createMemoryStorage } from '@/test/memoryStorage';
import { renderWithBudget } from '@/test/renderWithBudget';
import { type BudgetActions, type BudgetContextValue, BudgetProvider, useBudget } from './BudgetProvider';
import { STORAGE_KEY, serializeBook } from './storage';

function serializeOneMonth(state: BudgetState): string {
  return serializeBook({ months: [state] });
}

const probe: { latest: BudgetContextValue | null; seenActions: BudgetActions[] } = { latest: null, seenActions: [] };

function Probe(): ReactElement {
  const budget = useBudget();
  useEffect(() => {
    probe.latest = budget;
    if (budget.status === 'ready') probe.seenActions.push(budget.actions);
  });
  if (budget.status === 'loading') return <p>status: loading</p>;
  return (
    <div>
      <p>status: ready</p>
      <p data-testid="load">{budget.loadStatus}</p>
      <p data-testid="current">{budget.currentMonth}</p>
      <p data-testid="viewed">{budget.viewedMonth}</p>
      <p data-testid="gen">{budget.generation}</p>
      <p data-testid="today">{budget.today}</p>
      <pre data-testid="state">{JSON.stringify(budget.state)}</pre>
    </div>
  );
}

function ready(): Extract<BudgetContextValue, { status: 'ready' }> {
  const { latest } = probe;
  if (latest === null || latest.status !== 'ready') throw new Error('not ready');
  return latest;
}

function shownState(): BudgetState {
  return JSON.parse(screen.getByTestId('state').textContent ?? 'null') as BudgetState;
}

async function mount(options: Parameters<typeof renderWithBudget>[1] = {}) {
  probe.seenActions.length = 0;
  probe.latest = null;
  const result = renderWithBudget(<Probe />, options);
  await screen.findByText('status: ready');
  return result;
}

const EXPENSE = { categoryId: 'suggested-groceries', amountCents: 8247, note: 'Weekly shop', date: '2026-11-03' };

describe('useBudget', () => {
  it('throws an Error outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(Error);
  });
});

describe('loading', () => {
  it('shows loading first and then ready after mount', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    const seen: string[] = [];
    function Spy(): ReactElement {
      const b = useBudget();
      seen.push(b.status);
      return <p>{b.status}</p>;
    }
    render(
      <BudgetProvider storage={storage} getToday={() => '2026-11-14'}>
        <Spy />
      </BudgetProvider>,
    );
    await screen.findByText('ready');
    expect(seen[0]).toBe('loading');
    expect(seen.at(-1)).toBe('ready');
    expect(seen.filter((s) => s === 'loading').length).toBeGreaterThan(0);
  });

  it('loads saved data', async () => {
    await mount({ state: SCENARIO });
    expect(screen.getByTestId('load')).toHaveTextContent('loaded');
    expect(shownState()).toEqual(SCENARIO);
    expect(ready().generation).toBe(0);
  });

  it('starts from the initial state for the current month when storage is empty', async () => {
    await mount();
    expect(screen.getByTestId('load')).toHaveTextContent('empty');
    expect(shownState()).toEqual(createInitialState('2026-11'));
  });

  it.each([
    ['not json', 'not json'],
    ['version 3', JSON.stringify({ version: 3, state: SCENARIO })],
    ['incomeCents "1250"', JSON.stringify({ version: 1, state: { ...SCENARIO, incomeCents: '1250' } })],
  ])('invalid stored data (%s): initial state, loadStatus invalid, raw value byte-identical, nothing written', async (_n, raw) => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    await mount({ storage });
    expect(screen.getByTestId('load')).toHaveTextContent('invalid');
    expect(shownState()).toEqual(createInitialState('2026-11'));
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.setItemCalls).toBe(0);
  });

  it('the first change overwrites invalid data', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'garbage' });
    await mount({ storage });
    expect(storage.setItemCalls).toBe(0);
    act(() => ready().actions.setIncome(700));
    expect(storage.setItemCalls).toBe(1);
    expect(storage.getItem(STORAGE_KEY)).toBe(serializeOneMonth({ ...createInitialState('2026-11'), incomeCents: 700 }));
  });

  it('the first change overwrites an unsupported-version value', async () => {
    const raw = JSON.stringify({ version: 3, state: SCENARIO });
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    await mount({ storage });
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    act(() => ready().actions.setIncome(1));
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ version: 2 });
  });

  it('loading never writes (SCENARIO seeded), even after extra renders', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    await mount({ storage });
    expect(storage.setItemCalls).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(storage.setItemCalls).toBe(0);
  });

  it('empty storage stays empty until the first change', async () => {
    const storage = createMemoryStorage();
    await mount({ storage });
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()).toEqual({});
    act(() => ready().actions.setIncome(5));
    expect(Object.keys(storage.dump())).toEqual([STORAGE_KEY]);
  });

  it('uses window.localStorage when no storage prop is given, and writes only after a change', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    window.localStorage.setItem(STORAGE_KEY, serializeOneMonth(SCENARIO));
    setItem.mockClear();
    render(
      <BudgetProvider getToday={() => '2026-11-14'}>
        <Probe />
      </BudgetProvider>,
    );
    await screen.findByText('status: ready');
    expect(shownState()).toEqual(SCENARIO);
    expect(setItem).not.toHaveBeenCalled();
    act(() => ready().actions.setIncome(5));
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').book.months[0].incomeCents).toBe(5);
  });

  it('falls back to memory only when window.localStorage access throws', async () => {
    // The shared afterEach calls localStorage.clear(), so the getter is restored inside the test.
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <BudgetProvider getToday={() => '2026-11-14'}>
          <Probe />
        </BudgetProvider>,
      );
      await screen.findByText('status: ready');
      expect(screen.getByTestId('load')).toHaveTextContent('unavailable');
      act(() => ready().actions.setIncome(5));
      expect(ready().state.incomeCents).toBe(5);
      expect(error).not.toHaveBeenCalled();
    } finally {
      getter.mockRestore();
    }
  });

  it('storage={null} means memory only', async () => {
    probe.seenActions.length = 0;
    render(
      <BudgetProvider storage={null} getToday={() => '2026-11-14'}>
        <Probe />
      </BudgetProvider>,
    );
    await screen.findByText('status: ready');
    expect(screen.getByTestId('load')).toHaveTextContent('unavailable');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    act(() => ready().actions.setIncome(5));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(ready().state.incomeCents).toBe(5);
  });
});

describe('render purity', () => {
  it('server render calls neither getToday, createId, crypto nor storage', () => {
    const getToday = vi.fn(() => '2026-11-14');
    const createId = vi.fn(() => 'id');
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    const getItem = vi.spyOn(storage, 'getItem');
    const html = renderToString(
      <BudgetProvider storage={storage} getToday={getToday} createId={createId}>
        <Probe />
      </BudgetProvider>,
    );
    expect(html).toContain('status: loading');
    expect(html).not.toContain('2026-11');
    expect(getToday).toHaveBeenCalledTimes(0);
    expect(createId).toHaveBeenCalledTimes(0);
    expect(uuid).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('server render with no storage prop does not touch window.localStorage', () => {
    const lookup = vi.spyOn(window, 'localStorage', 'get');
    renderToString(
      <BudgetProvider>
        <Probe />
      </BudgetProvider>,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('the first client render pass (before effects) reads nothing, and getToday runs once after mount', async () => {
    const getToday = vi.fn(() => '2026-11-14');
    const createId = vi.fn(() => 'id');
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    const getItem = vi.spyOn(storage, 'getItem');
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const atFirstRender: number[] = [];
    function Snapshot(): ReactElement {
      const b = useBudget();
      if (atFirstRender.length === 0) {
        atFirstRender.push(getToday.mock.calls.length, createId.mock.calls.length, getItem.mock.calls.length, uuid.mock.calls.length);
        expect(b.status).toBe('loading');
      }
      return <p>{b.status}</p>;
    }
    render(
      <BudgetProvider storage={storage} getToday={getToday} createId={createId}>
        <Snapshot />
      </BudgetProvider>,
    );
    await screen.findByText('ready');
    expect(atFirstRender).toEqual([0, 0, 0, 0]);
    expect(getToday).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(createId).not.toHaveBeenCalled();
  });

  it('getToday is not called again on re-renders, re-mounts of children or actions', async () => {
    const getToday = vi.fn(() => '2026-11-14');
    render(
      <BudgetProvider storage={createMemoryStorage()} getToday={getToday}>
        <Probe />
      </BudgetProvider>,
    );
    await screen.findByText('status: ready');
    act(() => ready().actions.setIncome(1));
    act(() => ready().actions.setIncome(2));
    expect(getToday).toHaveBeenCalledTimes(1);
  });
});

describe('currentMonth and the viewed month', () => {
  it('today in a later month: the month is started as a copy, nothing written', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    await mount({ storage, today: '2026-12-02' });
    expect(shownState()).toEqual({ ...SCENARIO, month: '2026-12', expenses: [] });
    expect(screen.getByTestId('current')).toHaveTextContent('2026-12');
    expect(screen.getByTestId('viewed')).toHaveTextContent('2026-12');
    expect(screen.getByTestId('today')).toHaveTextContent('2026-12-02');
    expect(storage.setItemCalls).toBe(0);
  });

  it('today in the same month (last day): the stored month is shown', async () => {
    await mount({ state: SCENARIO, today: '2026-11-30' });
    expect(shownState()).toEqual(SCENARIO);
    expect(screen.getByTestId('current')).toHaveTextContent('2026-11');
  });

  it('clock earlier than the stored month: the current month starts empty, nothing written', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    await mount({ storage, today: '2026-10-15' });
    expect(screen.getByTestId('current')).toHaveTextContent('2026-10');
    expect(shownState()).toEqual(createInitialState('2026-10'));
    expect(storage.setItemCalls).toBe(0);
  });

  it('same month number in a different year is another month', async () => {
    await mount({ state: SCENARIO, today: '2027-11-14' });
    expect(screen.getByTestId('current')).toHaveTextContent('2027-11');
    expect(shownState().month).toBe('2027-11');
  });

  it('empty storage creates the initial state for the injected month', async () => {
    await mount({ today: '2027-03-09' });
    expect(shownState().month).toBe('2027-03');
    expect(screen.getByTestId('viewed')).toHaveTextContent('2027-03');
  });
});

describe('actions', () => {
  it('setIncome saves', async () => {
    const { readStored } = await mount({ state: SCENARIO });
    act(() => ready().actions.setIncome(500));
    expect(readStored()?.incomeCents).toBe(500);
    expect(shownState().incomeCents).toBe(500);
  });

  it('addExpense saves the expense with the injected id and returns it', async () => {
    const { readStored } = await mount({ state: SCENARIO });
    let id = '';
    act(() => {
      id = ready().actions.addExpense(EXPENSE);
    });
    expect(id).toBe('id-1');
    expect(readStored()?.expenses.at(-1)).toEqual({ id: 'id-1', ...EXPENSE });
    expect(readStored()?.expenses).toHaveLength(SCENARIO.expenses.length + 1);
  });

  it('every action persists and matches the reducer result', async () => {
    const { readStored } = await mount({ state: SCENARIO });
    let catId = '';
    act(() => {
      catId = ready().actions.addCategory({ name: 'Pets', plannedCents: 2500 });
    });
    expect(catId).toBe('id-1');
    expect(readStored()?.categories.at(-1)).toEqual({ id: 'id-1', name: 'Pets', plannedCents: 2500 });
    act(() => ready().actions.updateCategory('id-1', { plannedCents: 3000 }));
    expect(readStored()?.categories.at(-1)?.plannedCents).toBe(3000);
    act(() => ready().actions.deleteExpense('e1'));
    expect(readStored()?.expenses.map((e) => e.id)).toEqual(['e2', 'e3']);
    act(() => ready().actions.removeCategory('suggested-rent'));
    expect(readStored()?.categories.map((c) => c.id)).not.toContain('suggested-rent');
    // expenses of the removed category stay (removed categories are allowed)
    expect(readStored()?.expenses.map((e) => e.id)).toEqual(['e2', 'e3']);
    expect(readStored()).toEqual(ready().state);
  });

  it('ids come from the injected generator, in order', async () => {
    const ids = ['alpha', 'beta'];
    const createId = vi.fn(() => ids.shift() ?? 'extra');
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    render(
      <BudgetProvider storage={storage} getToday={() => '2026-11-14'} createId={createId}>
        <Probe />
      </BudgetProvider>,
    );
    await screen.findByText('status: ready');
    let a = '';
    let b = '';
    act(() => {
      a = ready().actions.addCategory({ name: 'Pets', plannedCents: 1 });
      b = ready().actions.addExpense({ ...EXPENSE, categoryId: 'alpha' });
    });
    expect([a, b]).toEqual(['alpha', 'beta']);
    expect(createId).toHaveBeenCalledTimes(2);
  });

  it('default id generator is crypto.randomUUID', async () => {
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    render(
      <BudgetProvider storage={createMemoryStorage()} getToday={() => '2026-11-14'}>
        <Probe />
      </BudgetProvider>,
    );
    await screen.findByText('status: ready');
    expect(uuid).not.toHaveBeenCalled();
    let id = '';
    act(() => {
      id = ready().actions.addCategory({ name: 'Pets', plannedCents: 1 });
    });
    expect(id).toBe('00000000-0000-4000-8000-000000000001');
    expect(uuid).toHaveBeenCalledTimes(1);
  });

  it('actions identity is stable across renders and across state changes', async () => {
    await mount({ state: SCENARIO });
    const first = ready().actions;
    act(() => first.setIncome(10));
    act(() => first.setIncome(20));
    expect(new Set(probe.seenActions).size).toBe(1);
    expect(ready().actions).toBe(first);
    expect(ready().state.incomeCents).toBe(20);
  });

  it('actions called back to back in one act compose', async () => {
    const { readStored } = await mount({ state: SCENARIO });
    act(() => {
      const { actions } = ready();
      actions.setIncome(111);
      const id = actions.addCategory({ name: 'Pets', plannedCents: 2500 });
      actions.addExpense({ categoryId: id, amountCents: 99, note: '', date: '2026-11-09' });
      actions.deleteExpense('e1');
    });
    const state = ready().state;
    expect(state.incomeCents).toBe(111);
    expect(state.categories.at(-1)?.name).toBe('Pets');
    expect(state.expenses.map((e) => e.id)).toEqual(['e2', 'e3', 'id-2']);
    expect(readStored()).toEqual(state);
  });

  it('a throwing action propagates and changes neither state nor storage', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    await mount({ storage });
    const before = storage.dump();
    const calls = storage.setItemCalls;
    const { actions } = ready();
    expect(() => actions.setIncome(1.5)).toThrow();
    expect(() => actions.addCategory({ name: 'rent', plannedCents: 1 })).toThrow();
    expect(() => actions.addExpense({ ...EXPENSE, categoryId: 'nope' })).toThrow();
    expect(() => actions.addExpense({ ...EXPENSE, date: '2026-12-01' })).toThrow();
    expect(() => actions.updateCategory('suggested-rent', { plannedCents: -1 })).toThrow();
    expect(storage.dump()).toEqual(before);
    expect(storage.setItemCalls).toBe(calls);
    expect(ready().state).toEqual(SCENARIO);
    expect(shownState()).toEqual(SCENARIO);
    // and it still works afterwards
    act(() => actions.setIncome(7));
    expect(ready().state.incomeCents).toBe(7);
  });

  it('a throwing action followed by a valid one in the same act keeps the valid one', async () => {
    const { readStored } = await mount({ state: SCENARIO });
    act(() => {
      const { actions } = ready();
      expect(() => actions.setIncome(-5)).toThrow();
      actions.setIncome(42);
    });
    expect(readStored()?.incomeCents).toBe(42);
  });

  it('unknown ids are harmless no-ops', async () => {
    await mount({ state: SCENARIO });
    act(() => {
      ready().actions.deleteExpense('nope');
      ready().actions.removeCategory('nope');
      ready().actions.updateCategory('nope', { name: 'x' });
    });
    expect(ready().state).toEqual(SCENARIO);
  });
});

describe('refresh (page reload)', () => {
  it('restores exactly the same state after setIncome and addCategory', async () => {
    probe.seenActions.length = 0;
    const view = renderWithBudget(<Probe />);
    await screen.findByText('status: ready');
    act(() => ready().actions.setIncome(320000));
    act(() => {
      ready().actions.addCategory({ name: 'Pets', plannedCents: 2500 });
    });
    const before = shownState();
    expect(before.incomeCents).toBe(320000);
    expect(before.categories.at(-1)).toMatchObject({ name: 'Pets', plannedCents: 2500 });
    view.refresh();
    await screen.findByText('status: ready');
    expect(screen.getByTestId('load')).toHaveTextContent('loaded');
    expect(shownState()).toEqual(before);
    expect(ready().generation).toBe(0);
  });
});

describe('deleteAllData', () => {
  it('empties the book, shows the current month, bumps generation and saves', async () => {
    const view = await mount({ state: SCENARIO });
    expect(ready().generation).toBe(0);
    act(() => ready().actions.deleteAllData());
    expect(ready().state).toEqual(createInitialState('2026-11'));
    expect(ready().generation).toBe(1);
    expect(view.readStoredBook()).toEqual({ months: [] });
    act(() => ready().actions.deleteAllData());
    expect(ready().generation).toBe(2);
  });

  it('persists across a refresh, and generation restarts at 0', async () => {
    const view = await mount({ state: SCENARIO });
    act(() => ready().actions.deleteAllData());
    view.refresh();
    await screen.findByText('status: ready');
    expect(shownState()).toEqual(createInitialState('2026-11'));
    expect(ready().generation).toBe(0);
  });

  it('other actions do not change generation', async () => {
    await mount({ state: SCENARIO });
    act(() => ready().actions.setIncome(3));
    expect(ready().generation).toBe(0);
  });
});

describe('storage failures', () => {
  it('unavailable: ready with the initial state; setIncome works in memory with nothing thrown or logged', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryStorage({}, { throwOnGet: true, throwOnSet: true });
    await mount({ storage });
    expect(screen.getByTestId('load')).toHaveTextContent('unavailable');
    expect(shownState()).toEqual(createInitialState('2026-11'));
    act(() => ready().actions.setIncome(500));
    expect(shownState().incomeCents).toBe(500);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a failed save is ignored: state still updates and later actions still work', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) }, { throwOnSet: true });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await mount({ storage });
    expect(screen.getByTestId('load')).toHaveTextContent('loaded');
    expect(() => act(() => ready().actions.setIncome(900))).not.toThrow();
    expect(shownState().incomeCents).toBe(900);
    act(() => {
      ready().actions.addCategory({ name: 'Pets', plannedCents: 1 });
    });
    expect(shownState().categories.at(-1)?.name).toBe('Pets');
    expect(storage.setItemCalls).toBe(2);
    expect(storage.dump()[STORAGE_KEY]).toBe(serializeOneMonth(SCENARIO));
    expect(error).not.toHaveBeenCalled();
  });

  it('a save that fails once does not stop later saves from succeeding', async () => {
    let fail = true;
    const inner = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    const storage = {
      getItem: (k: string) => inner.getItem(k),
      removeItem: (k: string) => inner.removeItem(k),
      setItem: (k: string, v: string) => {
        if (fail) throw new DOMException('Quota', 'QuotaExceededError');
        inner.setItem(k, v);
      },
    };
    const { readStored } = await mount({ storage });
    act(() => ready().actions.setIncome(1));
    fail = false;
    act(() => ready().actions.setIncome(2));
    expect(readStored()?.incomeCents).toBe(2);
  });
});

describe('StrictMode', () => {
  it('loads once to the same state, with no duplicate writes and no warnings', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    const getItem = vi.spyOn(storage, 'getItem');
    const createId = vi.fn(() => 'sid');
    render(
      <StrictMode>
        <BudgetProvider storage={storage} getToday={() => '2026-11-14'} createId={createId}>
          <Probe />
        </BudgetProvider>
      </StrictMode>,
    );
    await screen.findByText('status: ready');
    expect(shownState()).toEqual(SCENARIO);
    expect(screen.getByTestId('load')).toHaveTextContent('loaded');
    expect(ready().generation).toBe(0);
    expect(storage.setItemCalls).toBe(0);
    expect(createId).not.toHaveBeenCalled();
    // StrictMode may run the effect twice; every run must see the same value
    expect(getItem.mock.calls.length).toBeLessThanOrEqual(2);
    act(() => {
      ready().actions.addCategory({ name: 'Pets', plannedCents: 1 });
    });
    expect(storage.setItemCalls).toBe(1);
    expect(ready().state.categories.filter((c) => c.id === 'sid')).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('empty storage under StrictMode stays unwritten and ready', async () => {
    const storage = createMemoryStorage();
    render(
      <StrictMode>
        <BudgetProvider storage={storage} getToday={() => '2026-11-14'}>
          <Probe />
        </BudgetProvider>
      </StrictMode>,
    );
    await screen.findByText('status: ready');
    expect(shownState()).toEqual(createInitialState('2026-11'));
    expect(storage.setItemCalls).toBe(0);
  });
});

const TOO_LARGE = 'That change would make a total too large.';

function bigCategories(n: number): BudgetState {
  return {
    month: '2026-11',
    incomeCents: 0,
    categories: Array.from({ length: n }, (_v, i) => ({ id: `c${i}`, name: `Cat ${i}`, plannedCents: MAX_CENTS })),
    expenses: [],
  };
}

function bigExpenses(n: number): BudgetState {
  return {
    month: '2026-11',
    incomeCents: 0,
    categories: [{ id: 'c0', name: 'Cat', plannedCents: 0 }],
    expenses: Array.from({ length: n }, (_v, i) => ({
      id: `x${i}`,
      categoryId: 'c0',
      amountCents: MAX_CENTS,
      note: '',
      date: '2026-11-10',
    })),
  };
}

describe('totals-safe actions', () => {
  it('addCategory that would overflow the planned total throws the exact RangeError and changes nothing', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(bigCategories(90)) });
    await mount({ storage });
    const before = ready().state;
    const calls = storage.setItemCalls;
    const raw = storage.dump()[STORAGE_KEY];
    const { actions } = ready();
    let thrown: unknown;
    try {
      actions.addCategory({ name: 'One too many', plannedCents: MAX_CENTS });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RangeError);
    expect((thrown as RangeError).message).toBe(TOO_LARGE);
    expect(ready().state).toBe(before);
    expect(storage.setItemCalls).toBe(calls);
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });

  it('addExpense that would overflow the spent total throws the exact RangeError and changes nothing', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(bigExpenses(90)) });
    await mount({ storage });
    const before = ready().state;
    const calls = storage.setItemCalls;
    let thrown: unknown;
    try {
      ready().actions.addExpense({ categoryId: 'c0', amountCents: MAX_CENTS, note: '', date: '2026-11-11' });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RangeError);
    expect((thrown as RangeError).message).toBe(TOO_LARGE);
    expect(ready().state).toBe(before);
    expect(storage.setItemCalls).toBe(calls);
  });

  it('a change that stays safe still works afterwards, including one exactly at the limit', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(bigCategories(89)) });
    await mount({ storage });
    expect(() => ready().actions.addCategory({ name: 'Over', plannedCents: MAX_CENTS * 2 })).toThrow();
    act(() => {
      ready().actions.addCategory({ name: 'Last safe', plannedCents: MAX_CENTS });
    });
    expect(ready().state.categories).toHaveLength(90);
    expect(storage.setItemCalls).toBe(1);
    expect(() => ready().actions.addCategory({ name: 'Too much', plannedCents: MAX_CENTS })).toThrow(TOO_LARGE);
    act(() => ready().actions.setIncome(5));
    expect(ready().state.incomeCents).toBe(5);
    expect(storage.setItemCalls).toBe(2);
  });

  it('an overflowing action in the same act as a valid one keeps only the valid one', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(bigCategories(90)) });
    await mount({ storage });
    act(() => {
      const { actions } = ready();
      expect(() => actions.addCategory({ name: 'Boom', plannedCents: MAX_CENTS })).toThrow(RangeError);
      actions.setIncome(9);
    });
    expect(ready().state.incomeCents).toBe(9);
    expect(ready().state.categories).toHaveLength(90);
  });

  it('a stored state that cannot be totalled is not loaded: initial state, invalid, untouched', async () => {
    const raw = JSON.stringify({ version: 1, state: bigCategories(91) });
    const storage = createMemoryStorage({ [STORAGE_KEY]: raw });
    await mount({ storage });
    expect(screen.getByTestId('load')).toHaveTextContent('invalid');
    expect(shownState()).toEqual(createInitialState('2026-11'));
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe(raw);
  });
});

describe('no-op actions', () => {
  it('do not save, keep garbage byte-identical and keep the state object identical; a real change then overwrites', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'garbage' });
    await mount({ storage });
    const before = ready().state;
    act(() => {
      const { actions } = ready();
      actions.deleteExpense('nope');
      actions.removeCategory('nope');
      actions.updateCategory('nope', { name: 'x' });
    });
    expect(storage.setItemCalls).toBe(0);
    expect(storage.dump()[STORAGE_KEY]).toBe('garbage');
    expect(ready().state).toBe(before);
    expect(ready().savedDataReplaced).toBe(false);
    act(() => ready().actions.setIncome(3));
    expect(storage.setItemCalls).toBe(1);
    expect(storage.dump()[STORAGE_KEY]).not.toBe('garbage');
    expect(ready().savedDataReplaced).toBe(true);
  });

  it('each no-op alone does not write (loaded SCENARIO)', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    await mount({ storage });
    const before = ready().state;
    for (const run of [
      () => ready().actions.deleteExpense('nope'),
      () => ready().actions.removeCategory('nope'),
      () => ready().actions.updateCategory('nope', { name: 'x' }),
    ]) {
      act(run);
      expect(storage.setItemCalls).toBe(0);
      expect(ready().state).toBe(before);
    }
  });
});

describe('savedDataReplaced', () => {
  it('invalid load: false at first, true after the first successful save, stays true', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'garbage' });
    await mount({ storage });
    expect(ready().loadStatus).toBe('invalid');
    expect(ready().savedDataReplaced).toBe(false);
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(true);
    expect(ready().loadStatus).toBe('invalid');
    act(() => ready().actions.setIncome(2));
    expect(ready().savedDataReplaced).toBe(true);
  });

  it('invalid load with an unsupported version behaves the same', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2, state: {} }) });
    await mount({ storage });
    expect(ready().savedDataReplaced).toBe(false);
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(true);
  });

  it('a failing save does not flip it, and a later successful save does', async () => {
    let fail = true;
    const inner = createMemoryStorage({ [STORAGE_KEY]: 'garbage' });
    const storage = {
      getItem: (k: string) => inner.getItem(k),
      removeItem: (k: string) => inner.removeItem(k),
      setItem: (k: string, v: string) => {
        if (fail) throw new DOMException('Quota', 'QuotaExceededError');
        inner.setItem(k, v);
      },
    };
    await mount({ storage });
    act(() => ready().actions.setIncome(1));
    expect(ready().state.incomeCents).toBe(1);
    expect(ready().savedDataReplaced).toBe(false);
    expect(inner.dump()[STORAGE_KEY]).toBe('garbage');
    fail = false;
    act(() => ready().actions.setIncome(2));
    expect(ready().savedDataReplaced).toBe(true);
  });

  it('stays true when a later save fails', async () => {
    let fail = false;
    const inner = createMemoryStorage({ [STORAGE_KEY]: 'garbage' });
    const storage = {
      getItem: (k: string) => inner.getItem(k),
      removeItem: (k: string) => inner.removeItem(k),
      setItem: (k: string, v: string) => {
        if (fail) throw new DOMException('Quota', 'QuotaExceededError');
        inner.setItem(k, v);
      },
    };
    await mount({ storage });
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(true);
    fail = true;
    act(() => ready().actions.setIncome(2));
    expect(ready().savedDataReplaced).toBe(true);
  });

  it('throwOnSet never flips it on an invalid load', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: 'garbage' }, { throwOnSet: true });
    await mount({ storage });
    act(() => ready().actions.setIncome(1));
    act(() => ready().actions.setIncome(2));
    expect(ready().savedDataReplaced).toBe(false);
  });

  it('stays false for loaded, empty and unavailable even after saves', async () => {
    const loaded = createMemoryStorage({ [STORAGE_KEY]: serializeOneMonth(SCENARIO) });
    await mount({ storage: loaded });
    expect(ready().savedDataReplaced).toBe(false);
    act(() => ready().actions.setIncome(1));
    expect([ready().loadStatus, ready().savedDataReplaced]).toEqual(['loaded', false]);
  });

  it('stays false for an empty load after saves', async () => {
    await mount({ storage: createMemoryStorage() });
    act(() => ready().actions.setIncome(1));
    expect([ready().loadStatus, ready().savedDataReplaced]).toEqual(['empty', false]);
  });

  it('stays false for an unavailable load after saves, with storage null or throwing', async () => {
    await mount({ storage: createMemoryStorage({}, { throwOnGet: true }) });
    act(() => ready().actions.setIncome(1));
    expect([ready().loadStatus, ready().savedDataReplaced]).toEqual(['unavailable', false]);
    cleanup();
    // storage whose reads fail but whose writes succeed: saving works, the flag still stays false
    const writable = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
      setItem: () => {},
      removeItem: () => {},
    };
    await mount({ storage: writable });
    act(() => ready().actions.setIncome(1));
    expect([ready().loadStatus, ready().savedDataReplaced]).toEqual(['unavailable', false]);
  });

  it('a corrupt (overflowing) load also counts as invalid and flips after the first save', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, state: bigCategories(91) }) });
    await mount({ storage });
    expect(ready().savedDataReplaced).toBe(false);
    act(() => ready().actions.setIncome(1));
    expect(ready().savedDataReplaced).toBe(true);
  });
});

describe('default id generator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function mountDefaultIds(): Promise<void> {
    latest0();
    render(
      <BudgetProvider storage={createMemoryStorage()} getToday={() => '2026-11-14'}>
        <Probe />
      </BudgetProvider>,
    );
    await screen.findByText('status: ready');
  }
  function latest0(): void {
    probe.latest = null;
  }

  const addCategories = (n: number): string[] => {
    const ids: string[] = [];
    act(() => {
      for (let i = 0; i < n; i++) ids.push(ready().actions.addCategory({ name: `C${i}`, plannedCents: 1 }));
    });
    return ids;
  };

  it('uses crypto.randomUUID when present', async () => {
    const randomUUID = vi.fn(() => 'uuid-from-crypto');
    vi.stubGlobal('crypto', { randomUUID, getRandomValues: () => { throw new Error('should not be used'); } });
    await mountDefaultIds();
    expect(addCategories(1)).toEqual(['uuid-from-crypto']);
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('falls back to 16 random bytes as 32 lowercase hex characters when randomUUID is missing', async () => {
    const getRandomValues = vi.fn(<T extends ArrayBufferView>(array: T): T => {
      const bytes = array as unknown as Uint8Array;
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      return array;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    await mountDefaultIds();
    const ids = addCategories(200);
    expect(getRandomValues).toHaveBeenCalledTimes(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(new Set(ids).size).toBe(200);
  });

  it('asks getRandomValues for exactly 16 bytes and hex-encodes them in order, zero padded', async () => {
    const getRandomValues = vi.fn(<T extends ArrayBufferView>(array: T): T => {
      const bytes = array as unknown as Uint8Array;
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(16);
      bytes.set([0, 1, 15, 16, 255, 171, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
      return array;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    await mountDefaultIds();
    expect(addCategories(1)).toEqual(['00010f10ffab0000000000000000' + '0002']);
  });

  it('falls back to non-empty unique strings when crypto is undefined', async () => {
    vi.stubGlobal('crypto', undefined);
    await mountDefaultIds();
    const ids = addCategories(1000);
    for (const id of ids) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    }
    expect(new Set(ids).size).toBe(1000);
  });

  it('keeps ids unique across two separate mounts when crypto is undefined', async () => {
    vi.stubGlobal('crypto', undefined);
    await mountDefaultIds();
    const first = addCategories(5);
    cleanup();
    await mountDefaultIds();
    const second = addCategories(5);
    expect(new Set([...first, ...second]).size).toBe(10);
  });
});
