'use client';

import type { ReactElement } from 'react';

import { ExpenseList } from '@/features/expenses/ExpenseList';
import { useBudget } from '@/state/BudgetProvider';

export function SpendingPage(): ReactElement {
  const budget = useBudget();

  if (budget.status === 'loading') {
    return (
      <>
        <h1 className="text-2xl font-semibold text-text">Spending</h1>
        <p>Loading your budget…</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text">Spending</h1>
      <ExpenseList />
    </>
  );
}
