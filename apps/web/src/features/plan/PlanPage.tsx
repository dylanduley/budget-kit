'use client';

import type { ReactElement } from 'react';

import { useBudget } from '@/state/BudgetProvider';

import { CategoriesCard } from './CategoriesCard';
import { IncomeCard } from './IncomeCard';

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

  const key = `${budget.viewedMonth}:${budget.generation}`;
  return (
    <>
      <h1 className="text-2xl font-semibold text-text">Plan</h1>
      <IncomeCard key={`income:${key}`} />
      <CategoriesCard key={`categories:${key}`} />
    </>
  );
}
