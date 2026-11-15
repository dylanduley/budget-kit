import { type RenderResult, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { type Mock, vi } from 'vitest';

import type { BudgetState } from '@/lib/budget';
import { monthOf } from '@/lib/budget';
import { type BudgetActions, BudgetContext } from '@/state/BudgetProvider';

export interface RenderWithFakeBudgetOptions {
  state: BudgetState;
  today?: string;
  actions?: Partial<BudgetActions>;
}

export type FakeActions = { [K in keyof BudgetActions]: Mock<BudgetActions[K]> };

export function renderWithFakeBudget(
  ui: ReactElement,
  options: RenderWithFakeBudgetOptions,
): RenderResult & { user: UserEvent; actions: FakeActions } {
  const today = options.today ?? '2026-11-14';
  const overrides = options.actions ?? {};
  const actions: FakeActions = {
    setIncome: vi.fn<BudgetActions['setIncome']>(overrides.setIncome ?? (() => undefined)),
    addCategory: vi.fn<BudgetActions['addCategory']>(overrides.addCategory ?? (() => 'fake-id')),
    updateCategory: vi.fn<BudgetActions['updateCategory']>(overrides.updateCategory ?? (() => undefined)),
    removeCategory: vi.fn<BudgetActions['removeCategory']>(overrides.removeCategory ?? (() => undefined)),
    addExpense: vi.fn<BudgetActions['addExpense']>(overrides.addExpense ?? (() => 'fake-id')),
    deleteExpense: vi.fn<BudgetActions['deleteExpense']>(overrides.deleteExpense ?? (() => undefined)),
    resetMonth: vi.fn<BudgetActions['resetMonth']>(overrides.resetMonth ?? (() => undefined)),
  };
  const currentMonth = monthOf(today);
  const user = userEvent.setup();
  const result = render(
    <BudgetContext.Provider
      value={{
        status: 'ready',
        state: options.state,
        today,
        currentMonth,
        isOtherMonth: options.state.month !== currentMonth,
        generation: 0,
        loadStatus: 'loaded',
        savedDataReplaced: false,
        actions,
      }}
    >
      {ui}
    </BudgetContext.Provider>,
  );
  return { ...result, user, actions };
}
