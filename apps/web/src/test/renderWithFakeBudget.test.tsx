import { Button } from '@budget-kit/ui';
import { render, screen } from '@testing-library/react';
import { type ReactElement, useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { BudgetState } from '@/lib/budget';
import { type BudgetContextValue, TOTAL_TOO_LARGE_MESSAGE, useBudget } from '@/state/BudgetProvider';
import { SCENARIO } from './fixtures';
import { createMemoryStorage } from './memoryStorage';
import { renderWithBudget } from './renderWithBudget';
import { renderWithFakeBudget } from './renderWithFakeBudget';
import { STORAGE_KEY, serializeBook } from '@/state/storage';

const seen: { value: BudgetContextValue | null } = { value: null };

function Probe(): ReactElement {
  const budget = useBudget();
  useEffect(() => {
    seen.value = budget;
  });
  return <p>{budget.status}</p>;
}

function readyValue(): Extract<BudgetContextValue, { status: 'ready' }> {
  const value = seen.value;
  if (value === null || value.status !== 'ready') throw new Error('probe did not see a ready value');
  return value;
}

const OTHER_MONTH: BudgetState = { ...SCENARIO, month: '2026-09' };

describe('TOTAL_TOO_LARGE_MESSAGE', () => {
  it('is exactly the documented text', () => {
    expect(TOTAL_TOO_LARGE_MESSAGE).toBe('That change would make a total too large.');
  });

  it('is the message the real provider throws on overflow', async () => {
    const big: BudgetState = {
      month: '2026-11',
      incomeCents: 0,
      categories: Array.from({ length: 90 }, (_v, i) => ({ id: `c${i}`, name: `C${i}`, plannedCents: 99_999_999_999_999 })),
      expenses: [],
    };
    seen.value = null;
    renderWithBudget(<Probe />, { storage: createMemoryStorage({ [STORAGE_KEY]: serializeBook({ months: [big] }) }) });
    await screen.findByText('ready');
    let message = '';
    try {
      readyValue().actions.addCategory({ name: 'More', plannedCents: 99_999_999_999_999 });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe(TOTAL_TOO_LARGE_MESSAGE);
  });
});

describe('renderWithFakeBudget', () => {
  it('renders a ready value with the given state, and a thrown override is the exact RangeError and is recorded', () => {
    const { actions } = renderWithFakeBudget(<Probe />, {
      state: SCENARIO,
      actions: {
        setIncome: () => {
          throw new RangeError(TOTAL_TOO_LARGE_MESSAGE);
        },
      },
    });
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(readyValue().state).toBe(SCENARIO);
    let thrown: unknown;
    try {
      readyValue().actions.setIncome(5);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RangeError);
    expect((thrown as RangeError).message).toBe('That change would make a total too large.');
    expect(actions.setIncome).toHaveBeenCalledTimes(1);
    expect(actions.setIncome).toHaveBeenCalledWith(5);
  });

  it('the returned actions are the same mocks the probe received', () => {
    const { actions } = renderWithFakeBudget(<Probe />, { state: SCENARIO });
    const received = readyValue().actions;
    expect(received).toBe(actions);
    for (const key of Object.keys(actions) as (keyof typeof actions)[]) {
      expect(received[key], key).toBe(actions[key]);
      expect(vi.isMockFunction(received[key]), key).toBe(true);
    }
    expect(Object.keys(actions).sort()).toEqual(
      ['addCategory', 'addExpense', 'deleteAllData', 'deleteExpense', 'removeCategory', 'setIncome', 'updateCategory'],
    );
  });

  it('un-overridden actions record calls and do nothing; add* return fake-id by default', () => {
    const { actions } = renderWithFakeBudget(<Probe />, { state: SCENARIO });
    const a = readyValue().actions;
    expect(a.setIncome(1)).toBeUndefined();
    expect(a.updateCategory('x', { name: 'y' })).toBeUndefined();
    expect(a.removeCategory('x')).toBeUndefined();
    expect(a.deleteExpense('x')).toBeUndefined();
    expect(a.deleteAllData()).toBeUndefined();
    expect(a.addCategory({ name: 'n', plannedCents: 1 })).toBe('fake-id');
    expect(a.addExpense({ categoryId: 'c', amountCents: 1, note: '', date: '2026-11-01' })).toBe('fake-id');
    expect(actions.setIncome).toHaveBeenCalledWith(1);
    expect(actions.updateCategory).toHaveBeenCalledWith('x', { name: 'y' });
    expect(actions.removeCategory).toHaveBeenCalledWith('x');
    expect(actions.deleteExpense).toHaveBeenCalledWith('x');
    expect(actions.deleteAllData).toHaveBeenCalledTimes(1);
    expect(actions.addCategory).toHaveBeenCalledTimes(1);
    expect(actions.addExpense).toHaveBeenCalledTimes(1);
    // no state change
    expect(readyValue().state).toBe(SCENARIO);
  });

  it('overrides apply only to the named action', () => {
    const addExpense = vi.fn(() => 'mine');
    const { actions } = renderWithFakeBudget(<Probe />, { state: SCENARIO, actions: { addExpense } });
    expect(readyValue().actions.addExpense({ categoryId: 'c', amountCents: 1, note: '', date: '2026-11-01' })).toBe('mine');
    expect(readyValue().actions.addCategory({ name: 'n', plannedCents: 1 })).toBe('fake-id');
    expect(actions.addExpense).toHaveBeenCalledTimes(1);
  });

  it('defaults today to 2026-11-14 and derives the month list from the state', () => {
    renderWithFakeBudget(<Probe />, { state: SCENARIO });
    expect(readyValue()).toMatchObject({
      today: '2026-11-14',
      currentMonth: '2026-11',
      viewedMonth: '2026-11',
      months: ['2026-11'],
      isViewedMonthStored: true,
      copiedFromMonth: null,
    });
    expect(readyValue().book).toEqual({ months: [SCENARIO] });
  });

  it('a state from another month is stored, and the current month is added to the list', () => {
    renderWithFakeBudget(<Probe />, { state: OTHER_MONTH });
    expect(readyValue()).toMatchObject({ currentMonth: '2026-11', viewedMonth: '2026-09', months: ['2026-09', '2026-11'] });
    expect(readyValue().state.month).toBe('2026-09');
  });

  it('an explicit today changes currentMonth and months', () => {
    renderWithFakeBudget(<Probe />, { state: SCENARIO, today: '2026-12-02' });
    expect(readyValue()).toMatchObject({ today: '2026-12-02', currentMonth: '2026-12', months: ['2026-11', '2026-12'] });
  });

  it('an unstored viewed month reports where it was copied from', () => {
    renderWithFakeBudget(<Probe />, { state: { ...SCENARIO, month: '2026-12', expenses: [] }, book: { months: [SCENARIO] } });
    expect(readyValue()).toMatchObject({ isViewedMonthStored: false, copiedFromMonth: '2026-11' });
  });

  it('returns a viewMonth mock that is also in the value', () => {
    const { viewMonth } = renderWithFakeBudget(<Probe />, { state: SCENARIO });
    expect(vi.isMockFunction(viewMonth)).toBe(true);
    readyValue().viewMonth('2026-10');
    expect(viewMonth).toHaveBeenCalledExactlyOnceWith('2026-10');
  });

  it('has loadStatus loaded, savedDataReplaced false and generation 0', () => {
    renderWithFakeBudget(<Probe />, { state: SCENARIO });
    expect(readyValue()).toMatchObject({ status: 'ready', loadStatus: 'loaded', savedDataReplaced: false, generation: 0 });
  });

  it('uses no storage and no provider: localStorage is never touched', () => {
    const lookup = vi.spyOn(window, 'localStorage', 'get');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderWithFakeBudget(<Probe />, { state: SCENARIO });
    readyValue().actions.setIncome(9);
    expect(lookup).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('the state never changes, even after actions are called', () => {
    renderWithFakeBudget(<Probe />, { state: SCENARIO });
    readyValue().actions.setIncome(1);
    readyValue().actions.deleteExpense('e1');
    expect(readyValue().state).toEqual(SCENARIO);
  });

  it('the returned user clicks a library button in the probe and the mock records it', async () => {
    function ClickProbe(): ReactElement {
      const budget = useBudget();
      if (budget.status !== 'ready') return <p>loading</p>;
      return <Button onClick={() => budget.actions.setIncome(123)}>Set income</Button>;
    }
    const { user, actions } = renderWithFakeBudget(<ClickProbe />, { state: SCENARIO });
    await user.click(screen.getByRole('button', { name: 'Set income' }));
    expect(actions.setIncome).toHaveBeenCalledExactlyOnceWith(123);
  });
});

describe('useBudget outside any provider', () => {
  it('still throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(Error);
  });
});
