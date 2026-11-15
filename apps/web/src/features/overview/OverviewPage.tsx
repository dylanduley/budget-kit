'use client';

import type { ReactElement } from 'react';

import { Dashboard } from '@/features/dashboard/Dashboard';
import { useBudget } from '@/state/BudgetProvider';

export function OverviewPage(): ReactElement {
  const budget = useBudget();

  if (budget.status === 'loading') {
    return (
      <>
        <h1 className="text-2xl font-semibold text-text">Overview</h1>
        <p>Loading your budget…</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text">Overview</h1>
      {budget.book.months.length === 0 ? (
        <p>Welcome. Start on the Plan page: enter your monthly income and add the categories you spend on.</p>
      ) : null}
      <Dashboard />
    </>
  );
}
