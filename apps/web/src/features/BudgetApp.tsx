'use client';

import type { ReactElement } from 'react';

import { Dashboard } from '@/features/dashboard/Dashboard';
import { AddExpense } from '@/features/expenses/AddExpense';
import { ExpenseList } from '@/features/expenses/ExpenseList';
import { MonthNotice } from '@/features/reset/MonthNotice';
import { ResetMonth } from '@/features/reset/ResetMonth';
import { MonthSetup } from '@/features/setup/MonthSetup';
import { formatMonth } from '@/lib/budget';
import { useBudget } from '@/state/BudgetProvider';

const FIRST_RUN_MESSAGE = 'Start by entering your monthly income and what you plan to spend in each category.';
const INVALID_MESSAGE =
  "Your saved budget couldn't be read, so a new one was started. Your first change will replace the saved data.";
const REPLACED_MESSAGE = "Your saved budget couldn't be read and has been replaced.";
const UNAVAILABLE_MESSAGE =
  "This browser isn't letting the app save, so your changes will be lost when you close the page.";

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

  const isFirstRun = budget.state.incomeCents === 0 && budget.state.expenses.length === 0;

  return (
    <main className={MAIN_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-text">Budget Kit</h1>
        <p className="text-text-muted">Budget for {formatMonth(budget.state.month)}</p>
        {isFirstRun ? <p>{FIRST_RUN_MESSAGE}</p> : null}
        {budget.loadStatus === 'invalid' ? (
          <p>{budget.savedDataReplaced ? REPLACED_MESSAGE : INVALID_MESSAGE}</p>
        ) : null}
        {budget.loadStatus === 'unavailable' ? <p>{UNAVAILABLE_MESSAGE}</p> : null}
      </div>
      <MonthNotice />
      <Dashboard />
      <AddExpense />
      <ExpenseList />
      <MonthSetup key={budget.generation} />
      <ResetMonth />
    </main>
  );
}
