'use client';

import type { ReactElement } from 'react';

import { useBudget } from '@/state/BudgetProvider';

export function HistoryPage(): ReactElement {
  const budget = useBudget();

  if (budget.status === 'loading') {
    return (
      <>
        <h1 className="text-2xl font-semibold text-text">History</h1>
        <p>Loading your budget…</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text">History</h1>
      <p>Your months will be listed here.</p>
    </>
  );
}
