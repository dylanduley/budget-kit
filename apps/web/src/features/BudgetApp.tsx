'use client';

import type { ReactElement } from 'react';

import { ExpenseList } from '@/features/expenses/ExpenseList';
import { formatMonth } from '@/lib/budget';
import { useBudget } from '@/state/BudgetProvider';

const MAIN_CLASS = 'mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6';

export function BudgetApp(): ReactElement {
  const budget = useBudget();

  if (budget.status === 'loading') {
    return (
      <main className={MAIN_CLASS} aria-busy="true">
        <h1 className="text-2xl font-semibold text-text">Budget Kit</h1>
        <p>Loading your budget…</p>
      </main>
    );
  }

  return (
    <main className={MAIN_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text">Budget Kit</h1>
        <p className="text-text-muted">Budget for {formatMonth(budget.state.month)}</p>
      </div>
      <ExpenseList />
    </main>
  );
}
