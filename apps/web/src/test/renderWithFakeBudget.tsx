import { type RenderResult, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { type Mock, vi } from 'vitest';

import type { BudgetState } from '@/lib/budget';
import { monthOf } from '@/lib/budget';
import { type BudgetBook, availableMonths, copySourceFor, findMonth } from '@/lib/months';
import { type BudgetActions, BudgetContext } from '@/state/BudgetProvider';

export interface RenderWithFakeBudgetOptions {
  state: BudgetState;
  book?: BudgetBook;
  today?: string;
  viewMonth?: (month: string) => void;
  actions?: Partial<BudgetActions>;
}

export type FakeActions = { [K in keyof BudgetActions]: Mock<BudgetActions[K]> };

export function renderWithFakeBudget(
  ui: ReactElement,
  options: RenderWithFakeBudgetOptions,
): RenderResult & { user: UserEvent; actions: FakeActions; viewMonth: Mock<(month: string) => void> } {
  const today = options.today ?? '2026-11-14';
  const overrides = options.actions ?? {};
  const actions: FakeActions = {
    setIncome: vi.fn<BudgetActions['setIncome']>(overrides.setIncome ?? (() => undefined)),
    addCategory: vi.fn<BudgetActions['addCategory']>(overrides.addCategory ?? (() => 'fake-id')),
    updateCategory: vi.fn<BudgetActions['updateCategory']>(overrides.updateCategory ?? (() => undefined)),
    removeCategory: vi.fn<BudgetActions['removeCategory']>(overrides.removeCategory ?? (() => undefined)),
    addExpense: vi.fn<BudgetActions['addExpense']>(overrides.addExpense ?? (() => 'fake-id')),
    deleteExpense: vi.fn<BudgetActions['deleteExpense']>(overrides.deleteExpense ?? (() => undefined)),
    deleteAllData: vi.fn<BudgetActions['deleteAllData']>(overrides.deleteAllData ?? (() => undefined)),
  };
  const viewMonth = vi.fn<(month: string) => void>(options.viewMonth ?? (() => undefined));
  const currentMonth = monthOf(today);
  const book: BudgetBook = options.book ?? { months: [options.state] };
  const isViewedMonthStored = findMonth(book, options.state.month) !== undefined;
  const user = userEvent.setup();
  const result = render(
    <BudgetContext.Provider
      value={{
        status: 'ready',
        state: options.state,
        today,
        currentMonth,
        book,
        viewedMonth: options.state.month,
        months: availableMonths(book, currentMonth),
        isViewedMonthStored,
        copiedFromMonth: isViewedMonthStored ? null : (copySourceFor(book, options.state.month)?.month ?? null),
        generation: 0,
        loadStatus: 'loaded',
        savedDataReplaced: false,
        viewMonth,
        actions,
      }}
    >
      {ui}
    </BudgetContext.Provider>,
  );
  return { ...result, user, actions, viewMonth };
}
