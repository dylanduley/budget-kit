'use client';

import type { ReactElement } from 'react';

import { MonthSetup } from '@/features/setup/MonthSetup';
import { useBudget } from '@/state/BudgetProvider';

export function PlanPage(): ReactElement {
  const budget = useBudget();

  if (budget.status === 'loading') {
    return (
      <>
        <h1 className="text-2xl font-semibold text-text">Plan</h1>
        <p>Loading your budget…</p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-text">Plan</h1>
      <MonthSetup key={`${budget.viewedMonth}:${budget.generation}`} />
    </>
  );
}
